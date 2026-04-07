"use client";

import { useEffect } from "react";

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("❌ Notifications page error:", error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-card">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-red-500"
              aria-hidden="true"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <h2 className="mt-5 text-center text-lg font-semibold text-stockland-charcoal">
          Notifications failed to load
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          An unexpected error occurred while loading your notifications. Please
          try again or contact support if the problem persists.
        </p>

        {/* Retry Button */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-stockland-green px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stockland-green-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-2 active:bg-stockland-green-dark"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            Try Again
          </button>
        </div>

        {/* Home Link */}
        <div className="mt-3 flex justify-center">
          <a
            href="/"
            className="text-sm font-medium text-stockland-green transition-colors hover:text-stockland-green-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-2"
          >
            Return to Dashboard
          </a>
        </div>

        {/* Error Details (collapsible for debugging) */}
        <details className="mt-6 rounded-lg border border-gray-200 bg-gray-50">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stockland-green">
            Error Details
          </summary>
          <div className="border-t border-gray-200 px-4 py-3">
            <p className="break-all text-xs text-gray-600">
              <span className="font-semibold">Message:</span>{" "}
              {error.message || "Unknown error"}
            </p>
            {error.digest && (
              <p className="mt-1.5 break-all text-xs text-gray-500">
                <span className="font-semibold">Digest:</span> {error.digest}
              </p>
            )}
            {error.stack && (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-gray-100 p-2 text-[10px] leading-relaxed text-gray-500 scrollbar-thin">
                {error.stack}
              </pre>
            )}
          </div>
        </details>
      </div>

      {/* Branding Footer */}
      <div className="mt-6 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md bg-stockland-green"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </span>
        <span className="text-xs text-gray-400">
          Social DM Co-Pilot v0.1.0
        </span>
      </div>
    </div>
  );
}