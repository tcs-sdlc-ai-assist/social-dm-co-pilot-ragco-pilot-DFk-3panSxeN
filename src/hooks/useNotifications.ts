"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePolling } from "@/hooks/usePolling";
import { POLLING_INTERVAL_NOTIFICATIONS } from "@/lib/constants";
import type {
  NotificationResponse,
  PaginatedResponse,
  ApiErrorResponse,
} from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseNotificationsOptions {
  /** Recipient email to filter notifications for */
  recipient?: string;
  /** Whether to start polling immediately (default: true) */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: POLLING_INTERVAL_NOTIFICATIONS) */
  intervalMs?: number;
  /** Page size for notification fetching (default: 50) */
  limit?: number;
  /** Filter by notification type */
  type?: string;
  /** Filter by notification status */
  status?: string;
  /** Callback invoked when new unread notifications are detected */
  onNewNotification?: (notifications: NotificationResponse[]) => void;
  /** Callback invoked on fetch error */
  onError?: (error: Error) => void;
}

export interface UseNotificationsResult {
  /** Array of notifications */
  notifications: NotificationResponse[];
  /** Count of unread notifications */
  unreadCount: number;
  /** Whether notifications are currently loading */
  isLoading: boolean;
  /** The most recent error, or null */
  error: Error | null;
  /** Whether polling is currently active */
  isPolling: boolean;
  /** Mark a single notification as read */
  markAsRead: (notificationId: string) => Promise<void>;
  /** Mark a single notification as dismissed */
  markAsDismissed: (notificationId: string) => Promise<void>;
  /** Mark all notifications as read for the current recipient */
  markAllAsRead: () => Promise<void>;
  /** Manually refresh notifications */
  refetch: () => Promise<void>;
  /** Start polling */
  start: () => void;
  /** Stop polling */
  stop: () => void;
  /** Total number of notifications matching the filter */
  total: number;
  /** Timestamp of the last successful fetch */
  lastFetchedAt: Date | null;
}

// ─── Fetch Helpers ───────────────────────────────────────────────────────────

async function fetchNotifications(params: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  recipient?: string;
}): Promise<PaginatedResponse<NotificationResponse>> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.type) searchParams.set("type", params.type);
  if (params.status) searchParams.set("status", params.status);
  if (params.recipient) searchParams.set("recipient", params.recipient);

  const url = `/api/notifications${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(
      errorData?.message ?? `Failed to fetch notifications (${response.status})`
    );
  }

  const data = (await response.json()) as PaginatedResponse<NotificationResponse>;
  return data;
}

async function fetchUnreadCount(recipient: string): Promise<number> {
  const searchParams = new URLSearchParams();
  searchParams.set("countOnly", "true");
  searchParams.set("recipient", recipient);

  const url = `/api/notifications?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(
      errorData?.message ?? `Failed to fetch unread count (${response.status})`
    );
  }

  const data = (await response.json()) as { recipient: string; unreadCount: number };
  return data.unreadCount;
}

async function patchNotificationStatus(
  notificationId: string,
  status: "read" | "dismissed"
): Promise<NotificationResponse> {
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notificationId,
      status,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(
      errorData?.message ?? `Failed to update notification status (${response.status})`
    );
  }

  const data = (await response.json()) as NotificationResponse;
  return data;
}

async function postMarkAllAsRead(recipient: string): Promise<{ updatedCount: number }> {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "markAllRead",
      recipient,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(
      errorData?.message ?? `Failed to mark all notifications as read (${response.status})`
    );
  }

  const data = (await response.json()) as { recipient: string; updatedCount: number };
  return data;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Custom hook for managing notification state with polling.
 *
 * Polls /api/notifications at configurable intervals, tracks unread count,
 * and provides functions to mark notifications as read or dismissed.
 *
 * Usage:
 * ```ts
 * const {
 *   notifications,
 *   unreadCount,
 *   isLoading,
 *   error,
 *   markAsRead,
 *   markAsDismissed,
 *   markAllAsRead,
 *   refetch,
 * } = useNotifications({
 *   recipient: "agent@stockland.com.au",
 *   enabled: true,
 *   onNewNotification: (notifs) => console.log("New notifications:", notifs),
 * });
 * ```
 */
export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsResult {
  const {
    recipient,
    enabled = true,
    intervalMs = POLLING_INTERVAL_NOTIFICATIONS,
    limit = 50,
    type,
    status,
    onNewNotification,
    onError,
  } = options;

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<Error | null>(null);

  const previousUnreadIdsRef = useRef<Set<string>>(new Set());
  const onNewNotificationRef = useRef(onNewNotification);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const fetcher = useCallback(async (): Promise<PaginatedResponse<NotificationResponse>> => {
    const result = await fetchNotifications({
      page: 1,
      limit,
      type,
      status,
      recipient,
    });
    return result;
  }, [limit, type, status, recipient]);

  const handleSuccess = useCallback(
    (data: PaginatedResponse<NotificationResponse>) => {
      setNotifications(data.data);
      setTotal(data.total);

      // Calculate unread count from the fetched data
      const unreadNotifications = data.data.filter((n) => n.status === "unread");
      setUnreadCount(unreadNotifications.length);

      // If we have a recipient, also fetch the accurate unread count from the server
      // (since the paginated list may not include all unread notifications)
      if (recipient) {
        fetchUnreadCount(recipient)
          .then((count) => {
            setUnreadCount(count);
          })
          .catch((err) => {
            // Silently fail — we already have a local count from the fetched data
            console.error(
              "⚠️ Failed to fetch unread count:",
              err instanceof Error ? err.message : String(err)
            );
          });
      }

      // Detect new unread notifications
      const currentUnreadIds = new Set(unreadNotifications.map((n) => n.id));
      const previousIds = previousUnreadIdsRef.current;

      const newNotifications = unreadNotifications.filter(
        (n) => !previousIds.has(n.id)
      );

      if (newNotifications.length > 0 && previousIds.size > 0 && onNewNotificationRef.current) {
        onNewNotificationRef.current(newNotifications);
      }

      previousUnreadIdsRef.current = currentUnreadIds;
    },
    [recipient]
  );

  const handleError = useCallback((err: Error) => {
    if (onErrorRef.current) {
      onErrorRef.current(err);
    }
  }, []);

  const {
    isLoading: pollingLoading,
    error: pollingError,
    isPolling,
    start,
    stop,
    refetch: pollingRefetch,
    lastFetchedAt,
  } = usePolling<PaginatedResponse<NotificationResponse>>({
    fetcher,
    intervalMs,
    enabled,
    fetchOnMount: true,
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const markAsRead = useCallback(
    async (notificationId: string): Promise<void> => {
      setActionLoading(true);
      setActionError(null);

      try {
        const updated = await patchNotificationStatus(notificationId, "read");

        // Optimistically update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, status: updated.status } : n
          )
        );

        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setActionError(error);
        if (onErrorRef.current) {
          onErrorRef.current(error);
        }
        throw error;
      } finally {
        setActionLoading(false);
      }
    },
    []
  );

  const markAsDismissed = useCallback(
    async (notificationId: string): Promise<void> => {
      setActionLoading(true);
      setActionError(null);

      try {
        const updated = await patchNotificationStatus(notificationId, "dismissed");

        // Optimistically update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, status: updated.status } : n
          )
        );

        // If the notification was unread, decrement the count
        const wasUnread = notifications.find(
          (n) => n.id === notificationId && n.status === "unread"
        );
        if (wasUnread) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setActionError(error);
        if (onErrorRef.current) {
          onErrorRef.current(error);
        }
        throw error;
      } finally {
        setActionLoading(false);
      }
    },
    [notifications]
  );

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!recipient) {
      throw new Error("Cannot mark all as read without a recipient.");
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await postMarkAllAsRead(recipient);

      // Optimistically update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.status === "unread" ? { ...n, status: "read" } : n
        )
      );

      setUnreadCount(0);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setActionError(error);
      if (onErrorRef.current) {
        onErrorRef.current(error);
      }
      throw error;
    } finally {
      setActionLoading(false);
    }
  }, [recipient]);

  const refetch = useCallback(async (): Promise<void> => {
    await pollingRefetch();
  }, [pollingRefetch]);

  const isLoading = pollingLoading || actionLoading;
  const error = actionError ?? pollingError;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    isPolling,
    markAsRead,
    markAsDismissed,
    markAllAsRead,
    refetch,
    start,
    stop,
    total,
    lastFetchedAt,
  };
}

export default useNotifications;