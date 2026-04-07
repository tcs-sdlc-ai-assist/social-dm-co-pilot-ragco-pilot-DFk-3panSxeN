"use client";

import { useState, useCallback, useMemo } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_STATUS_LABELS,
} from "@/lib/constants";
import type { NotificationResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationCenterProps {
  /** Optional recipient email override (defaults to session user email) */
  recipient?: string;
  /** Whether to enable polling (default: true) */
  enablePolling?: boolean;
  /** Maximum number of notifications to display */
  maxVisible?: number;
  /** Callback when a notification is clicked */
  onNotificationClick?: (notification: NotificationResponse) => void;
  /** Callback on any error */
  onError?: (error: Error) => void;
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Filter Options ──────────────────────────────────────────────────────────

const TYPE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Types" },
  { value: "high_priority_lead", label: "High Priority Lead" },
  { value: "sla_breach", label: "SLA Breach" },
  { value: "escalation", label: "Escalation" },
  { value: "salesforce_sync_success", label: "Salesforce Sync ✓" },
  { value: "salesforce_sync_failed", label: "Salesforce Sync ✗" },
  { value: "new_dm", label: "New DM" },
  { value: "unassigned_lead", label: "Unassigned Lead" },
  { value: "draft_ready", label: "Draft Ready" },
  { value: "draft_sent", label: "Draft Sent" },
  { value: "lead_assigned", label: "Lead Assigned" },
];

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "dismissed", label: "Dismissed" },
];

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

function CloudIcon({ className }: { className: string }) {
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
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
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

function XIcon({ className }: { className: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function RefreshIcon({ className }: { className: string }) {
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
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function CheckAllIcon({ className }: { className: string }) {
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
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}

// ─── Notification Type Config ────────────────────────────────────────────────

interface NotificationTypeConfig {
  icon: (props: { className: string }) => React.ReactNode;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
}

const NOTIFICATION_TYPE_CONFIG: Record<string, NotificationTypeConfig> = {
  high_priority_lead: {
    icon: FlagIcon,
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    accentColor: "text-red-700",
  },
  sla_breach: {
    icon: ClockIcon,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    accentColor: "text-orange-700",
  },
  escalation: {
    icon: AlertTriangleIcon,
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    accentColor: "text-red-800",
  },
  salesforce_sync_success: {
    icon: CheckCircleIcon,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    accentColor: "text-emerald-700",
  },
  salesforce_sync_failed: {
    icon: XCircleIcon,
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    accentColor: "text-red-700",
  },
  new_dm: {
    icon: InboxIcon,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    accentColor: "text-blue-700",
  },
  unassigned_lead: {
    icon: UserPlusIcon,
    iconColor: "text-yellow-500",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    accentColor: "text-yellow-700",
  },
  draft_ready: {
    icon: EditIcon,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    accentColor: "text-purple-700",
  },
  draft_sent: {
    icon: SendIcon,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    accentColor: "text-emerald-700",
  },
  lead_assigned: {
    icon: UserPlusIcon,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    accentColor: "text-blue-700",
  },
};

const DEFAULT_TYPE_CONFIG: NotificationTypeConfig = {
  icon: BellIcon,
  iconColor: "text-gray-500",
  bgColor: "bg-gray-50",
  borderColor: "border-gray-200",
  accentColor: "text-gray-700",
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
    hour: "2-digit",
    minute: "2-digit",
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

// ─── Sub-Components ──────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: NotificationResponse;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClick?: (notification: NotificationResponse) => void;
  isActionLoading: boolean;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
  onClick,
  isActionLoading,
}: NotificationItemProps) {
  const config = getTypeConfig(notification.type);
  const IconComponent = config.icon;
  const isUnread = notification.status === "unread";
  const isDismissed = notification.status === "dismissed";
  const urgent = isUrgentType(notification.type);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(notification);
    }
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
  }, [notification, onClick, isUnread, onMarkAsRead]);

  const handleMarkAsRead = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMarkAsRead(notification.id);
    },
    [notification.id, onMarkAsRead]
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss(notification.id);
    },
    [notification.id, onDismiss]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <div
      role="listitem"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex cursor-pointer gap-3 border-b px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stockland-green ${
        isUnread
          ? `${config.bgColor} ${config.borderColor} hover:brightness-95`
          : isDismissed
            ? "border-gray-100 bg-gray-50/50 opacity-60 hover:opacity-80"
            : "border-gray-100 bg-white hover:bg-gray-50"
      }`}
      data-notification-id={notification.id}
      data-notification-type={notification.type}
      data-notification-status={notification.status}
    >
      {/* Unread indicator */}
      {isUnread && (
        <span
          className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-500"
          aria-label="Unread"
        />
      )}

      {/* Urgent pulse indicator */}
      {isUnread && urgent && (
        <span
          className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 animate-ping rounded-full bg-red-400 opacity-75"
          aria-hidden="true"
        />
      )}

      {/* Type Icon */}
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
          isUnread ? config.bgColor : "bg-gray-100"
        }`}
      >
        <IconComponent
          className={`h-4.5 w-4.5 ${isUnread ? config.iconColor : "text-gray-400"}`}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header row: type label + timestamp */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`text-xs font-semibold ${
                isUnread ? config.accentColor : "text-gray-500"
              }`}
            >
              {getTypeLabel(notification.type)}
            </span>
            {urgent && isUnread && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                URGENT
              </span>
            )}
          </div>
          <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
            {formatTimestamp(notification.createdAt)}
          </span>
        </div>

        {/* Details */}
        {notification.details && (
          <p
            className={`mt-0.5 text-sm leading-snug ${
              isUnread ? "text-gray-700" : "text-gray-500"
            } line-clamp-3`}
          >
            {notification.details}
          </p>
        )}

        {/* Footer row: status badge + related info */}
        <div className="mt-1.5 flex items-center gap-2">
          <StatusBadge
            status={notification.status}
            variant="notification"
            size="sm"
          />
          {notification.dm && (
            <span className="text-xs text-gray-400">
              {notification.dm.senderName} · {notification.dm.platform}
            </span>
          )}
          {notification.lead && (
            <span className="text-xs text-gray-400">
              Lead: {notification.lead.name}
              {notification.lead.score > 0 && ` (${notification.lead.score}/10)`}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-shrink-0 flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {isUnread && (
          <button
            type="button"
            onClick={handleMarkAsRead}
            disabled={isActionLoading}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Mark as read"
            title="Mark as read"
          >
            <CheckCircleIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {!isDismissed && (
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isActionLoading}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <BellIcon className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-stockland-charcoal">
        {hasFilters ? "No notifications match your filters" : "All caught up!"}
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Try adjusting your filters to see more notifications."
          : "You have no notifications at the moment. New alerts will appear here."}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-0" aria-label="Loading notifications">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse gap-3 border-b border-gray-100 px-4 py-3"
        >
          <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="h-3 w-12 rounded bg-gray-200" />
            </div>
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-2/3 rounded bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <AlertTriangleIcon className="h-6 w-6 text-red-500" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-stockland-charcoal">
        Failed to load notifications
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-stockland-green px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-stockland-green-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-2"
      >
        <RefreshIcon className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Notification Center component displaying all active alerts.
 *
 * Displays high-priority lead notifications, SLA breach warnings,
 * Salesforce sync confirmations, escalation alerts, and other
 * notification types. Each notification shows a type-specific icon,
 * details, timestamp, and action buttons (mark as read, dismiss).
 *
 * Features:
 * - Real-time polling via useNotifications hook
 * - Type-specific icons and color coding:
 *   - Red flag: High-priority lead
 *   - Orange clock: SLA breach warning
 *   - Red triangle: Escalation alert
 *   - Green check: Salesforce sync success
 *   - Red X: Salesforce sync failure
 *   - Blue inbox: New DM
 *   - Yellow user: Unassigned lead
 *   - Purple edit: Draft ready
 *   - Green send: Draft sent
 *   - Blue user+: Lead assigned
 * - Unread indicator dot with pulse animation for urgent types
 * - "URGENT" badge for SLA breaches, escalations, and high-priority leads
 * - Filter by notification type and status
 * - "Mark All as Read" button
 * - Dismiss individual notifications
 * - Click to mark as read and trigger callback
 * - Loading skeleton state
 * - Error state with retry
 * - Empty state with contextual messaging
 * - Keyboard navigation support
 * - Accessible with ARIA attributes
 *
 * Usage:
 * ```tsx
 * <NotificationCenter
 *   onNotificationClick={(notif) => handleNotificationClick(notif)}
 * />
 * ```
 */
export function NotificationCenter({
  recipient: recipientProp,
  enablePolling = true,
  maxVisible = 50,
  onNotificationClick,
  onError,
  className = "",
}: NotificationCenterProps) {
  const { data: session } = useSession();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(
    new Set()
  );

  const userEmail = recipientProp ?? session?.user?.email ?? undefined;

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    isPolling,
    markAsRead,
    markAsDismissed,
    markAllAsRead,
    refetch,
    total,
    lastFetchedAt,
  } = useNotifications({
    recipient: userEmail,
    enabled: enablePolling && Boolean(userEmail),
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    limit: maxVisible,
    onError,
  });

  // ─── Filtered Notifications ──────────────────────────────────────────────

  const filteredNotifications = useMemo(() => {
    return notifications;
  }, [notifications]);

  const urgentCount = useMemo(() => {
    return notifications.filter(
      (n) => n.status === "unread" && isUrgentType(n.type)
    ).length;
  }, [notifications]);

  const hasFilters = Boolean(typeFilter || statusFilter);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      setActionLoadingIds((prev) => new Set(prev).add(notificationId));
      try {
        await markAsRead(notificationId);
      } catch (err) {
        if (onError) {
          onError(
            err instanceof Error ? err : new Error(String(err))
          );
        }
      } finally {
        setActionLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(notificationId);
          return next;
        });
      }
    },
    [markAsRead, onError]
  );

  const handleDismiss = useCallback(
    async (notificationId: string) => {
      setActionLoadingIds((prev) => new Set(prev).add(notificationId));
      try {
        await markAsDismissed(notificationId);
      } catch (err) {
        if (onError) {
          onError(
            err instanceof Error ? err : new Error(String(err))
          );
        }
      } finally {
        setActionLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(notificationId);
          return next;
        });
      }
    },
    [markAsDismissed, onError]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [markAllAsRead, onError]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleTypeFilterChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setTypeFilter(event.target.value);
    },
    []
  );

  const handleStatusFilterChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setStatusFilter(event.target.value);
    },
    []
  );

  const handleResetFilters = useCallback(() => {
    setTypeFilter("");
    setStatusFilter("");
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex h-full flex-col bg-white ${className}`.trim()}
      role="region"
      aria-label="Notification Center"
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellIcon className="h-5 w-5 text-stockland-green" />
            <h2 className="text-base font-semibold text-stockland-charcoal">
              Notifications
            </h2>
            {total > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                {total}
              </span>
            )}
            {unreadCount > 0 && (
              <span
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700"
                aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
              >
                {unreadCount} new
              </span>
            )}
            {urgentCount > 0 && (
              <span
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-bold text-red-700"
                aria-label={`${urgentCount} urgent notification${urgentCount !== 1 ? "s" : ""}`}
              >
                {urgentCount} urgent
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isPolling && (
              <span
                className="h-2 w-2 rounded-full bg-green-400"
                title="Live updates active"
                aria-label="Live updates active"
              />
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:opacity-50"
              aria-label="Refresh notifications"
            >
              <RefreshIcon
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-2 flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={handleTypeFilterChange}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
            aria-label="Filter by notification type"
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
            aria-label="Filter by notification status"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex-shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-stockland-green transition-colors hover:bg-stockland-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
              aria-label="Clear all filters"
            >
              Clear
            </button>
          )}
        </div>

        {/* Mark All as Read */}
        {unreadCount > 0 && (
          <div className="mt-2 flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleMarkAllAsRead()}
              disabled={isLoading}
              leftIcon={<CheckAllIcon className="h-3.5 w-3.5" />}
            >
              Mark all as read
            </Button>
          </div>
        )}
      </div>

      {/* Notification List */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin"
        role="list"
        aria-label="Notification list"
      >
        {isLoading && filteredNotifications.length === 0 ? (
          <LoadingSkeleton />
        ) : error && filteredNotifications.length === 0 ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : filteredNotifications.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={(id) => void handleMarkAsRead(id)}
              onDismiss={(id) => void handleDismiss(id)}
              onClick={onNotificationClick}
              isActionLoading={actionLoadingIds.has(notification.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {lastFetchedAt && filteredNotifications.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Last updated: {formatTimestamp(lastFetchedAt.toISOString())}
            </span>
            <span className="text-xs text-gray-400">
              {filteredNotifications.length} of {total} notification
              {total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;