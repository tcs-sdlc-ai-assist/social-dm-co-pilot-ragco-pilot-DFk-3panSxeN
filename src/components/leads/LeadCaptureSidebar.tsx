"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityFlag } from "@/components/ui/PriorityFlag";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import {
  LEAD_SCORE_HIGH_PRIORITY,
  LEAD_SCORE_MEDIUM_PRIORITY,
} from "@/lib/constants";
import type {
  LeadResponse,
  DMResponse,
  ApiErrorResponse,
  LeadScoreResult,
} from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeadCaptureSidebarProps {
  /** The DM associated with this lead */
  dm: DMResponse;
  /** Existing lead data (if already extracted) */
  lead?: LeadResponse | null;
  /** The current user ID for audit purposes */
  userId?: string;
  /** Callback when a lead is extracted */
  onLeadExtracted?: (lead: LeadResponse) => void;
  /** Callback when a lead is synced to Salesforce */
  onSalesforceSync?: (result: { leadId: string; salesforceId: string; success: boolean }) => void;
  /** Callback when lead priority is toggled */
  onPriorityToggle?: (leadId: string, priorityFlag: boolean) => void;
  /** Callback on any error */
  onError?: (error: Error) => void;
  /** Optional additional CSS classes */
  className?: string;
}

interface ExtractedPreview {
  name: string;
  contact: string | null;
  budget: string | null;
  location: string | null;
  intent: string | null;
  confidence: number;
  scoreResult: LeadScoreResult;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function UserIcon({ className }: { className: string }) {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PhoneIcon({ className }: { className: string }) {
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
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function DollarIcon({ className }: { className: string }) {
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
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function MapPinIcon({ className }: { className: string }) {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function TargetIcon({ className }: { className: string }) {
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
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
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

function SparklesIcon({ className }: { className: string }) {
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
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
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

function UserAssignIcon({ className }: { className: string }) {
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
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function apiExtractLead(
  dmId: string,
  forceReextract: boolean = false
): Promise<{
  lead: LeadResponse;
  extractedData: {
    name: string;
    contact: string | null;
    budget: string | null;
    location: string | null;
    intent: string | null;
    confidence: number;
  };
  scoreResult: LeadScoreResult;
  isNew: boolean;
}> {
  const response = await fetch("/api/leads/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dmId, forceReextract }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errorData?.message ?? `Failed to extract lead (${response.status})`);
  }

  return (await response.json()) as {
    lead: LeadResponse;
    extractedData: {
      name: string;
      contact: string | null;
      budget: string | null;
      location: string | null;
      intent: string | null;
      confidence: number;
    };
    scoreResult: LeadScoreResult;
    isNew: boolean;
  };
}

async function apiPreviewExtraction(
  dmId: string
): Promise<{
  extractedData: {
    name: string;
    contact: string | null;
    budget: string | null;
    location: string | null;
    intent: string | null;
    confidence: number;
  };
  scoreResult: LeadScoreResult;
}> {
  const response = await fetch("/api/leads/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dmId, preview: true }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errorData?.message ?? `Failed to preview extraction (${response.status})`);
  }

  return (await response.json()) as {
    extractedData: {
      name: string;
      contact: string | null;
      budget: string | null;
      location: string | null;
      intent: string | null;
      confidence: number;
    };
    scoreResult: LeadScoreResult;
  };
}

async function apiSyncToSalesforce(
  leadId: string
): Promise<{
  success: boolean;
  salesforceId: string | null;
  leadId: string;
  syncedAt: string;
  mode: string;
  error?: string;
}> {
  const response = await fetch("/api/leads/salesforce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId, triggerNotification: true }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errorData?.message ?? `Failed to sync to Salesforce (${response.status})`);
  }

  return (await response.json()) as {
    success: boolean;
    salesforceId: string | null;
    leadId: string;
    syncedAt: string;
    mode: string;
    error?: string;
  };
}

async function apiScoreLead(
  leadId: string
): Promise<LeadScoreResult> {
  const response = await fetch("/api/leads/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId, persistUpdate: true, triggerNotification: true, breakdown: false }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errorData?.message ?? `Failed to score lead (${response.status})`);
  }

  return (await response.json()) as LeadScoreResult;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function LeadField({
  icon,
  label,
  value,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  placeholder?: string;
}) {
  const hasValue = value !== null && value !== undefined && value.trim().length > 0;

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0 text-gray-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <p
          className={`mt-0.5 text-sm leading-snug ${
            hasValue ? "text-gray-800" : "italic text-gray-400"
          }`}
        >
          {hasValue ? value : placeholder ?? "Not detected"}
        </p>
      </div>
    </div>
  );
}

function SalesforceSyncStatus({
  salesforceId,
  isSyncing,
  syncError,
}: {
  salesforceId: string | null | undefined;
  isSyncing: boolean;
  syncError: string | null;
}) {
  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
        <RefreshIcon className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-xs font-medium text-blue-700">
          Syncing to Salesforce...
        </span>
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
        <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-red-800">Sync Failed</span>
          <p className="mt-0.5 text-xs text-red-600">{syncError}</p>
        </div>
      </div>
    );
  }

  if (salesforceId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
        <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-emerald-800">
            Synced to Salesforce
          </span>
          <p className="mt-0.5 truncate text-xs text-emerald-600">
            ID: {salesforceId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
      <CloudIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
      <span className="text-xs text-gray-500">Not synced to Salesforce</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Lead Capture Sidebar component with auto-filled fields from lead extraction.
 *
 * Features:
 * - Auto-filled lead fields: Name, Contact, Budget, Location, Intent
 * - Lead extraction preview before creating a lead
 * - "Extract Lead" button to run lead extraction from the DM
 * - "Re-extract" button to force re-extraction
 * - Lead score display with PriorityFlag component
 * - Extraction confidence meter
 * - "Flag for Sales Follow-Up" toggle for priority flagging
 * - "Create Lead in Salesforce" button with sync status
 * - Salesforce sync status indicator (synced, syncing, failed, not synced)
 * - Assigned-to field showing the agent assigned to the lead
 * - Lead status badge
 * - Error handling with dismissible error messages
 * - Loading states for all async operations
 *
 * Enforces human-in-the-loop:
 * - Lead extraction is previewed before persisting
 * - Salesforce sync requires explicit user action
 * - Priority flag can be manually toggled
 *
 * Usage:
 * ```tsx
 * <LeadCaptureSidebar
 *   dm={selectedDM}
 *   lead={existingLead}
 *   userId="user-agent-001"
 *   onLeadExtracted={(lead) => console.log("Extracted:", lead)}
 *   onSalesforceSync={(result) => console.log("Synced:", result)}
 * />
 * ```
 */
export function LeadCaptureSidebar({
  dm,
  lead: initialLead = null,
  userId = "user-agent-001",
  onLeadExtracted,
  onSalesforceSync,
  onPriorityToggle,
  onError,
  className = "",
}: LeadCaptureSidebarProps) {
  // ─── State ─────────────────────────────────────────────────────────────

  const [currentLead, setCurrentLead] = useState<LeadResponse | null>(initialLead);
  const [preview, setPreview] = useState<ExtractedPreview | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isScoring, setIsScoring] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [priorityFlag, setPriorityFlag] = useState<boolean>(initialLead?.priorityFlag ?? false);

  // ─── Sync with prop changes ────────────────────────────────────────────

  useEffect(() => {
    setCurrentLead(initialLead);
    setPriorityFlag(initialLead?.priorityFlag ?? false);
    setPreview(null);
    setErrorMessage(null);
    setSyncError(null);
  }, [initialLead]);

  // ─── Derived State ─────────────────────────────────────────────────────

  const hasLead = currentLead !== null;
  const isSynced = Boolean(currentLead?.salesforceId);
  const isAnyLoading = isExtracting || isPreviewing || isSyncing || isScoring;

  // ─── Error Handler ─────────────────────────────────────────────────────

  const handleError = useCallback(
    (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      setErrorMessage(error.message);
      if (onError) {
        onError(error);
      }
    },
    [onError]
  );

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // ─── Preview Extraction ────────────────────────────────────────────────

  const handlePreviewExtraction = useCallback(async () => {
    clearError();
    setIsPreviewing(true);

    try {
      const result = await apiPreviewExtraction(dm.id);

      setPreview({
        name: result.extractedData.name,
        contact: result.extractedData.contact,
        budget: result.extractedData.budget,
        location: result.extractedData.location,
        intent: result.extractedData.intent,
        confidence: result.extractedData.confidence,
        scoreResult: result.scoreResult,
      });
    } catch (err) {
      handleError(err);
    } finally {
      setIsPreviewing(false);
    }
  }, [dm.id, handleError, clearError]);

  // ─── Extract Lead ──────────────────────────────────────────────────────

  const handleExtractLead = useCallback(
    async (forceReextract: boolean = false) => {
      clearError();
      setSyncError(null);
      setIsExtracting(true);

      try {
        const result = await apiExtractLead(dm.id, forceReextract);

        const lead = result.lead;
        setCurrentLead(lead);
        setPriorityFlag(lead.priorityFlag);
        setPreview(null);

        if (onLeadExtracted) {
          onLeadExtracted(lead);
        }
      } catch (err) {
        handleError(err);
      } finally {
        setIsExtracting(false);
      }
    },
    [dm.id, onLeadExtracted, handleError, clearError]
  );

  // ─── Salesforce Sync ───────────────────────────────────────────────────

  const handleSalesforceSync = useCallback(async () => {
    if (!currentLead) return;

    clearError();
    setSyncError(null);
    setIsSyncing(true);

    try {
      const result = await apiSyncToSalesforce(currentLead.id);

      if (result.success && result.salesforceId) {
        setCurrentLead((prev) =>
          prev ? { ...prev, salesforceId: result.salesforceId } : null
        );

        if (onSalesforceSync) {
          onSalesforceSync({
            leadId: result.leadId,
            salesforceId: result.salesforceId,
            success: true,
          });
        }
      } else {
        setSyncError(result.error ?? "Salesforce sync failed.");

        if (onSalesforceSync) {
          onSalesforceSync({
            leadId: result.leadId,
            salesforceId: "",
            success: false,
          });
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setSyncError(error.message);
      handleError(err);
    } finally {
      setIsSyncing(false);
    }
  }, [currentLead, onSalesforceSync, handleError, clearError]);

  // ─── Priority Toggle ──────────────────────────────────────────────────

  const handlePriorityToggle = useCallback(() => {
    if (!currentLead || isAnyLoading) return;

    const newFlag = !priorityFlag;
    setPriorityFlag(newFlag);

    if (onPriorityToggle) {
      onPriorityToggle(currentLead.id, newFlag);
    }
  }, [currentLead, priorityFlag, isAnyLoading, onPriorityToggle]);

  // ─── Re-score Lead ────────────────────────────────────────────────────

  const handleRescore = useCallback(async () => {
    if (!currentLead) return;

    clearError();
    setIsScoring(true);

    try {
      const scoreResult = await apiScoreLead(currentLead.id);

      setCurrentLead((prev) =>
        prev
          ? {
              ...prev,
              score: scoreResult.score,
              priorityFlag: scoreResult.priorityFlag,
            }
          : null
      );
      setPriorityFlag(scoreResult.priorityFlag);
    } catch (err) {
      handleError(err);
    } finally {
      setIsScoring(false);
    }
  }, [currentLead, handleError, clearError]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-card ${className}`.trim()}
      role="complementary"
      aria-label="Lead Capture"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-stockland-green" />
          <h3 className="text-sm font-semibold text-stockland-charcoal">
            Lead Capture
          </h3>
        </div>
        {hasLead && (
          <StatusBadge status={currentLead.status} variant="lead" size="sm" />
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-red-800">Error</p>
            <p className="mt-0.5 text-xs text-red-600">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="flex-shrink-0 rounded-md p-0.5 text-red-400 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
            aria-label="Dismiss error"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* No Lead State */}
      {!hasLead && !preview && !isPreviewing && !isExtracting && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
          <SparklesIcon className="h-8 w-8 text-stockland-green/50" />
          <h4 className="mt-2 text-xs font-semibold text-stockland-charcoal">
            Extract Lead Data
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            Automatically extract lead information from this DM.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handlePreviewExtraction()}
              isLoading={isPreviewing}
              disabled={isAnyLoading}
            >
              Preview
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleExtractLead(false)}
              isLoading={isExtracting}
              disabled={isAnyLoading}
              leftIcon={<SparklesIcon className="h-3.5 w-3.5" />}
            >
              Extract Lead
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {(isPreviewing || isExtracting) && !hasLead && !preview && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-stockland-green/20 bg-stockland-green/5 px-4 py-8 text-center">
          <SparklesIcon className="h-8 w-8 animate-pulse text-stockland-green" />
          <p className="mt-2 text-xs font-medium text-stockland-charcoal">
            {isPreviewing ? "Previewing extraction..." : "Extracting lead data..."}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Analyzing DM content for lead information.
          </p>
        </div>
      )}

      {/* Preview State */}
      {preview && !hasLead && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">
              Extraction Preview
            </span>
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              Not saved
            </span>
          </div>

          {/* Preview Fields */}
          <div className="space-y-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <LeadField
              icon={<UserIcon className="h-3.5 w-3.5" />}
              label="Name"
              value={preview.name}
            />
            <LeadField
              icon={<PhoneIcon className="h-3.5 w-3.5" />}
              label="Contact"
              value={preview.contact}
            />
            <LeadField
              icon={<DollarIcon className="h-3.5 w-3.5" />}
              label="Budget"
              value={preview.budget}
            />
            <LeadField
              icon={<MapPinIcon className="h-3.5 w-3.5" />}
              label="Location"
              value={preview.location}
            />
            <LeadField
              icon={<TargetIcon className="h-3.5 w-3.5" />}
              label="Intent"
              value={preview.intent}
            />
          </div>

          {/* Preview Score */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Predicted Score:</span>
              <PriorityFlag
                score={preview.scoreResult.score}
                priorityFlag={preview.scoreResult.priorityFlag}
                showScore
                showLabel
                size="sm"
              />
            </div>
          </div>

          {/* Preview Confidence */}
          <div className="rounded-lg border border-gray-200 bg-white p-2.5">
            <span className="text-xs text-gray-500">Extraction Confidence:</span>
            <div className="mt-1">
              <ConfidenceMeter
                score={preview.confidence}
                showLabel
                showTooltip={false}
                size="sm"
              />
            </div>
          </div>

          {/* Preview Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreview(null)}
              disabled={isAnyLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleExtractLead(false)}
              isLoading={isExtracting}
              disabled={isAnyLoading}
              leftIcon={<SparklesIcon className="h-3.5 w-3.5" />}
              fullWidth
            >
              Confirm & Create Lead
            </Button>
          </div>
        </div>
      )}

      {/* Lead Data Display */}
      {hasLead && (
        <div className="space-y-3">
          {/* Lead Score & Priority */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Lead Score:</span>
              <PriorityFlag
                score={currentLead.score}
                priorityFlag={currentLead.priorityFlag}
                showScore
                showLabel
                size="sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleRescore()}
              isLoading={isScoring}
              disabled={isAnyLoading}
              leftIcon={<RefreshIcon className="h-3 w-3" />}
            >
              Re-score
            </Button>
          </div>

          {/* Lead Fields */}
          <div className="space-y-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <LeadField
              icon={<UserIcon className="h-3.5 w-3.5" />}
              label="Name"
              value={currentLead.name}
            />
            <LeadField
              icon={<PhoneIcon className="h-3.5 w-3.5" />}
              label="Contact"
              value={currentLead.contact}
            />
            <LeadField
              icon={<DollarIcon className="h-3.5 w-3.5" />}
              label="Budget"
              value={currentLead.budget}
            />
            <LeadField
              icon={<MapPinIcon className="h-3.5 w-3.5" />}
              label="Location"
              value={currentLead.location}
            />
            <LeadField
              icon={<TargetIcon className="h-3.5 w-3.5" />}
              label="Intent"
              value={currentLead.intent}
            />
          </div>

          {/* Assigned To */}
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5">
            <UserAssignIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <span className="text-xs text-gray-500">Assigned To:</span>
              <p
                className={`text-sm ${
                  currentLead.assignedTo
                    ? "font-medium text-gray-800"
                    : "italic text-gray-400"
                }`}
              >
                {currentLead.assignedTo ?? "Unassigned"}
              </p>
            </div>
          </div>

          {/* Flag for Sales Follow-Up Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  priorityFlag ? "bg-red-500" : "bg-gray-300"
                }`}
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-gray-700">
                Flag for Sales Follow-Up
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={priorityFlag}
              aria-label="Flag for sales follow-up"
              onClick={handlePriorityToggle}
              disabled={isAnyLoading}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                priorityFlag ? "bg-red-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                  priorityFlag ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Salesforce Sync Status */}
          <SalesforceSyncStatus
            salesforceId={currentLead.salesforceId}
            isSyncing={isSyncing}
            syncError={syncError}
          />

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            {/* Salesforce Sync Button */}
            {!isSynced && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSalesforceSync()}
                isLoading={isSyncing}
                disabled={isAnyLoading}
                leftIcon={<CloudIcon className="h-3.5 w-3.5" />}
                fullWidth
              >
                Create Lead in Salesforce
              </Button>
            )}

            {isSynced && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleSalesforceSync()}
                isLoading={isSyncing}
                disabled={isAnyLoading}
                leftIcon={<RefreshIcon className="h-3.5 w-3.5" />}
                fullWidth
              >
                Re-sync to Salesforce
              </Button>
            )}

            {/* Re-extract Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleExtractLead(true)}
              isLoading={isExtracting}
              disabled={isAnyLoading}
              leftIcon={<SparklesIcon className="h-3.5 w-3.5" />}
              fullWidth
            >
              Re-extract Lead Data
            </Button>
          </div>

          {/* Sync Error Retry */}
          {syncError && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setSyncError(null);
                void handleSalesforceSync();
              }}
              isLoading={isSyncing}
              disabled={isAnyLoading}
              fullWidth
            >
              Retry Salesforce Sync
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default LeadCaptureSidebar;