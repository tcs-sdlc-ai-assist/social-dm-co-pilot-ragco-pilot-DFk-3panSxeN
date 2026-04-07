"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UsePollingOptions<T> {
  /** The async function to call on each poll interval */
  fetcher: () => Promise<T>;
  /** Polling interval in milliseconds */
  intervalMs: number;
  /** Whether to start polling immediately on mount (default: true) */
  enabled?: boolean;
  /** Whether to fetch immediately on mount before the first interval (default: true) */
  fetchOnMount?: boolean;
  /** Callback invoked on each successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback invoked when a fetch fails */
  onError?: (error: Error) => void;
}

export interface UsePollingResult<T> {
  /** The latest data returned by the fetcher */
  data: T | null;
  /** Whether a fetch is currently in progress */
  isLoading: boolean;
  /** The most recent error, or null if the last fetch succeeded */
  error: Error | null;
  /** Whether polling is currently active */
  isPolling: boolean;
  /** Start or resume polling */
  start: () => void;
  /** Stop polling (clears interval) */
  stop: () => void;
  /** Pause polling without clearing state */
  pause: () => void;
  /** Resume polling after a pause */
  resume: () => void;
  /** Manually trigger a single fetch outside the polling interval */
  refetch: () => Promise<void>;
  /** Timestamp of the last successful fetch */
  lastFetchedAt: Date | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Custom hook for polling API endpoints at configurable intervals.
 * Supports start/stop/pause with automatic cleanup on unmount.
 *
 * Usage:
 * ```ts
 * const { data, isLoading, error, isPolling, start, stop } = usePolling({
 *   fetcher: () => fetch("/api/dms").then((r) => r.json()),
 *   intervalMs: POLLING_INTERVAL_DMS,
 *   enabled: true,
 *   onSuccess: (data) => console.log("Fetched:", data),
 *   onError: (err) => console.error("Poll error:", err),
 * });
 * ```
 */
export function usePolling<T>(options: UsePollingOptions<T>): UsePollingResult<T> {
  const {
    fetcher,
    intervalMs,
    enabled = true,
    fetchOnMount = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(enabled);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const fetcherRef = useRef(fetcher);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Keep refs in sync with latest callback values to avoid stale closures
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Track mount status for safe state updates
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const executeFetch = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await fetcherRef.current();

      if (!isMountedRef.current) {
        return;
      }

      setData(result);
      setError(null);
      setLastFetchedAt(new Date());

      if (onSuccessRef.current) {
        onSuccessRef.current(result);
      }
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);

      if (onErrorRef.current) {
        onErrorRef.current(fetchError);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const clearPollingInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPollingInterval = useCallback(() => {
    clearPollingInterval();

    if (intervalMs > 0) {
      intervalRef.current = setInterval(() => {
        void executeFetch();
      }, intervalMs);
    }
  }, [intervalMs, executeFetch, clearPollingInterval]);

  const start = useCallback(() => {
    setIsPolling(true);
    void executeFetch();
    startPollingInterval();
  }, [executeFetch, startPollingInterval]);

  const stop = useCallback(() => {
    setIsPolling(false);
    clearPollingInterval();
  }, [clearPollingInterval]);

  const pause = useCallback(() => {
    setIsPolling(false);
    clearPollingInterval();
  }, [clearPollingInterval]);

  const resume = useCallback(() => {
    setIsPolling(true);
    startPollingInterval();
  }, [startPollingInterval]);

  const refetch = useCallback(async () => {
    await executeFetch();
  }, [executeFetch]);

  // Initial setup: fetch on mount and start polling if enabled
  useEffect(() => {
    if (enabled) {
      if (fetchOnMount) {
        void executeFetch();
      }
      startPollingInterval();
      setIsPolling(true);
    }

    return () => {
      clearPollingInterval();
    };
    // Only run on mount and when enabled/intervalMs changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPollingInterval();
    };
  }, [clearPollingInterval]);

  return {
    data,
    isLoading,
    error,
    isPolling,
    start,
    stop,
    pause,
    resume,
    refetch,
    lastFetchedAt,
  };
}

export default usePolling;