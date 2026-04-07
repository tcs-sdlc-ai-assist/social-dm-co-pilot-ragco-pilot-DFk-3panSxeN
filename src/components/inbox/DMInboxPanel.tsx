"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useDMs } from "@/hooks/useDMs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  PLATFORM_BG_COLORS,
  DM_STATUS_LABELS,
} from "@/lib/constants";
import type { DMResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DMInboxPanelProps {
  /** Callback when a DM is selected */
  onSelectDM?: (dm: DMResponse) => void;
  /** Currently selected DM ID (controlled) */
  selectedDMId?: string | null;
  /** Optional additional CSS classes */
  className?: string;
  /** Whether to enable polling (default: true) */
  enablePolling?: boolean;
  /** Initial status filter */
  initialStatus?: string;
  /** Initial platform filter */
  initialPlatform?: string;
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

// ─── Search Icon ─────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className: string }) {
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
      <path d="m15 18-6-6 6-6" />
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

function truncateMessage(message: string, maxLength: number = 100): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength).trim() + "…";
}

// ─── Filter Options ──────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "drafted", label: "Drafted" },
  { value: "replied", label: "Replied" },
  { value: "sent", label: "Sent" },
  { value: "escalated", label: "Escalated" },
];

const PLATFORM_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Platforms" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter" },
  { value: "linkedin", label: "LinkedIn" },
];

// ─── DM List Item ────────────────────────────────────────────────────────────

interface DMListItemProps {
  dm: DMResponse;
  isSelected: boolean;
  onSelect: (dm: DMResponse) => void;
}

function DMListItem({ dm, isSelected, onSelect }: DMListItemProps) {
  const platformColor = PLATFORM_COLORS[dm.platform] ?? "text-gray-500";
  const platformBg = PLATFORM_BG_COLORS[dm.platform] ?? "bg-gray-100";
  const platformLabel = PLATFORM_LABELS[dm.platform] ?? dm.platform;

  const handleClick = useCallback(() => {
    onSelect(dm);
  }, [dm, onSelect]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(dm);
      }
    },
    [dm, onSelect]
  );

  const isNew = dm.status === "new";

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
      }`}
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
                isNew ? "font-semibold text-stockland-charcoal" : "font-medium text-gray-700"
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
          {truncateMessage(dm.message, 120)}
        </p>

        {/* Footer row: status badge + draft info */}
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
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-gray-400"
          aria-hidden="true"
        >
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-stockland-charcoal">
        {hasFilters ? "No DMs match your filters" : "No DMs yet"}
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Try adjusting your filters or search query."
          : "Incoming social media DMs will appear here."}
      </p>
    </div>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-0" aria-label="Loading DMs">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse gap-3 border-b border-gray-100 px-4 py-3"
        >
          <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-gray-200" />
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

// ─── Error State ─────────────────────────────────────────────────────────────

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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-red-500"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-stockland-charcoal">
        Failed to load DMs
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
 * Social DM Inbox Panel component.
 *
 * Displays a list of incoming DMs with timestamps, platform icons
 * (Facebook/Instagram), sender info, message preview, and status tags
 * (New, Drafted, Sent, Escalated). Supports filtering by status and
 * platform, and free-text search. Clicking a DM selects it for
 * draft viewing.
 *
 * Uses the useDMs hook for state management and polling.
 *
 * Features:
 * - Platform icons with color coding (Instagram pink, Facebook blue)
 * - Status badges (New, Drafted, Replied, Sent, Escalated)
 * - Unread indicator dot for "new" DMs
 * - Free-text search on message/sender
 * - Filter by status and platform
 * - Pagination controls
 * - Loading skeleton state
 * - Error state with retry
 * - Empty state with contextual messaging
 * - Keyboard navigation support
 * - Accessible with ARIA attributes
 *
 * Usage:
 * ```tsx
 * <DMInboxPanel
 *   onSelectDM={(dm) => setSelectedDM(dm)}
 *   selectedDMId={selectedDM?.id}
 * />
 * ```
 */
export function DMInboxPanel({
  onSelectDM,
  selectedDMId = null,
  className = "",
  enablePolling = true,
  initialStatus,
  initialPlatform,
}: DMInboxPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    dms,
    selectedDM,
    filters,
    isLoading,
    error,
    isPolling,
    total,
    totalPages,
    selectDM,
    clearSelection,
    setPlatformFilter,
    setStatusFilter,
    setSearch,
    setPage,
    resetFilters,
    refetch,
    statusCounts,
  } = useDMs({
    enabled: enablePolling,
    initialStatus,
    initialPlatform,
  });

  // Debounced search
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchInput(value);

      if (searchTimeoutRef.current !== null) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        setSearch(value.trim().length > 0 ? value.trim() : undefined);
      }, 300);
    },
    [setSearch]
  );

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current !== null) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleStatusFilterChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setStatusFilter(value || undefined);
    },
    [setStatusFilter]
  );

  const handlePlatformFilterChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setPlatformFilter(value || undefined);
    },
    [setPlatformFilter]
  );

  const handleSelectDM = useCallback(
    (dm: DMResponse) => {
      selectDM(dm.id);
      if (onSelectDM) {
        onSelectDM(dm);
      }
    },
    [selectDM, onSelectDM]
  );

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleResetFilters = useCallback(() => {
    setSearchInput("");
    resetFilters();
  }, [resetFilters]);

  const handlePreviousPage = useCallback(() => {
    if (filters.page > 1) {
      setPage(filters.page - 1);
    }
  }, [filters.page, setPage]);

  const handleNextPage = useCallback(() => {
    if (filters.page < totalPages) {
      setPage(filters.page + 1);
    }
  }, [filters.page, totalPages, setPage]);

  const hasFilters = Boolean(
    filters.platform || filters.status || filters.search
  );

  const newDMCount = useMemo(() => {
    return statusCounts["new"] ?? 0;
  }, [statusCounts]);

  return (
    <div
      className={`flex h-full flex-col border-r border-gray-200 bg-white ${className}`.trim()}
      role="region"
      aria-label="DM Inbox"
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-stockland-charcoal">
              Inbox
            </h2>
            {total > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                {total}
              </span>
            )}
            {newDMCount > 0 && (
              <span
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700"
                aria-label={`${newDMCount} new DM${newDMCount !== 1 ? "s" : ""}`}
              >
                {newDMCount} new
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
              aria-label="Refresh inbox"
            >
              <RefreshIcon
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search DMs..."
            className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
            aria-label="Search DMs by message or sender"
          />
        </div>

        {/* Filters */}
        <div className="mt-2 flex items-center gap-2">
          <select
            value={filters.status ?? ""}
            onChange={handleStatusFilterChange}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
            aria-label="Filter by status"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.platform ?? ""}
            onChange={handlePlatformFilterChange}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
            aria-label="Filter by platform"
          >
            {PLATFORM_FILTER_OPTIONS.map((option) => (
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
      </div>

      {/* DM List */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin"
        role="listbox"
        aria-label="DM messages"
      >
        {isLoading && dms.length === 0 ? (
          <LoadingSkeleton />
        ) : error && dms.length === 0 ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : dms.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          dms.map((dm) => (
            <DMListItem
              key={dm.id}
              dm={dm}
              isSelected={selectedDMId === dm.id}
              onSelect={handleSelectDM}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 border-t border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page {filters.page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={filters.page <= 1}
                className="inline-flex items-center justify-center rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={filters.page >= totalPages}
                className="inline-flex items-center justify-center rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DMInboxPanel;