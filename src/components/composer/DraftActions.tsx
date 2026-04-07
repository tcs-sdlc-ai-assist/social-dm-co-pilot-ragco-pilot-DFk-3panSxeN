"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  CONFIDENCE_THRESHOLD_LOW,
  CONFIDENCE_THRESHOLD_MEDIUM,
} from "@/lib/constants";
import type { DraftResponse, ApiErrorResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DraftActionsProps {
  /** The draft to perform actions on */
  draft: DraftResponse;
  /** The current user ID for audit purposes */
  userId?: string;
  /** Whether the draft has been reviewed by a human */
  isReviewed?: boolean;
  /** Whether any action is currently in progress (external loading state) */
  isExternalLoading?: boolean;
  /** Callback when draft is approved */
  onApprove?: (draft: DraftResponse) => void;
  /** Callback when draft is rejected */
  onReject?: (draft: DraftResponse) => void;
  /** Callback when draft is sent */
  onSend?: (result: { draftId: string; dmId: string; status: string; sentAt: string; platform: string }) => void;
  /** Callback when edit mode is requested */
  onEditRequest?: () => void;
  /** Callback when escalation is requested */
  onEscalate?: (draftId: string) => void;
  /** Callback when regeneration is requested */
  onRegenerate?: () => void;
  /** Callback on any error */
  onError?: (error: Error) => void;
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

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

function CheckIcon({ className }: { className: string }) {
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
      <path d="M20 6 9 17l-5-5" />
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

function EscalateIcon({ className }: { className: string }) {
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

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function apiDraftAction(
  draftId: string,
  action: "approve" | "reject" | "send",
  userId: string,
  extra?: { reason?: string; finalContent?: string }
): Promise<DraftResponse | { draftId: string; dmId: string; status: string; sentAt: string; platform: string; senderHandle: string }> {
  const response = await fetch(`/api/drafts/${draftId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, userId, ...extra }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errorData?.message ?? `Failed to ${action} draft (${response.status})`);
  }

  return (await response.json()) as DraftResponse;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Draft action buttons component for the draft composer workflow.
 *
 * Provides contextual action buttons based on the current draft status:
 *
 * **Pending drafts:**
 * - Approve: Marks the draft as approved (enforces human-in-the-loop)
 * - Reject: Rejects the draft with an optional reason
 * - Edit Draft: Switches to edit mode
 * - Escalate to Sales: Escalates the DM to a sales manager
 * - Regenerate: Requests a new AI draft
 *
 * **Approved drafts:**
 * - Send Reply: Sends the approved draft as a reply (primary action)
 * - Edit Draft: Switches to edit mode for last-minute changes
 *
 * **Rejected drafts:**
 * - Edit & Resubmit: Switches to edit mode
 * - Regenerate: Requests a new AI draft
 *
 * **Sent drafts:**
 * - No actions available (read-only)
 *
 * Enforces human-in-the-loop:
 * - Send Reply is disabled until the draft is approved
 * - Low-confidence drafts that have not been edited cannot be approved
 * - Shows a warning when approval is blocked due to low confidence
 *
 * Shows loading state during API calls and disables all buttons
 * while any action is in progress.
 *
 * Usage:
 * ```tsx
 * <DraftActions
 *   draft={currentDraft}
 *   userId="user-agent-001"
 *   isReviewed={true}
 *   onApprove={(draft) => console.log("Approved:", draft)}
 *   onSend={(result) => console.log("Sent:", result)}
 *   onEditRequest={() => setIsEditing(true)}
 *   onEscalate={(draftId) => handleEscalate(draftId)}
 * />
 * ```
 */
export function DraftActions({
  draft,
  userId = "user-agent-001",
  isReviewed = false,
  isExternalLoading = false,
  onApprove,
  onReject,
  onSend,
  onEditRequest,
  onEscalate,
  onRegenerate,
  onError,
  className = "",
}: DraftActionsProps) {
  // ─── State ─────────────────────────────────────────────────────────────

  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isEscalating, setIsEscalating] = useState<boolean>(false);
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Derived State ─────────────────────────────────────────────────────

  const isAnyActionLoading = isApproving || isRejecting || isSending || isEscalating || isExternalLoading;
  const isDraftSent = draft.status === "sent";
  const isDraftApproved = draft.status === "approved";
  const isDraftPending = draft.status === "pending";
  const isDraftRejected = draft.status === "rejected";

  const confidenceScore = draft.confidenceScore;
  const isLowConfidence = confidenceScore < CONFIDENCE_THRESHOLD_MEDIUM;
  const isVeryLowConfidence = confidenceScore < CONFIDENCE_THRESHOLD_LOW;

  // Human-in-the-loop enforcement:
  // Very low confidence drafts that have not been edited cannot be approved
  const canApprove =
    isDraftPending &&
    !(isVeryLowConfidence && !draft.isEdited) &&
    (isReviewed || draft.isEdited);

  const canSend = isDraftApproved;
  const canReject = isDraftPending;
  const canEdit = !isDraftSent;
  const canEscalate = !isDraftSent;
  const canRegenerate = !isDraftSent;

  // Tooltip for disabled approve button
  const approveDisabledReason = (() => {
    if (!isDraftPending) return undefined;
    if (isVeryLowConfidence && !draft.isEdited) {
      return "Low confidence draft must be edited before approval";
    }
    if (!isReviewed && !draft.isEdited) {
      return "Please review the draft before approving";
    }
    return undefined;
  })();

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

  // ─── Approve Handler ──────────────────────────────────────────────────

  const handleApprove = useCallback(async () => {
    if (!canApprove) return;

    clearError();
    setIsApproving(true);

    try {
      const result = await apiDraftAction(draft.id, "approve", userId);

      const approvedDraft: DraftResponse = {
        id: (result as DraftResponse).id,
        dmId: (result as DraftResponse).dmId,
        content: (result as DraftResponse).content,
        confidenceScore: (result as DraftResponse).confidenceScore,
        isEdited: (result as DraftResponse).isEdited,
        status: (result as DraftResponse).status,
        createdAt: (result as DraftResponse).createdAt,
        updatedAt: (result as DraftResponse).updatedAt,
      };

      if (onApprove) {
        onApprove(approvedDraft);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsApproving(false);
    }
  }, [draft.id, userId, canApprove, onApprove, handleError, clearError]);

  // ─── Reject Handler ───────────────────────────────────────────────────

  const handleReject = useCallback(async () => {
    if (!canReject) return;

    clearError();
    setIsRejecting(true);

    try {
      const result = await apiDraftAction(draft.id, "reject", userId, {
        reason: rejectReason.trim().length > 0 ? rejectReason.trim() : undefined,
      });

      const rejectedDraft: DraftResponse = {
        id: (result as DraftResponse).id,
        dmId: (result as DraftResponse).dmId,
        content: (result as DraftResponse).content,
        confidenceScore: (result as DraftResponse).confidenceScore,
        isEdited: (result as DraftResponse).isEdited,
        status: (result as DraftResponse).status,
        createdAt: (result as DraftResponse).createdAt,
        updatedAt: (result as DraftResponse).updatedAt,
      };

      setShowRejectInput(false);
      setRejectReason("");

      if (onReject) {
        onReject(rejectedDraft);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsRejecting(false);
    }
  }, [draft.id, userId, canReject, rejectReason, onReject, handleError, clearError]);

  // ─── Send Handler ─────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    clearError();
    setIsSending(true);

    try {
      const result = await apiDraftAction(draft.id, "send", userId);

      const sentResult = result as {
        draftId: string;
        dmId: string;
        status: string;
        sentAt: string;
        platform: string;
        senderHandle: string;
      };

      if (onSend) {
        onSend({
          draftId: sentResult.draftId,
          dmId: sentResult.dmId,
          status: sentResult.status,
          sentAt: sentResult.sentAt,
          platform: sentResult.platform,
        });
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsSending(false);
    }
  }, [draft.id, userId, canSend, onSend, handleError, clearError]);

  // ─── Escalate Handler ─────────────────────────────────────────────────

  const handleEscalate = useCallback(() => {
    if (!canEscalate || isAnyActionLoading) return;

    clearError();
    setIsEscalating(true);

    try {
      if (onEscalate) {
        onEscalate(draft.id);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsEscalating(false);
    }
  }, [draft.id, canEscalate, isAnyActionLoading, onEscalate, handleError, clearError]);

  // ─── Edit Handler ─────────────────────────────────────────────────────

  const handleEdit = useCallback(() => {
    if (!canEdit || isAnyActionLoading) return;

    clearError();

    if (onEditRequest) {
      onEditRequest();
    }
  }, [canEdit, isAnyActionLoading, onEditRequest, clearError]);

  // ─── Regenerate Handler ───────────────────────────────────────────────

  const handleRegenerate = useCallback(() => {
    if (!canRegenerate || isAnyActionLoading) return;

    clearError();

    if (onRegenerate) {
      onRegenerate();
    }
  }, [canRegenerate, isAnyActionLoading, onRegenerate, clearError]);

  // ─── Render ────────────────────────────────────────────────────────────

  // Sent state — no actions available
  if (isDraftSent) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 ${className}`.trim()}
        role="status"
        aria-label="Draft sent"
      >
        <CheckIcon className="h-5 w-5 flex-shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Reply Sent
          </p>
          <p className="mt-0.5 text-xs text-emerald-600">
            This draft has been sent as a reply. No further actions available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`space-y-3 ${className}`.trim()}
      role="group"
      aria-label="Draft actions"
    >
      {/* Error Message */}
      {errorMessage && (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3"
          role="alert"
          aria-live="assertive"
        >
          <EscalateIcon className="h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Action Failed</p>
            <p className="mt-0.5 text-xs text-red-600">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="flex-shrink-0 rounded-md p-0.5 text-red-400 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
            aria-label="Dismiss error"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Low confidence warning for pending drafts */}
      {isDraftPending && isLowConfidence && !draft.isEdited && (
        <div
          className={`flex items-start gap-2.5 rounded-lg border p-3 ${
            isVeryLowConfidence
              ? "border-red-200 bg-red-50"
              : "border-yellow-200 bg-yellow-50"
          }`}
          role="alert"
          aria-live="polite"
        >
          <EscalateIcon
            className={`h-5 w-5 flex-shrink-0 ${
              isVeryLowConfidence ? "text-red-500" : "text-yellow-500"
            }`}
          />
          <div>
            <p
              className={`text-sm font-semibold ${
                isVeryLowConfidence ? "text-red-800" : "text-yellow-800"
              }`}
            >
              {isVeryLowConfidence
                ? "Edit Required Before Approval"
                : "Review Recommended"}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                isVeryLowConfidence ? "text-red-600" : "text-yellow-600"
              }`}
            >
              {isVeryLowConfidence
                ? "This draft has very low AI confidence. You must edit the content before it can be approved."
                : "This draft has low AI confidence. Please review carefully and edit if necessary before approving."}
            </p>
          </div>
        </div>
      )}

      {/* Reject Reason Input */}
      {showRejectInput && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)..."
            disabled={isRejecting}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 transition-colors focus-visible:border-stockland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Rejection reason"
          />
          <Button
            variant="danger"
            size="sm"
            onClick={() => void handleReject()}
            isLoading={isRejecting}
            disabled={isAnyActionLoading}
          >
            Confirm Reject
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowRejectInput(false);
              setRejectReason("");
            }}
            disabled={isRejecting}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Primary Actions Row */}
      {!showRejectInput && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Pending Draft Actions */}
          {isDraftPending && (
            <>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleApprove()}
                isLoading={isApproving}
                disabled={isAnyActionLoading || !canApprove}
                leftIcon={<CheckIcon className="h-4 w-4" />}
                title={approveDisabledReason}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => setShowRejectInput(true)}
                disabled={isAnyActionLoading || !canReject}
                leftIcon={<XIcon className="h-4 w-4" />}
              >
                Reject
              </Button>
            </>
          )}

          {/* Approved Draft Actions */}
          {isDraftApproved && (
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleSend()}
              isLoading={isSending}
              disabled={isAnyActionLoading || !canSend}
              leftIcon={<SendIcon className="h-4 w-4" />}
            >
              Send Reply
            </Button>
          )}

          {/* Rejected Draft Actions */}
          {isDraftRejected && (
            <span className="text-xs text-gray-500">
              Draft was rejected. Edit and resubmit, or regenerate.
            </span>
          )}
        </div>
      )}

      {/* Secondary Actions Row */}
      {!showRejectInput && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          {/* Edit Draft — available for all non-sent statuses */}
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEdit}
              disabled={isAnyActionLoading}
              leftIcon={<EditIcon className="h-3.5 w-3.5" />}
            >
              {isDraftRejected ? "Edit & Resubmit" : "Edit Draft"}
            </Button>
          )}

          {/* Regenerate — available for all non-sent statuses */}
          {canRegenerate && onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={isAnyActionLoading}
              leftIcon={<RefreshIcon className="h-3.5 w-3.5" />}
            >
              Regenerate
            </Button>
          )}

          {/* Escalate to Sales — available for all non-sent statuses */}
          {canEscalate && onEscalate && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleEscalate}
              isLoading={isEscalating}
              disabled={isAnyActionLoading}
              leftIcon={<EscalateIcon className="h-3.5 w-3.5" />}
            >
              Escalate to Sales
            </Button>
          )}

          {/* Disabled approve hint */}
          {isDraftPending && !canApprove && approveDisabledReason && (
            <span className="text-xs text-yellow-600">
              ⚠ {approveDisabledReason}
            </span>
          )}
        </div>
      )}

      {/* Draft Status Indicator */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-gray-400">Status:</span>
        <StatusBadge status={draft.status} variant="draft" size="sm" />
        {draft.isEdited && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            Edited
          </span>
        )}
        <span className="text-xs text-gray-400">
          Confidence: {Math.round(draft.confidenceScore * 100)}%
        </span>
      </div>
    </div>
  );
}

export default DraftActions;