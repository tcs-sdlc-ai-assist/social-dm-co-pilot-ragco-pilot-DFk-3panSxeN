"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  PLATFORM_BG_COLORS,
  DM_STATUS_LABELS,
} from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DMInboxFiltersProps {
  /** Current status filter value */
  statusFilter?: string;
  /** Current platform filter value */
  platformFilter?: string;
  /** Current search query */
  searchQuery?: string;
  /** Callback when status filter changes */
  onStatusChange?: (status: string | undefined) => void;
  /** Callback when platform filter changes */
  onPlatformChange?: (platform: string | undefined) => void;
  /** Callback when search query changes (debounced) */
  onSearchChange?: (search: string | undefined) => void;
  /** Callback when all filters are reset */
  onReset?: () => void;
  /** Whether the filters are currently loading/disabled */
  isLoading?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Filter Options ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "drafted", label: "Drafted" },
  { value: "replied", label: "Replied" },
  { value: "sent", label: "Sent" },
  { value: "escalated", label: "Escalated" },
];

const PLATFORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Platforms" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter" },
  { value: "linkedin", label: "LinkedIn" },
];

// ─── Icons ───────────────────────────────────────────────────────────────────

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

function CloseIcon({ className }: { className: string }) {
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

function FilterIcon({ className }: { className: string }) {
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
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Filter bar for the DM inbox with dropdown filters for status and platform,
 * a search input for sender name / message filtering, and a reset button.
 *
 * Features:
 * - Status dropdown: All, New, Drafted, Replied, Sent, Escalated
 * - Platform dropdown: All, Instagram, Facebook, Twitter, LinkedIn
 * - Free-text search input with debounced onChange (300ms)
 * - Clear search button (X icon) when search has a value
 * - Reset all filters button (visible when any filter is active)
 * - Active filter count badge
 * - Accessible with ARIA labels and keyboard navigation
 * - Disabled state when isLoading is true
 *
 * Usage:
 * ```tsx
 * <DMInboxFilters
 *   statusFilter={filters.status}
 *   platformFilter={filters.platform}
 *   searchQuery={filters.search}
 *   onStatusChange={(status) => setStatusFilter(status)}
 *   onPlatformChange={(platform) => setPlatformFilter(platform)}
 *   onSearchChange={(search) => setSearch(search)}
 *   onReset={() => resetFilters()}
 * />
 * ```
 */
export function DMInboxFilters({
  statusFilter,
  platformFilter,
  searchQuery,
  onStatusChange,
  onPlatformChange,
  onSearchChange,
  onReset,
  isLoading = false,
  className = "",
}: DMInboxFiltersProps) {
  const [searchInput, setSearchInput] = useState(searchQuery ?? "");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external searchQuery prop changes to local state
  useEffect(() => {
    setSearchInput(searchQuery ?? "");
  }, [searchQuery]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current !== null) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchInput(value);

      if (searchTimeoutRef.current !== null) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        if (onSearchChange) {
          onSearchChange(value.trim().length > 0 ? value.trim() : undefined);
        }
      }, 300);
    },
    [onSearchChange]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");

    if (searchTimeoutRef.current !== null) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (onSearchChange) {
      onSearchChange(undefined);
    }
  }, [onSearchChange]);

  const handleStatusChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      if (onStatusChange) {
        onStatusChange(value || undefined);
      }
    },
    [onStatusChange]
  );

  const handlePlatformChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      if (onPlatformChange) {
        onPlatformChange(value || undefined);
      }
    },
    [onPlatformChange]
  );

  const handleReset = useCallback(() => {
    setSearchInput("");

    if (searchTimeoutRef.current !== null) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (onReset) {
      onReset();
    }
  }, [onReset]);

  const hasActiveFilters = Boolean(statusFilter || platformFilter || searchQuery);

  const activeFilterCount = [
    statusFilter,
    platformFilter,
    searchQuery,
  ].filter(Boolean).length;

  return (
    <div
      className={`flex flex-col gap-2 ${className}`.trim()}
      role="search"
      aria-label="DM inbox filters"
    >
      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Search DMs by sender or message..."
          disabled={isLoading}
          className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-8 text-sm text-gray-700 placeholder:text-gray-400 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Search DMs by sender name or message content"
        />
        {searchInput.length > 0 && (
          <button
            type="button"
            onClick={handleClearSearch}
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Clear search"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter Dropdowns Row */}
      <div className="flex items-center gap-2">
        {/* Status Filter */}
        <select
          value={statusFilter ?? ""}
          onChange={handleStatusChange}
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Platform Filter */}
        <select
          value={platformFilter ?? ""}
          onChange={handlePlatformChange}
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Filter by platform"
        >
          {PLATFORM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Reset / Active Filter Indicator */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-stockland-green transition-colors hover:bg-stockland-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Clear all filters"
          >
            <FilterIcon className="h-3 w-3" />
            <span>Clear</span>
            {activeFilterCount > 0 && (
              <span
                className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-stockland-green px-1 text-[10px] font-bold leading-none text-white"
                aria-label={`${activeFilterCount} active filter${activeFilterCount !== 1 ? "s" : ""}`}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default DMInboxFilters;