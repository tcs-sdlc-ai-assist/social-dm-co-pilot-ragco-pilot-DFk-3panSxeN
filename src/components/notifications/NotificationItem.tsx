"use client";

import { useCallback } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  NOTIFICATION_TYPE_LABELS,
} from "@/lib/constants";
import type { NotificationResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationItemProps {
  /** The notification data to display */
  notification: NotificationResponse;
  /** Callback when the notification is clicked */
  onClick?: (notification: NotificationResponse) => void;
  /** Callback when "Mark as Read" is clicked */
  onMarkAsRead?: (notificationId: string) => void;
  /** Callback when "Dismiss" is clicked */
  onDismiss?: (notificationId: string) => void;
  /** Callback when "View DM" is clicked */
  onViewDM?: (dmId: string) => void;
  /** Callback when "View Lead" is clicked */
  onViewLead?: (leadId: string) => void;
  /** Whether any action is currently loading for this item */
  isActionLoading?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Notification Type Config ────────────────────────────────────────────────

interface NotificationTypeConfig {
  icon: (props: { className: string }) => React.ReactNode;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

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

function EyeIcon({ className }: { className: string }) {
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── Type Config Map ─────────────────────────────────────────────────────────

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

function getSeverityLevel(type: string): "critical" | "warning" | "info" | "success" {
  switch (type) {
    case "escalation":
    case "salesforce_sync_failed":
      return "critical";
    case "sla_breach":
    case "high_priority_lead":
    case "unassigned_lead":
      return "warning";
    case "salesforce_sync_success":
    case "draft_sent":
      return "success";
    default:
      return "info";
  }
}

function getSeverityBorderClass(severity: "critical" | "warning" | "info" | "success"): string {
  switch (severity) {
    case "critical":
      return "border-l-red-500";
    case "warning":
      return "border-l-orange-400";
    case "success":
      return "border-l-emerald-500";
    case "info":
      return "border-l-blue-400";
    default:
      return "border-l-gray-300";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Individual notification item component.
 *
 * Displays a notification with:
 * - Type-specific icon with color coding based on severity
 * - Notification type label with optional "URGENT" badge
 * - Message details including DM sender info, elapsed time, and lead info
 * - Relative timestamp (e.g., "5m ago", "2h ago")
 * - Status badge (Unread, Read, Dismissed)
 * - Action buttons: "View DM", "View Lead", "Mark as Read", "Dismiss"
 * - Color-coded left border by severity:
 *   - Red: Critical (escalation, Salesforce sync failed)
 *   - Orange: Warning (SLA breach, high-priority lead, unassigned lead)
 *   - Green: Success (Salesforce sync success, draft sent)
 *   - Blue: Info (new DM, draft ready, lead assigned)
 * - Unread indicator dot with pulse animation for urgent types
 * - Keyboard navigation support (Enter/Space to click)
 * - Accessible with ARIA attributes
 *
 * Usage:
 * ```tsx
 * <NotificationItem
 *   notification={notificationData}
 *   onClick={(notif) => handleClick(notif)}
 *   onMarkAsRead={(id) => markAsRead(id)}
 *   onDismiss={(id) => dismiss(id)}
 *   onViewDM={(dmId) => navigateToDM(dmId)}
 *   onViewLead={(leadId) => navigateToLead(leadId)}
 * />
 * ```
 */
export function NotificationItem({
  notification,
  onClick,
  onMarkAsRead,
  onDismiss,
  onViewDM,
  onViewLead,
  isActionLoading = false,
  className = "",
}: NotificationItemProps) {
  const config = getTypeConfig(notification.type);
  const IconComponent = config.icon;
  const isUnread = notification.status === "unread";
  const isDismissed = notification.status === "dismissed";
  const urgent = isUrgentType(notification.type);
  const severity = getSeverityLevel(notification.type);
  const severityBorderClass = getSeverityBorderClass(severity);

  const hasDM = Boolean(notification.dmId);
  const hasLead = Boolean(notification.leadId);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(notification);
    }
    if (isUnread && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  }, [notification, onClick, isUnread, onMarkAsRead]);

  const handleMarkAsRead = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onMarkAsRead) {
        onMarkAsRead(notification.id);
      }
    },
    [notification.id, onMarkAsRead]
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDismiss) {
        onDismiss(notification.id);
      }
    },
    [notification.id, onDismiss]
  );

  const handleViewDM = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onViewDM && notification.dmId) {
        onViewDM(notification.dmId);
      }
    },
    [notification.dmId, onViewDM]
  );

  const handleViewLead = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onViewLead && notification.leadId) {
        onViewLead(notification.leadId);
      }
    },
    [notification.leadId, onViewLead]
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

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div
      role="listitem"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex cursor-pointer gap-3 border-b border-l-4 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stockland-green ${severityBorderClass} ${
        isUnread
          ? `${config.bgColor} ${config.borderColor} hover:brightness-95`
          : isDismissed
            ? "border-b-gray-100 bg-gray-50/50 opacity-60 hover:opacity-80"
            : "border-b-gray-100 bg-white hover:bg-gray-50"
      } ${className}`.trim()}
      data-notification-id={notification.id}
      data-notification-type={notification.type}
      data-notification-status={notification.status}
      data-notification-severity={severity}
      aria-label={`${getTypeLabel(notification.type)} notification${isUnread ? " (unread)" : ""}${urgent ? " — urgent" : ""}`}
    >
      {/* Unread indicator */}
      {isUnread && (
        <span
          className="absolute left-5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-500"
          aria-label="Unread"
        />
      )}

      {/* Urgent pulse indicator */}
      {isUnread && urgent && (
        <span
          className="absolute left-5 top-1/2 h-2 w-2 -translate-y-1/2 animate-ping rounded-full bg-red-400 opacity-75"
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
          className={`h-4 w-4 ${isUnread ? config.iconColor : "text-gray-400"}`}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header row: type label + urgent badge + timestamp */}
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

        {/* Related entity info */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusBadge
            status={notification.status}
            variant="notification"
            size="sm"
          />

          {/* DM sender info */}
          {notification.dm && (
            <span className="text-xs text-gray-400">
              {notification.dm.senderName} · {notification.dm.platform.charAt(0).toUpperCase() + notification.dm.platform.slice(1)}
            </span>
          )}

          {/* Lead info */}
          {notification.lead && (
            <span className="text-xs text-gray-400">
              Lead: {notification.lead.name}
              {notification.lead.score > 0 && (
                <span className="ml-0.5 font-medium">
                  ({notification.lead.score}/10)
                </span>
              )}
              {notification.lead.priorityFlag && (
                <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-1 py-0.5 text-[10px] font-bold text-red-700">
                  HIGH
                </span>
              )}
            </span>
          )}

          {/* Budget info from lead */}
          {notification.lead?.budget && (
            <span className="text-xs text-gray-400">
              Budget: {notification.lead.budget}
            </span>
          )}

          {/* Location info from lead */}
          {notification.lead?.location && (
            <span className="text-xs text-gray-400">
              Location: {notification.lead.location}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {/* View DM button */}
          {hasDM && onViewDM && (
            <button
              type="button"
              onClick={handleViewDM}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="View DM"
            >
              <EyeIcon className="h-3 w-3" />
              <span>View DM</span>
            </button>
          )}

          {/* View Lead button */}
          {hasLead && onViewLead && (
            <button
              type="button"
              onClick={handleViewLead}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="View Lead"
            >
              <UserPlusIcon className="h-3 w-3" />
              <span>View Lead</span>
            </button>
          )}

          {/* Mark as Read button */}
          {isUnread && onMarkAsRead && (
            <button
              type="button"
              onClick={handleMarkAsRead}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Mark as read"
              title="Mark as read"
            >
              <CheckCircleIcon className="h-3 w-3" />
              <span>Read</span>
            </button>
          )}

          {/* Dismiss button */}
          {!isDismissed && onDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Dismiss notification"
              title="Dismiss"
            >
              <XIcon className="h-3 w-3" />
              <span>Dismiss</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick action icons (visible on hover, compact) */}
      <div className="flex flex-shrink-0 flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {isUnread && onMarkAsRead && (
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
        {!isDismissed && onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isActionLoading}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
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

export default NotificationItem;