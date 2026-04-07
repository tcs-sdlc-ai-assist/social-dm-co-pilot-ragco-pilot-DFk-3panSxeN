"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  CONFIDENCE_THRESHOLD_MEDIUM,
  CONFIDENCE_THRESHOLD_LOW,
} from "@/lib/constants";
import type { DMResponse, DraftResponse, ApiErrorResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DraftComposerProps {
  /** The DM to compose a draft for */
  dm: DMResponse;
  /** Existing draft to display/edit (optional — if not provided, can generate) */
  draft?: DraftResponse | null;
  /** Callback when a draft is generated */
  onDraftGenerated?: (draft: DraftResponse) => void;
  /** Callback when a draft is edited */
  onDraftEdited?: (draft: DraftResponse) => void;
  /** Callback when a draft is approved */
  onDraftApproved?: (draft: DraftResponse) => void;
  /** Callback when a draft is rejected */
  onDraftRejected?: (draft: DraftResponse) => void;
  /** Callback when a draft is sent */
  onDraftSent?: (result: { draftId: string; dmId: string; status: string; sentAt: string; platform: string }) => void;
  /** Callback on any error */
  onError?: (error: Error) => void;
  /** The current user ID for audit purposes */
  userId?: string;
  /** Optional additional CSS classes */
  className?: string;
}

interface KnowledgeReference {
  type: "community" | "listing" | "faq" | "template" | "grant";
  name: string;
  detail: string;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

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

function BuildingIcon({ className }: { className: string }) {
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
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className: string }) {
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
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
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

function BookOpenIcon({ className }: { className: string }) {
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
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractKnowledgeReferences(dm: DMResponse): KnowledgeReference[] {
  const refs: KnowledgeReference[] = [];
  const lower = dm.message.toLowerCase();

  const communityMap: Record<string, string> = {
    elara: "Elara — Marsden Park, NSW",
    aura: "Aura — Calleya, WA",
    calleya: "Aura — Calleya, WA",
    minta: "Minta — Berwick, VIC",
    willowdale: "Willowdale — Leppington, NSW",
    cloverton: "Cloverton — Kalkallo, VIC",
    "cardinal freeman": "Cardinal Freeman — Ashfield, NSW",
  };

  for (const [key, detail] of Object.entries(communityMap)) {
    if (lower.includes(key)) {
      refs.push({ type: "community", name: key.charAt(0).toUpperCase() + key.slice(1), detail });
    }
  }

  if (lower.includes("first home") || lower.includes("first-home")) {
    refs.push({ type: "grant", name: "First Home Owner Grant", detail: "Up to $10,000 for eligible first home buyers" });
  }

  if (lower.includes("invest")) {
    refs.push({ type: "faq", name: "Investment FAQ", detail: "Rental yields, capital growth, and depreciation benefits" });
  }

  if (lower.includes("retirement") || lower.includes("downsize")) {
    refs.push({ type: "faq", name: "Retirement Living FAQ", detail: "Independent living for over-55s with resort-style facilities" });
  }

  if (lower.includes("display") || lower.includes("tour") || lower.includes("visit")) {
    refs.push({ type: "template", name: "Display Village Invite", detail: "Template for inviting customers to visit display homes" });
  }

  const bedroomMatch = lower.match(/(\d)[\s-]?bed/);
  if (bedroomMatch && bedroomMatch[1]) {
    refs.push({ type: "listing", name: `${bedroomMatch[1]}-Bedroom Listings`, detail: `Matched ${bedroomMatch[1]}-bedroom home options` });
  }

  if (lower.includes("land") && (lower.includes("block") || lower.includes("lot"))) {
    refs.push({ type: "listing", name: "Land Lots", detail: "Available land lots in matched communities" });
  }

  return refs;
}

function getRefIcon(type: KnowledgeReference["type"]): string {
  switch (type) {
    case "community":
      return "🏘️";
    case "listing":
      return "🏠";
    case "faq":
      return "❓";
    case "template":
      return "📝";
    case "grant":
      return "💰";
    default:
      return "📄";
  }
}

function getRefBadgeColor(type: KnowledgeReference["type"]): string {
  switch (type) {
    case "community":
      return "bg-green-100 text-green-700";
    case "listing":
      return "bg-blue-100 text-blue-700";
    case "faq":
      return "bg-purple-100 text-purple-700";
    case "template":
      return "bg-yellow-100 text-yellow-700";
    case "grant":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function apiGenerateDraft(
  dmId: string,
  knowledgeContext: string[],
  forceRegenerate: boolean
): Promise<{ draftId: string; content: string; confidenceScore: number; tokensUsed: number }> {
  const response = await fetch(`/api/dms/${dmId}/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ knowledgeContext, forceRegenerate }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errorData?.message ?? `Failed to generate draft (${response.status})`);
  }

  return (await response.json()) as { draftId: string; content: string; confidenceScore: number; tokensUsed: number };
}

async function apiEditDraft(
  draftId: string,
  content: string,
  userId: string
): Promise<DraftResponse & { complianceIssues: string[] }> {
  const response = await fetch(`/api/drafts/${draftId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, userId }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errorData?.message ?? `Failed to edit draft (${response.status})`);
  }

  return (await response.json()) as DraftResponse & { complianceIssues: string[] };
}

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

// ─── Sub-Components ──────────────────────────────────────────────────────────

function MandatoryReviewWarning({ confidenceScore }: { confidenceScore: number }) {
  const isVeryLow = confidenceScore < CONFIDENCE_THRESHOLD_LOW;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border p-3 ${
        isVeryLow
          ? "border-red-200 bg-red-50"
          : "border-yellow-200 bg-yellow-50"
      }`}
      role="alert"
      aria-live="polite"
    >
      <AlertTriangleIcon
        className={`h-5 w-5 flex-shrink-0 ${
          isVeryLow ? "text-red-500" : "text-yellow-500"
        }`}
      />
      <div>
        <p
          className={`text-sm font-semibold ${
            isVeryLow ? "text-red-800" : "text-yellow-800"
          }`}
        >
          {isVeryLow ? "Very Low Confidence — Manual Review Required" : "Low Confidence — Review Recommended"}
        </p>
        <p
          className={`mt-0.5 text-xs ${
            isVeryLow ? "text-red-600" : "text-yellow-600"
          }`}
        >
          {isVeryLow
            ? "This draft has very low AI confidence. You must edit and review the content before it can be approved or sent."
            : "This draft may need adjustments. Please review the content carefully and edit if necessary before approving."}
        </p>
      </div>
    </div>
  );
}

function KnowledgeReferencesPanel({ references }: { references: KnowledgeReference[] }) {
  if (references.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpenIcon className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600">
          Knowledge Base References ({references.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {references.map((ref, index) => (
          <span
            key={`${ref.type}-${ref.name}-${index}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getRefBadgeColor(ref.type)}`}
            title={ref.detail}
          >
            <span aria-hidden="true">{getRefIcon(ref.type)}</span>
            {ref.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ComplianceIssuesAlert({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;

  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-red-500" />
      <div>
        <p className="text-sm font-semibold text-red-800">Compliance Issues Detected</p>
        <ul className="mt-1 list-disc pl-4 space-y-0.5">
          {issues.map((issue, index) => (
            <li key={index} className="text-xs text-red-600">
              {issue}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OriginalMessagePreview({ dm }: { dm: DMResponse }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-600">Original Message</span>
          <StatusBadge status={dm.status} variant="dm" size="sm" />
        </div>
        <span className="text-xs text-gray-400">{dm.senderName} · {dm.senderHandle}</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {dm.message}
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Co-Pilot Draft Composer component.
 *
 * Provides an AI-powered draft response composer with:
 * - Auto-generated reply preview from the DraftGeneratorService
 * - Editable text area for human-in-the-loop review
 * - Confidence meter showing AI confidence score
 * - "Insert Property Info" button to add knowledge base context
 * - "Suggest Next Step" button to append a call-to-action
 * - "Send Reply" button (only enabled for approved drafts)
 * - "Edit Draft" toggle to switch between preview and edit modes
 * - "Approve" and "Reject" buttons for draft review workflow
 * - "Regenerate" button to force a new AI draft
 * - Mandatory review warning for low-confidence drafts
 * - Knowledge base references panel showing matched context
 * - Compliance issues alert for PII or policy violations
 * - Character count with limit indicator
 *
 * Enforces human-in-the-loop:
 * - Low-confidence drafts (< 85%) show a mandatory review warning
 * - Very low-confidence drafts (< 70%) cannot be approved without editing
 * - All drafts must be approved before sending
 * - PII detected in edits triggers a compliance warning
 *
 * Usage:
 * ```tsx
 * <DraftComposer
 *   dm={selectedDM}
 *   draft={existingDraft}
 *   userId="user-agent-001"
 *   onDraftGenerated={(draft) => console.log("Generated:", draft)}
 *   onDraftSent={(result) => console.log("Sent:", result)}
 * />
 * ```
 */
export function DraftComposer({
  dm,
  draft: initialDraft = null,
  onDraftGenerated,
  onDraftEdited,
  onDraftApproved,
  onDraftRejected,
  onDraftSent,
  onError,
  userId = "user-agent-001",
  className = "",
}: DraftComposerProps) {
  // ─── State ─────────────────────────────────────────────────────────────

  const [currentDraft, setCurrentDraft] = useState<DraftResponse | null>(initialDraft);
  const [editContent, setEditContent] = useState<string>(initialDraft?.content ?? "");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [complianceIssues, setComplianceIssues] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRejectReason, setShowRejectReason] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHARS = 2000;

  // ─── Sync with prop changes ────────────────────────────────────────────

  useEffect(() => {
    setCurrentDraft(initialDraft);
    setEditContent(initialDraft?.content ?? "");
    setIsEditing(false);
    setComplianceIssues([]);
    setErrorMessage(null);
    setShowRejectReason(false);
    setRejectReason("");
  }, [initialDraft]);

  // ─── Derived State ─────────────────────────────────────────────────────

  const knowledgeReferences = extractKnowledgeReferences(dm);
  const confidenceScore = currentDraft?.confidenceScore ?? 0;
  const isLowConfidence = confidenceScore < CONFIDENCE_THRESHOLD_MEDIUM;
  const isVeryLowConfidence = confidenceScore < CONFIDENCE_THRESHOLD_LOW;
  const needsMandatoryReview = isLowConfidence && currentDraft !== null;
  const canApprove =
    currentDraft !== null &&
    currentDraft.status === "pending" &&
    !(isVeryLowConfidence && !currentDraft.isEdited);
  const canSend = currentDraft !== null && currentDraft.status === "approved";
  const canReject = currentDraft !== null && currentDraft.status === "pending";
  const isDraftSent = currentDraft?.status === "sent";
  const hasUnsavedChanges = isEditing && editContent !== (currentDraft?.content ?? "");
  const charCount = editContent.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isAnyActionLoading = isGenerating || isSaving || isApproving || isRejecting || isSending;

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

  // ─── Generate Draft ────────────────────────────────────────────────────

  const handleGenerateDraft = useCallback(
    async (forceRegenerate: boolean = false) => {
      clearError();
      setIsGenerating(true);

      try {
        const keywords: string[] = [];
        for (const ref of knowledgeReferences) {
          keywords.push(ref.name);
        }

        const result = await apiGenerateDraft(dm.id, keywords, forceRegenerate);

        const newDraft: DraftResponse = {
          id: result.draftId,
          dmId: dm.id,
          content: result.content,
          confidenceScore: result.confidenceScore,
          isEdited: false,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setCurrentDraft(newDraft);
        setEditContent(result.content);
        setIsEditing(false);
        setComplianceIssues([]);

        if (onDraftGenerated) {
          onDraftGenerated(newDraft);
        }
      } catch (err) {
        handleError(err);
      } finally {
        setIsGenerating(false);
      }
    },
    [dm.id, knowledgeReferences, onDraftGenerated, handleError, clearError]
  );

  // ─── Edit Draft ────────────────────────────────────────────────────────

  const handleStartEditing = useCallback(() => {
    if (currentDraft) {
      setEditContent(currentDraft.content);
      setIsEditing(true);
      clearError();
      // Focus textarea after render
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    }
  }, [currentDraft, clearError]);

  const handleCancelEditing = useCallback(() => {
    setEditContent(currentDraft?.content ?? "");
    setIsEditing(false);
    setComplianceIssues([]);
    clearError();
  }, [currentDraft, clearError]);

  const handleSaveEdit = useCallback(async () => {
    if (!currentDraft) return;
    if (isOverLimit) return;

    clearError();
    setIsSaving(true);

    try {
      const result = await apiEditDraft(currentDraft.id, editContent, userId);

      const updatedDraft: DraftResponse = {
        id: result.id,
        dmId: result.dmId,
        content: result.content,
        confidenceScore: result.confidenceScore,
        isEdited: result.isEdited,
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      setCurrentDraft(updatedDraft);
      setEditContent(result.content);
      setIsEditing(false);
      setComplianceIssues(result.complianceIssues ?? []);

      if (onDraftEdited) {
        onDraftEdited(updatedDraft);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  }, [currentDraft, editContent, userId, isOverLimit, onDraftEdited, handleError, clearError]);

  // ─── Approve Draft ─────────────────────────────────────────────────────

  const handleApproveDraft = useCallback(async () => {
    if (!currentDraft || !canApprove) return;

    clearError();
    setIsApproving(true);

    try {
      const result = await apiDraftAction(currentDraft.id, "approve", userId);

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

      setCurrentDraft(approvedDraft);
      setComplianceIssues([]);

      if (onDraftApproved) {
        onDraftApproved(approvedDraft);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsApproving(false);
    }
  }, [currentDraft, canApprove, userId, onDraftApproved, handleError, clearError]);

  // ─── Reject Draft ──────────────────────────────────────────────────────

  const handleRejectDraft = useCallback(async () => {
    if (!currentDraft || !canReject) return;

    clearError();
    setIsRejecting(true);

    try {
      const result = await apiDraftAction(currentDraft.id, "reject", userId, {
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

      setCurrentDraft(rejectedDraft);
      setShowRejectReason(false);
      setRejectReason("");

      if (onDraftRejected) {
        onDraftRejected(rejectedDraft);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsRejecting(false);
    }
  }, [currentDraft, canReject, userId, rejectReason, onDraftRejected, handleError, clearError]);

  // ─── Send Draft ────────────────────────────────────────────────────────

  const handleSendDraft = useCallback(async () => {
    if (!currentDraft || !canSend) return;

    clearError();
    setIsSending(true);

    try {
      const result = await apiDraftAction(currentDraft.id, "send", userId);

      const sentResult = result as { draftId: string; dmId: string; status: string; sentAt: string; platform: string; senderHandle: string };

      setCurrentDraft((prev) =>
        prev ? { ...prev, status: "sent" } : null
      );

      if (onDraftSent) {
        onDraftSent({
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
  }, [currentDraft, canSend, userId, onDraftSent, handleError, clearError]);

  // ─── Insert Property Info ──────────────────────────────────────────────

  const handleInsertPropertyInfo = useCallback(() => {
    if (!isEditing) {
      handleStartEditing();
    }

    const propertySnippet = "\n\nI'd recommend looking at our available listings in the area — we have some great options that match your requirements. Would you like me to send through the details?";

    setEditContent((prev) => {
      const newContent = prev + propertySnippet;
      return newContent.substring(0, MAX_CHARS);
    });

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 50);
  }, [isEditing, handleStartEditing]);

  // ─── Suggest Next Step ─────────────────────────────────────────────────

  const handleSuggestNextStep = useCallback(() => {
    if (!isEditing) {
      handleStartEditing();
    }

    const lower = dm.message.toLowerCase();
    let suggestion: string;

    if (lower.includes("display") || lower.includes("visit") || lower.includes("tour")) {
      suggestion = "\n\nWould you like to book a time to visit our display village? I can arrange a personal tour at a time that suits you. 🏡";
    } else if (lower.includes("first home") || lower.includes("first-home")) {
      suggestion = "\n\nAs a first home buyer, you may be eligible for the $10,000 First Home Owner Grant. Would you like me to connect you with our finance team to discuss your options?";
    } else if (lower.includes("invest")) {
      suggestion = "\n\nWould you like me to send through our investor information pack with detailed yield projections and depreciation schedules?";
    } else if (lower.includes("retirement") || lower.includes("downsize")) {
      suggestion = "\n\nI'd love to arrange a private tour so you can see the facilities firsthand. Would you be available this week?";
    } else {
      suggestion = "\n\nWould you like to chat more about your options? I'm happy to arrange a call or a visit to our display village at a time that suits you. 😊";
    }

    setEditContent((prev) => {
      const newContent = prev + suggestion;
      return newContent.substring(0, MAX_CHARS);
    });

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 50);
  }, [isEditing, dm.message, handleStartEditing]);

  // ─── Textarea Change ──────────────────────────────────────────────────

  const handleTextareaChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditContent(event.target.value);
      clearError();
    },
    [clearError]
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col gap-4 ${className}`.trim()}
      role="region"
      aria-label="Draft Composer"
    >
      {/* Original Message */}
      <OriginalMessagePreview dm={dm} />

      {/* Knowledge Base References */}
      <KnowledgeReferencesPanel references={knowledgeReferences} />

      {/* Error Message */}
      {errorMessage && (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Error</p>
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

      {/* No Draft State */}
      {!currentDraft && !isGenerating && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
          <SparklesIcon className="h-10 w-10 text-stockland-green/60" />
          <h3 className="mt-3 text-sm font-semibold text-stockland-charcoal">
            Generate AI Draft
          </h3>
          <p className="mt-1 text-xs text-gray-500 max-w-xs">
            Let the AI Co-Pilot generate a contextual draft response based on the customer&apos;s message and Stockland&apos;s knowledge base.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleGenerateDraft(false)}
            isLoading={isGenerating}
            className="mt-4"
            leftIcon={<SparklesIcon className="h-4 w-4" />}
          >
            Generate Draft
          </Button>
        </div>
      )}

      {/* Generating State */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-stockland-green/20 bg-stockland-green/5 px-6 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center">
            <SparklesIcon className="h-8 w-8 animate-pulse text-stockland-green" />
          </div>
          <p className="mt-3 text-sm font-medium text-stockland-charcoal">
            Generating AI draft...
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Analyzing message, retrieving knowledge base context, and composing response.
          </p>
        </div>
      )}

      {/* Draft Content */}
      {currentDraft && !isGenerating && (
        <>
          {/* Draft Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-stockland-charcoal">
                AI Draft Response
              </h3>
              <StatusBadge status={currentDraft.status} variant="draft" size="sm" />
              {currentDraft.isEdited && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Edited
                </span>
              )}
            </div>
            {!isDraftSent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleGenerateDraft(true)}
                isLoading={isGenerating}
                leftIcon={<RefreshIcon className="h-3.5 w-3.5" />}
                disabled={isAnyActionLoading}
              >
                Regenerate
              </Button>
            )}
          </div>

          {/* Confidence Meter */}
          <ConfidenceMeter
            score={confidenceScore}
            showLabel
            showTooltip
            size="md"
          />

          {/* Mandatory Review Warning */}
          {needsMandatoryReview && !isDraftSent && (
            <MandatoryReviewWarning confidenceScore={confidenceScore} />
          )}

          {/* Compliance Issues */}
          <ComplianceIssuesAlert issues={complianceIssues} />

          {/* Draft Content Area */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={handleTextareaChange}
                disabled={isAnyActionLoading}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm leading-relaxed text-gray-700 placeholder:text-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isOverLimit
                    ? "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : "border-gray-200 focus-visible:border-stockland-green focus-visible:ring-stockland-green"
                }`}
                rows={10}
                maxLength={MAX_CHARS + 100}
                aria-label="Edit draft content"
                aria-describedby="char-count"
              />
              <div className="flex items-center justify-between">
                <span
                  id="char-count"
                  className={`text-xs ${
                    isOverLimit ? "font-semibold text-red-600" : "text-gray-400"
                  }`}
                >
                  {charCount}/{MAX_CHARS} characters
                  {isOverLimit && " — exceeds limit"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEditing}
                    disabled={isAnyActionLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleSaveEdit()}
                    isLoading={isSaving}
                    disabled={isAnyActionLoading || isOverLimit || editContent.trim().length === 0}
                    leftIcon={<CheckIcon className="h-3.5 w-3.5" />}
                  >
                    Save Edit
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-lg border bg-white p-4 ${
                isDraftSent ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200"
              }`}
            >
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                {currentDraft.content}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {!isDraftSent && (
            <div className="space-y-3">
              {/* Quick Action Buttons */}
              {!isEditing && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleStartEditing}
                    disabled={isAnyActionLoading}
                    leftIcon={<EditIcon className="h-3.5 w-3.5" />}
                  >
                    Edit Draft
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleInsertPropertyInfo}
                    disabled={isAnyActionLoading}
                    leftIcon={<BuildingIcon className="h-3.5 w-3.5" />}
                  >
                    Insert Property Info
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSuggestNextStep}
                    disabled={isAnyActionLoading}
                    leftIcon={<LightbulbIcon className="h-3.5 w-3.5" />}
                  >
                    Suggest Next Step
                  </Button>
                </div>
              )}

              {/* Reject Reason Input */}
              {showRejectReason && (
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
                    onClick={() => void handleRejectDraft()}
                    isLoading={isRejecting}
                    disabled={isAnyActionLoading}
                  >
                    Confirm Reject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowRejectReason(false);
                      setRejectReason("");
                    }}
                    disabled={isRejecting}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Approve / Reject / Send Buttons */}
              {!isEditing && !showRejectReason && (
                <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                  {currentDraft.status === "pending" && (
                    <>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => void handleApproveDraft()}
                        isLoading={isApproving}
                        disabled={isAnyActionLoading || !canApprove}
                        leftIcon={<CheckIcon className="h-4 w-4" />}
                        title={
                          !canApprove && isVeryLowConfidence && !currentDraft.isEdited
                            ? "Low confidence draft must be edited before approval"
                            : undefined
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="md"
                        onClick={() => setShowRejectReason(true)}
                        disabled={isAnyActionLoading || !canReject}
                        leftIcon={<XIcon className="h-4 w-4" />}
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  {currentDraft.status === "approved" && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleSendDraft()}
                      isLoading={isSending}
                      disabled={isAnyActionLoading || !canSend}
                      leftIcon={<SendIcon className="h-4 w-4" />}
                    >
                      Send Reply
                    </Button>
                  )}

                  {currentDraft.status === "rejected" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        Draft was rejected. Edit and resubmit, or regenerate.
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleStartEditing}
                        disabled={isAnyActionLoading}
                        leftIcon={<EditIcon className="h-3.5 w-3.5" />}
                      >
                        Edit & Resubmit
                      </Button>
                    </div>
                  )}

                  {/* Cannot approve hint */}
                  {currentDraft.status === "pending" &&
                    !canApprove &&
                    isVeryLowConfidence &&
                    !currentDraft.isEdited && (
                      <span className="text-xs text-yellow-600">
                        ⚠ Edit required before approval (low confidence)
                      </span>
                    )}
                </div>
              )}
            </div>
          )}

          {/* Sent Confirmation */}
          {isDraftSent && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <CheckIcon className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Reply Sent Successfully
                </p>
                <p className="mt-0.5 text-xs text-emerald-600">
                  The draft has been sent as a reply to {dm.senderName} on{" "}
                  {dm.platform.charAt(0).toUpperCase() + dm.platform.slice(1)}.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DraftComposer;