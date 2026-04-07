"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/hooks/useNotifications";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  NOTIFICATION_TYPE_LABELS,
} from "@/lib/constants";
import type { NotificationResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationBellProps {
  /** Optional recipient email override (defaults to session user email) */
  recipient?: string;
  /** Maximum number of notifications to show in the dropdown preview */
  maxPreviewItems?: number;
  /** Callback when a notification is clicked in the dropdown */
  onNotificationClick?: (notification: NotificationResponse) => void;
  /** Callback when "View All" is clicked */
  onViewAll?: () => void;
  /** Whether to enable polling (default: true) */
  enablePolling?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function BellIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function FlagIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

function ClockIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function XCircleIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function InboxIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

function SendIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function EditIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ─── Notification Type Config ────────────────────────────────────────────────

interface NotificationTypeConfig {
  icon: (props: { className: string }) => React.ReactNode;
  iconColor: string;
  bgColor: string;
}

const NOTIFICATION_TYPE_CONFIG: Record<string, NotificationTypeConfig> = {
  high_priority_lead: {
    icon: FlagIcon,
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
  },
  sla_breach: {
    icon: ClockIcon,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-50",
  },
  escalation: {
    icon: AlertTriangleIcon,
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
  },
  salesforce_sync_success: {
    icon: CheckCircleIcon,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50",
  },
  salesforce_sync_failed: {
    icon: XCircleIcon,
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
  },
  new_dm: {
    icon: InboxIcon,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  unassigned_lead: {
    icon: UserPlusIcon,
    iconColor: "text-yellow-500",
    bgColor: "bg-yellow-50",
  },
  draft_ready: {
    icon: EditIcon,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-50",
  },
  draft_sent: {
    icon: SendIcon,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50",
  },
  lead_assigned: {
    icon: UserPlusIcon,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
  },
};

const DEFAULT_TYPE_CONFIG: NotificationTypeConfig = {
  icon: BellIcon,
  iconColor: "text-gray-500",
  bgColor: "bg-gray-50",
};

function getTypeConfig(type: string): NotificationTypeConfig {
  return NOTIFICATION_TYPE_CONFIG[type] ?? DEFAULT_TYPE_CONFIG;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

function getTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}

function isUrgentType(type: string): boolean {
  return (
    type === "sla_breach" ||
    type === "escalation" ||
    type === "high_priority_lead" ||
    type === "salesforce_sync_failed"
  );
}

// ─── Preview Item ────────────────────────────────────────────────────────────

interface PreviewItemProps {
  notification: NotificationResponse;
  onClick: (notification: NotificationResponse) => void;
}

function PreviewItem({ notification, onClick }: PreviewItemProps) {
  const config = getTypeConfig(notification.type);
  const IconComponent = config.icon;
  const isUnread = notification.status === "unread";
  const urgent = isUrgentType(notification.type);

  const handleClick = useCallback(() => {
    onClick(notification);
  }, [notification, onClick]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick(notification);
      }
    },
    [notification, onClick]
  );

  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`flex cursor-pointer gap-2.5 px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stockland-green ${
        isUnread
          ? "bg-blue-50/50 hover:bg-blue-50"
          : "bg-white hover:bg-gray-50"
      }`}
    >
      {/* Unread dot */}
      {isUnread && (
        <span className="mt-1.5 flex-shrink-0">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              urgent ? "bg-red-500" : "bg-blue-500"
            }`}
            aria-label="Unread"
          />
        </span>
      )}

      {/* Icon */}
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${config.bgColor}`}
      >
        <IconComponent className={`h-3.5 w-3.5 ${config.iconColor}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span
            className={`truncate text-xs font-semibold ${
              isUnread ? "text-gray-800" : "text-gray-500"
            }`}
          >
            {getTypeLabel(notification.type)}
          </span>
          <span className="flex-shrink-0 text-[10px] text-gray-400 whitespace-nowrap">
            {formatTimestamp(notification.createdAt)}
          </span>
        </div>
        {notification.details && (
          <p
            className={`mt-0.5 text-xs leading-snug ${
              isUnread ? "text-gray-600" : "text-gray-400"
            } line-clamp-2`}
          >
            {notification.details}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyDropdownState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <BellIcon className="h-8 w-8 text-gray-300" />
      <p className="mt-2 text-xs font-medium text-gray-500">
        All caught up!
      </p>
      <p className="mt-0.5 text-[10px] text-gray-400">
        No new notifications.
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Notification bell icon component for the header.
 *
 * Shows an unread notification count badge on the bell icon.
 * Clicking opens a dropdown preview of recent notifications
 * with a link to the full Notification Center.
 *
 * Features:
 * - Bell icon with unread count badge (red circle)
 * - Badge shows "99+" when count exceeds 99
 * - Dropdown preview of recent notifications (configurable max)
 * - Each notification shows type icon, label, details, and timestamp
 * - Unread indicator dot (blue for normal, red for urgent)
 * - "Mark all as read" button in dropdown header
 * - "View All Notifications" link at dropdown footer
 * - Click notification to mark as read and trigger callback
 * - Dropdown closes on outside click or Escape key
 * - Accessible with ARIA attributes and keyboard navigation
 * - Polls for new notifications via useNotifications hook
 *
 * Usage:
 * ```tsx
 * <NotificationBell
 *   onNotificationClick={(notif) => router.push(`/notifications/${notif.id}`)}
 *   onViewAll={() => router.push("/notifications")}
 * />
 * ```
 */
export function NotificationBell({
  recipient: recipientProp,
  maxPreviewItems = 5,
  onNotificationClick,
  onViewAll,
  enablePolling = true,
  className = "",
}: NotificationBellProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const userEmail = recipientProp ?? session?.user?.email ?? undefined;

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications({
    recipient: userEmail,
    enabled: enablePolling && Boolean(userEmail),
    limit: maxPreviewItems,
  });

  const displayUnreadCount = unreadCount > 99 ? "99+" : String(unreadCount);

  // Preview items: show only the first maxPreviewItems
  const previewNotifications = notifications.slice(0, maxPreviewItems);

  // ─── Toggle Dropdown ───────────────────────────────────────────────────

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ─── Close on outside click ────────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // ─── Close on Escape key ──────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // ─── Notification Click Handler ────────────────────────────────────────

  const handleNotificationClick = useCallback(
    async (notification: NotificationResponse) => {
      if (notification.status === "unread") {
        try {
          await markAsRead(notification.id);
        } catch {
          // Silently fail — the click action should still proceed
        }
      }

      if (onNotificationClick) {
        onNotificationClick(notification);
      }

      closeDropdown();
    },
    [markAsRead, onNotificationClick, closeDropdown]
  );

  // ─── Mark All as Read Handler ──────────────────────────────────────────

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch {
      // Silently fail — UI will update on next poll
    }
  }, [markAllAsRead]);

  // ─── View All Handler ──────────────────────────────────────────────────

  const handleViewAll = useCallback(() => {
    closeDropdown();
    if (onViewAll) {
      onViewAll();
    }
  }, [onViewAll, closeDropdown]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className={`relative ${className}`.trim()}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className="relative inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
        aria-label={
          unreadCount > 0
            ? `Notifications — ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {displayUnreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-1 w-80 origin-top-right rounded-lg border border-gray-200 bg-white shadow-lg"
          role="menu"
          aria-orientation="vertical"
          aria-label="Notification preview"
        >
          {/* Dropdown Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-stockland-charcoal">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-100 px-1 text-[10px] font-bold text-blue-700">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                className="text-xs font-medium text-stockland-green transition-colors hover:text-stockland-green-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 rounded-md px-1.5 py-0.5"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {previewNotifications.length === 0 ? (
              <EmptyDropdownState />
            ) : (
              <div className="divide-y divide-gray-50">
                {previewNotifications.map((notification) => (
                  <PreviewItem
                    key={notification.id}
                    notification={notification}
                    onClick={(n) => void handleNotificationClick(n)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="border-t border-gray-100">
            <a
              href="/notifications"
              onClick={(e) => {
                if (onViewAll) {
                  e.preventDefault();
                  handleViewAll();
                }
              }}
              className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-medium text-stockland-green transition-colors hover:bg-stockland-green/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stockland-green rounded-b-lg"
              role="menuitem"
            >
              <span>View All Notifications</span>
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;