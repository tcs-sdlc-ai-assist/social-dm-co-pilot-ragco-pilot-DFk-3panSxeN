"use client";

import { useCallback } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  PLATFORM_BG_COLORS,
} from "@/lib/constants";
import type { DMResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DMInboxItemProps {
  /** The DM data to display */
  dm: DMResponse;
  /** Whether this item is currently selected */
  isSelected?: boolean;
  /** Callback when the item is clicked/selected */
  onSelect?: (dm: DMResponse) => void;
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Platform Icons ──────────────────────────────────────────────────────────

function InstagramIcon({ className }: { className: string }) {
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
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function getPlatformIcon(platform: string, className: string) {
  switch (platform.toLowerCase()) {
    case "instagram":
      return <InstagramIcon className={className} />;
    case "facebook":
      return <FacebookIcon className={className} />;
    case "twitter":
      return <TwitterIcon className={className} />;
    case "linkedin":
      return <LinkedInIcon className={className} />;
    default:
      return null;
  }
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

function truncateMessage(message: string, maxLength: number = 120): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength).trim() + "…";
}

function getLatestDraftConfidence(dm: DMResponse): number | null {
  if (!dm.drafts || dm.drafts.length === 0) return null;
  // Drafts are expected to be ordered by createdAt desc from the API
  const latestDraft = dm.drafts[0];
  return latestDraft.confidenceScore;
}

function getLatestDraftStatus(dm: DMResponse): string | null {
  if (!dm.drafts || dm.drafts.length === 0) return null;
  return dm.drafts[0].status;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Individual DM item in the inbox list.
 *
 * Displays sender name, platform badge (Instagram/Facebook icon with color),
 * message snippet, relative timestamp, status badge (New, Drafted, Sent, Escalated),
 * and confidence score meter if a draft exists. Highlights unread/new DMs with
 * a blue dot indicator and bolder text.
 *
 * Accessible with keyboard navigation (Enter/Space to select) and ARIA attributes.
 *
 * Features:
 * - Platform icon with color-coded background (Instagram pink, Facebook blue)
 * - Sender name and handle
 * - Truncated message preview (120 chars)
 * - Relative timestamp (e.g., "5m ago", "2h ago", "3d ago")
 * - Status badge (New, Drafted, Replied, Sent, Escalated)
 * - AI confidence meter for the latest draft (if exists)
 * - Unread indicator dot for "new" status DMs
 * - Selected state with left border accent
 * - Draft count and lead count indicators
 * - Keyboard navigation support (Enter/Space)
 * - ARIA role="option" with aria-selected
 *
 * Usage:
 * ```tsx
 * <DMInboxItem
 *   dm={dmData}
 *   isSelected={selectedDMId === dmData.id}
 *   onSelect={(dm) => setSelectedDM(dm)}
 * />
 * ```
 */
export function DMInboxItem({
  dm,
  isSelected = false,
  onSelect,
  className = "",
}: DMInboxItemProps) {
  const platformColor = PLATFORM_COLORS[dm.platform] ?? "text-gray-500";
  const platformBg = PLATFORM_BG_COLORS[dm.platform] ?? "bg-gray-100";
  const platformLabel = PLATFORM_LABELS[dm.platform] ?? dm.platform;

  const isNew = dm.status === "new";
  const latestConfidence = getLatestDraftConfidence(dm);
  const latestDraftStatus = getLatestDraftStatus(dm);

  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(dm);
    }
  }, [dm, onSelect]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (onSelect) {
          onSelect(dm);
        }
      }
    },
    [dm, onSelect]
  );

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex cursor-pointer gap-3 border-b border-gray-100 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stockland-green ${
        isSelected
          ? "bg-stockland-green/5 border-l-2 border-l-stockland-green"
          : "hover:bg-gray-50 border-l-2 border-l-transparent"
      } ${className}`.trim()}
      data-dm-id={dm.id}
      data-dm-status={dm.status}
    >
      {/* Unread indicator */}
      {isNew && (
        <span
          className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-500"
          aria-label="Unread"
        />
      )}

      {/* Platform icon */}
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${platformBg}`}
        title={platformLabel}
      >
        {getPlatformIcon(dm.platform, `h-4 w-4 ${platformColor}`)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header row: sender + timestamp */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`truncate text-sm ${
                isNew
                  ? "font-semibold text-stockland-charcoal"
                  : "font-medium text-gray-700"
              }`}
            >
              {dm.senderName}
            </span>
            <span className="flex-shrink-0 text-xs text-gray-400">
              {dm.senderHandle}
            </span>
          </div>
          <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
            {formatTimestamp(dm.timestamp)}
          </span>
        </div>

        {/* Message preview */}
        <p
          className={`mt-0.5 text-sm leading-snug ${
            isNew ? "text-gray-700" : "text-gray-500"
          } line-clamp-2`}
        >
          {truncateMessage(dm.message)}
        </p>

        {/* Footer row: status badge + draft info + confidence */}
        <div className="mt-1.5 flex items-center gap-2">
          <StatusBadge status={dm.status} variant="dm" size="sm" />

          {dm.drafts && dm.drafts.length > 0 && (
            <span className="text-xs text-gray-400">
              {dm.drafts.length} draft{dm.drafts.length !== 1 ? "s" : ""}
            </span>
          )}

          {dm.leads && dm.leads.length > 0 && (
            <span className="text-xs text-gray-400">
              {dm.leads.length} lead{dm.leads.length !== 1 ? "s" : ""}
            </span>
          )}

          {latestDraftStatus && latestDraftStatus !== "sent" && (
            <StatusBadge
              status={latestDraftStatus}
              variant="draft"
              size="sm"
            />
          )}
        </div>

        {/* Confidence meter for latest draft */}
        {latestConfidence !== null && (
          <div className="mt-1.5">
            <ConfidenceMeter
              score={latestConfidence}
              showLabel
              showTooltip={false}
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default DMInboxItem;