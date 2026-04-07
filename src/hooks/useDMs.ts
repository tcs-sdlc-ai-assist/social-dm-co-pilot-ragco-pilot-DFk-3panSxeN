"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { usePolling } from "@/hooks/usePolling";
import { POLLING_INTERVAL_DMS, DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type {
  DMResponse,
  PaginatedResponse,
  DMFilterParams,
  ApiErrorResponse,
} from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseDMsFilters {
  /** Filter by platform: "instagram" | "facebook" | "twitter" | "linkedin" */
  platform?: string;
  /** Filter by status: "new" | "drafted" | "replied" | "sent" | "escalated" */
  status?: string;
  /** Free-text search on message/sender */
  search?: string;
  /** Current page number (1-indexed) */
  page: number;
  /** Page size */
  limit: number;
}

export interface UseDMsOptions {
  /** Whether to start polling immediately (default: true) */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: POLLING_INTERVAL_DMS) */
  intervalMs?: number;
  /** Initial page size (default: DEFAULT_PAGE_SIZE) */
  initialLimit?: number;
  /** Initial platform filter */
  initialPlatform?: string;
  /** Initial status filter */
  initialStatus?: string;
  /** Initial search query */
  initialSearch?: string;
  /** Callback invoked when new DMs are detected */
  onNewDMs?: (dms: DMResponse[]) => void;
  /** Callback invoked on fetch error */
  onError?: (error: Error) => void;
}

export interface UseDMsResult {
  /** Array of DMs for the current page/filter */
  dms: DMResponse[];
  /** The currently selected DM, or null */
  selectedDM: DMResponse | null;
  /** Current filter state */
  filters: UseDMsFilters;
  /** Whether DMs are currently loading */
  isLoading: boolean;
  /** The most recent error, or null */
  error: Error | null;
  /** Whether polling is currently active */
  isPolling: boolean;
  /** Total number of DMs matching the current filter */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Timestamp of the last successful fetch */
  lastFetchedAt: Date | null;
  /** Select a DM by ID */
  selectDM: (dmId: string) => void;
  /** Clear the selected DM */
  clearSelection: () => void;
  /** Set the platform filter */
  setPlatformFilter: (platform: string | undefined) => void;
  /** Set the status filter */
  setStatusFilter: (status: string | undefined) => void;
  /** Set the search query */
  setSearch: (search: string | undefined) => void;
  /** Set the current page */
  setPage: (page: number) => void;
  /** Set the page size */
  setLimit: (limit: number) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;
  /** Manually refresh DMs */
  refetch: () => Promise<void>;
  /** Start polling */
  start: () => void;
  /** Stop polling */
  stop: () => void;
  /** Get counts by status from the current DM list */
  statusCounts: Record<string, number>;
  /** Get counts by platform from the current DM list */
  platformCounts: Record<string, number>;
}

// ─── Fetch Helper ────────────────────────────────────────────────────────────

async function fetchDMs(params: DMFilterParams): Promise<PaginatedResponse<DMResponse>> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.platform) searchParams.set("platform", params.platform);
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  const url = `/api/dms${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(
      errorData?.message ?? `Failed to fetch DMs (${response.status})`
    );
  }

  const data = (await response.json()) as PaginatedResponse<DMResponse>;
  return data;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Custom hook for managing DM inbox state with polling.
 *
 * Polls /api/dms at configurable intervals, supports filtering by
 * status, platform, and free-text search. Tracks DM selection state
 * and provides pagination controls.
 *
 * Usage:
 * ```ts
 * const {
 *   dms,
 *   selectedDM,
 *   filters,
 *   isLoading,
 *   error,
 *   selectDM,
 *   clearSelection,
 *   setPlatformFilter,
 *   setStatusFilter,
 *   setSearch,
 *   setPage,
 *   resetFilters,
 *   refetch,
 *   total,
 *   totalPages,
 *   statusCounts,
 *   platformCounts,
 * } = useDMs({
 *   enabled: true,
 *   initialStatus: "new",
 *   onNewDMs: (newDMs) => console.log("New DMs:", newDMs),
 * });
 * ```
 */
export function useDMs(options: UseDMsOptions = {}): UseDMsResult {
  const {
    enabled = true,
    intervalMs = POLLING_INTERVAL_DMS,
    initialLimit = DEFAULT_PAGE_SIZE,
    initialPlatform,
    initialStatus,
    initialSearch,
    onNewDMs,
    onError,
  } = options;

  // ─── Filter State ────────────────────────────────────────────────────────

  const [filters, setFilters] = useState<UseDMsFilters>({
    platform: initialPlatform,
    status: initialStatus,
    search: initialSearch,
    page: 1,
    limit: initialLimit,
  });

  // ─── DM State ────────────────────────────────────────────────────────────

  const [dms, setDMs] = useState<DMResponse[]>([]);
  const [selectedDM, setSelectedDM] = useState<DMResponse | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  // ─── Refs for callbacks ──────────────────────────────────────────────────

  const previousDMIdsRef = useRef<Set<string>>(new Set());
  const onNewDMsRef = useRef(onNewDMs);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onNewDMsRef.current = onNewDMs;
  }, [onNewDMs]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // ─── Fetcher ─────────────────────────────────────────────────────────────

  const fetcher = useCallback(async (): Promise<PaginatedResponse<DMResponse>> => {
    const result = await fetchDMs({
      page: filters.page,
      limit: filters.limit,
      platform: filters.platform,
      status: filters.status,
      search: filters.search,
    });
    return result;
  }, [filters.page, filters.limit, filters.platform, filters.status, filters.search]);

  // ─── Success Handler ─────────────────────────────────────────────────────

  const handleSuccess = useCallback(
    (data: PaginatedResponse<DMResponse>) => {
      setDMs(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      // Update selected DM if it's in the new data (to get fresh data)
      setSelectedDM((prev) => {
        if (!prev) return null;
        const updated = data.data.find((dm) => dm.id === prev.id);
        return updated ?? prev;
      });

      // Detect new DMs
      const currentDMIds = new Set(data.data.map((dm) => dm.id));
      const previousIds = previousDMIdsRef.current;

      const newDMs = data.data.filter((dm) => !previousIds.has(dm.id));

      if (newDMs.length > 0 && previousIds.size > 0 && onNewDMsRef.current) {
        onNewDMsRef.current(newDMs);
      }

      previousDMIdsRef.current = currentDMIds;
    },
    []
  );

  // ─── Error Handler ───────────────────────────────────────────────────────

  const handleError = useCallback((err: Error) => {
    if (onErrorRef.current) {
      onErrorRef.current(err);
    }
  }, []);

  // ─── Polling ─────────────────────────────────────────────────────────────

  const {
    isLoading,
    error,
    isPolling,
    start,
    stop,
    refetch: pollingRefetch,
    lastFetchedAt,
  } = usePolling<PaginatedResponse<DMResponse>>({
    fetcher,
    intervalMs,
    enabled,
    fetchOnMount: true,
    onSuccess: handleSuccess,
    onError: handleError,
  });

  // ─── Selection Actions ───────────────────────────────────────────────────

  const selectDM = useCallback(
    (dmId: string) => {
      const dm = dms.find((d) => d.id === dmId);
      if (dm) {
        setSelectedDM(dm);
      } else {
        // DM not in current page — still set by ID, will be resolved on next fetch
        setSelectedDM((prev) => {
          if (prev && prev.id === dmId) return prev;
          return null;
        });
      }
    },
    [dms]
  );

  const clearSelection = useCallback(() => {
    setSelectedDM(null);
  }, []);

  // ─── Filter Actions ──────────────────────────────────────────────────────

  const setPlatformFilter = useCallback((platform: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      platform: platform || undefined,
      page: 1, // Reset to first page on filter change
    }));
  }, []);

  const setStatusFilter = useCallback((status: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      status: status || undefined,
      page: 1,
    }));
  }, []);

  const setSearch = useCallback((search: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      search: search && search.trim().length > 0 ? search.trim() : undefined,
      page: 1,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({
      ...prev,
      page: Math.max(1, page),
    }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setFilters((prev) => ({
      ...prev,
      limit: Math.max(1, limit),
      page: 1,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      platform: undefined,
      status: undefined,
      search: undefined,
      page: 1,
      limit: initialLimit,
    });
  }, [initialLimit]);

  // ─── Refetch ─────────────────────────────────────────────────────────────

  const refetch = useCallback(async (): Promise<void> => {
    await pollingRefetch();
  }, [pollingRefetch]);

  // ─── Computed Values ─────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const dm of dms) {
      const status = dm.status;
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [dms]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const dm of dms) {
      const platform = dm.platform;
      counts[platform] = (counts[platform] ?? 0) + 1;
    }
    return counts;
  }, [dms]);

  return {
    dms,
    selectedDM,
    filters,
    isLoading,
    error,
    isPolling,
    total,
    totalPages,
    lastFetchedAt,
    selectDM,
    clearSelection,
    setPlatformFilter,
    setStatusFilter,
    setSearch,
    setPage,
    setLimit,
    resetFilters,
    refetch,
    start,
    stop,
    statusCounts,
    platformCounts,
  };
}

export default useDMs;