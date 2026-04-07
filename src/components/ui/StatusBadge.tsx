"use client";

import {
  DM_STATUS_LABELS,
  DRAFT_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  NOTIFICATION_STATUS_LABELS,
} from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StatusBadgeVariant = "dm" | "draft" | "lead" | "notification";

export interface StatusBadgeProps {
  /** The status value to display */
  status: string;
  /** The variant determines which label map and color scheme to use */
  variant?: StatusBadgeVariant;
  /** Optional size override */
  size?: "sm" | "md" | "lg";
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Color Maps ──────────────────────────────────────────────────────────────

const DM_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  drafted: "bg-yellow-100 text-yellow-800",
  replied: "bg-green-100 text-green-800",
  sent: "bg-emerald-100 text-emerald-800",
  escalated: "bg-red-100 text-red-800",
};

const DRAFT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  sent: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const NOTIFICATION_STATUS_COLORS: Record<string, string> = {
  unread: "bg-blue-100 text-blue-800",
  read: "bg-gray-100 text-gray-600",
  dismissed: "bg-gray-50 text-gray-400",
};

// ─── Size Classes ────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<string, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLabelMap(variant: StatusBadgeVariant): Record<string, string> {
  switch (variant) {
    case "dm":
      return DM_STATUS_LABELS;
    case "draft":
      return DRAFT_STATUS_LABELS;
    case "lead":
      return LEAD_STATUS_LABELS;
    case "notification":
      return NOTIFICATION_STATUS_LABELS;
    default:
      return DM_STATUS_LABELS;
  }
}

function getColorMap(variant: StatusBadgeVariant): Record<string, string> {
  switch (variant) {
    case "dm":
      return DM_STATUS_COLORS;
    case "draft":
      return DRAFT_STATUS_COLORS;
    case "lead":
      return LEAD_STATUS_COLORS;
    case "notification":
      return NOTIFICATION_STATUS_COLORS;
    default:
      return DM_STATUS_COLORS;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Reusable status badge component displaying status with color-coded styling.
 *
 * Supports DM statuses (New, Drafted, Replied, Sent, Escalated),
 * Draft statuses (Pending, Approved, Sent, Rejected),
 * Lead statuses (New, Contacted, Qualified, Converted, Lost),
 * and Notification statuses (Unread, Read, Dismissed).
 *
 * Renders an accessible badge with appropriate ARIA label.
 *
 * Usage:
 * ```tsx
 * <StatusBadge status="new" variant="dm" />
 * <StatusBadge status="approved" variant="draft" size="lg" />
 * <StatusBadge status="qualified" variant="lead" />
 * ```
 */
export function StatusBadge({
  status,
  variant = "dm",
  size = "md",
  className = "",
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().trim();

  const labelMap = getLabelMap(variant);
  const colorMap = getColorMap(variant);

  const label = labelMap[normalizedStatus] ?? status;
  const colorClasses = colorMap[normalizedStatus] ?? "bg-gray-100 text-gray-700";
  const sizeClasses = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  const ariaLabel = `Status: ${label}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${colorClasses} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

export default StatusBadge;