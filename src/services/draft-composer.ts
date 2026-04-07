import { prisma } from "@/lib/db";
import { validateDraftCompliance, checkTextForPII, redactPII } from "@/services/privacy-compliance";
import {
  logDraftEdited,
  logDraftApproved,
  logDraftSent,
  logAction,
  AuditActions,
  AuditEntityTypes,
} from "@/services/audit-logger";
import { updateDMStatus } from "@/services/dm-status-tracker";
import { CONFIDENCE_THRESHOLD_MEDIUM } from "@/lib/constants";
import type { DraftResponse } from "@/types";

// Valid draft statuses
const VALID_DRAFT_STATUSES = ["pending", "approved", "sent", "rejected"] as const;
type DraftStatusValue = (typeof VALID_DRAFT_STATUSES)[number];

// Valid draft status transitions
const VALID_DRAFT_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["sent", "pending"],
  sent: [],
  rejected: ["pending"],
};

export interface EditDraftParams {
  draftId: string;
  content: string;
  userId: string;
}

export interface ApproveDraftParams {
  draftId: string;
  userId: string;
}

export interface RejectDraftParams {
  draftId: string;
  userId: string;
  reason?: string;
}

export interface SendDraftParams {
  draftId: string;
  userId: string;
  finalContent?: string;
}

export interface EditDraftResult extends DraftResponse {
  previousContent: string;
  complianceIssues: string[];
}

export interface SendDraftResult {
  draftId: string;
  dmId: string;
  status: string;
  sentAt: string;
  platform: string;
  senderHandle: string;
}

function isValidDraftStatus(status: string): status is DraftStatusValue {
  return VALID_DRAFT_STATUSES.includes(status as DraftStatusValue);
}

function isValidDraftTransition(fromStatus: string, toStatus: string): boolean {
  const allowed = VALID_DRAFT_TRANSITIONS[fromStatus];
  if (!allowed) {
    return false;
  }
  return allowed.includes(toStatus);
}

/**
 * Edit an AI-generated draft. Validates compliance (no PII in edited content),
 * marks the draft as edited, and persists the updated content.
 * Returns the updated draft along with any compliance issues detected.
 */
export async function editDraft(params: EditDraftParams): Promise<EditDraftResult> {
  const { draftId, content, userId } = params;

  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required.");
  }

  if (!content || content.trim().length === 0) {
    throw new Error("Draft content cannot be empty.");
  }

  if (!userId || userId.trim().length === 0) {
    throw new Error("User ID is required.");
  }

  if (content.length > 2000) {
    throw new Error("Draft content exceeds maximum length of 2000 characters.");
  }

  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: {
      dm: true,
    },
  });

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}.`);
  }

  if (draft.status === "sent") {
    throw new Error("Cannot edit a draft that has already been sent.");
  }

  // Validate compliance of the edited content
  const complianceResult = validateDraftCompliance(content);
  let contentToStore = content.trim();

  if (complianceResult.piiCheck.hasPII) {
    // Redact PII from the edited content before storing
    contentToStore = redactPII(contentToStore);
  }

  const previousContent = draft.content;

  // Update the draft
  const updatedDraft = await prisma.draft.update({
    where: { id: draftId },
    data: {
      content: contentToStore,
      isEdited: true,
      // Reset status to pending if it was rejected, so it can be re-reviewed
      status: draft.status === "rejected" ? "pending" : draft.status,
    },
    include: {
      dm: true,
    },
  });

  // Log the edit
  await logDraftEdited(draftId, userId);

  return {
    id: updatedDraft.id,
    dmId: updatedDraft.dmId,
    content: updatedDraft.content,
    confidenceScore: updatedDraft.confidenceScore,
    isEdited: updatedDraft.isEdited,
    status: updatedDraft.status,
    createdAt: updatedDraft.createdAt.toISOString(),
    updatedAt: updatedDraft.updatedAt.toISOString(),
    previousContent,
    complianceIssues: complianceResult.issues,
  };
}

/**
 * Approve a draft for sending. Enforces human-in-the-loop review:
 * low-confidence drafts that have not been edited cannot be approved.
 * Updates draft status to "approved".
 */
export async function approveDraft(params: ApproveDraftParams): Promise<DraftResponse> {
  const { draftId, userId } = params;

  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required.");
  }

  if (!userId || userId.trim().length === 0) {
    throw new Error("User ID is required.");
  }

  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: {
      dm: true,
    },
  });

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}.`);
  }

  if (!isValidDraftTransition(draft.status, "approved")) {
    throw new Error(
      `Cannot approve draft with status "${draft.status}". ` +
        `Allowed transitions from "${draft.status}": ${(VALID_DRAFT_TRANSITIONS[draft.status] ?? []).join(", ") || "none"}.`
    );
  }

  // Enforce human-in-the-loop: low-confidence drafts must be edited before approval
  if (draft.confidenceScore < CONFIDENCE_THRESHOLD_MEDIUM && !draft.isEdited) {
    throw new Error(
      `Draft has low confidence (${(draft.confidenceScore * 100).toFixed(1)}%) and has not been edited. ` +
        `Please review and edit the draft before approving.`
    );
  }

  // Final compliance check before approval
  const complianceResult = validateDraftCompliance(draft.content);
  if (!complianceResult.isCompliant) {
    throw new Error(
      `Draft cannot be approved due to compliance issues: ${complianceResult.issues.join("; ")}`
    );
  }

  const updatedDraft = await prisma.draft.update({
    where: { id: draftId },
    data: {
      status: "approved",
    },
  });

  // Log the approval
  await logDraftApproved(draftId, userId);

  return {
    id: updatedDraft.id,
    dmId: updatedDraft.dmId,
    content: updatedDraft.content,
    confidenceScore: updatedDraft.confidenceScore,
    isEdited: updatedDraft.isEdited,
    status: updatedDraft.status,
    createdAt: updatedDraft.createdAt.toISOString(),
    updatedAt: updatedDraft.updatedAt.toISOString(),
  };
}

/**
 * Reject a draft. Updates draft status to "rejected" with an optional reason.
 */
export async function rejectDraft(params: RejectDraftParams): Promise<DraftResponse> {
  const { draftId, userId, reason } = params;

  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required.");
  }

  if (!userId || userId.trim().length === 0) {
    throw new Error("User ID is required.");
  }

  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}.`);
  }

  if (!isValidDraftTransition(draft.status, "rejected")) {
    throw new Error(
      `Cannot reject draft with status "${draft.status}". ` +
        `Allowed transitions from "${draft.status}": ${(VALID_DRAFT_TRANSITIONS[draft.status] ?? []).join(", ") || "none"}.`
    );
  }

  const updatedDraft = await prisma.draft.update({
    where: { id: draftId },
    data: {
      status: "rejected",
    },
  });

  await logAction({
    action: AuditActions.DRAFT_REJECTED,
    entityType: AuditEntityTypes.DRAFT,
    entityId: draftId,
    userId,
    details: reason
      ? `Draft rejected by agent. Reason: ${reason}`
      : `Draft rejected by agent.`,
  });

  return {
    id: updatedDraft.id,
    dmId: updatedDraft.dmId,
    content: updatedDraft.content,
    confidenceScore: updatedDraft.confidenceScore,
    isEdited: updatedDraft.isEdited,
    status: updatedDraft.status,
    createdAt: updatedDraft.createdAt.toISOString(),
    updatedAt: updatedDraft.updatedAt.toISOString(),
  };
}

/**
 * Send an approved draft as a reply. Enforces human-in-the-loop:
 * only approved drafts can be sent. Optionally accepts final content
 * for last-minute edits (which are compliance-checked).
 * Updates draft status to "sent" and DM status to "sent".
 */
export async function sendDraft(params: SendDraftParams): Promise<SendDraftResult> {
  const { draftId, userId, finalContent } = params;

  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required.");
  }

  if (!userId || userId.trim().length === 0) {
    throw new Error("User ID is required.");
  }

  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: {
      dm: true,
    },
  });

  if (!draft) {
    throw new Error(`Draft not found: ${draftId}.`);
  }

  if (!draft.dm) {
    throw new Error(`Associated DM not found for draft: ${draftId}.`);
  }

  // Enforce human-in-the-loop: only approved drafts can be sent
  if (draft.status !== "approved") {
    throw new Error(
      `Draft must be approved before sending. Current status: "${draft.status}". ` +
        `Please approve the draft first.`
    );
  }

  // Determine the content to send
  let contentToSend = draft.content;

  if (finalContent !== undefined && finalContent !== null) {
    const trimmedFinal = finalContent.trim();

    if (trimmedFinal.length === 0) {
      throw new Error("Final content cannot be empty.");
    }

    if (trimmedFinal.length > 2000) {
      throw new Error("Final content exceeds maximum length of 2000 characters.");
    }

    // Compliance check on final content
    const complianceResult = validateDraftCompliance(trimmedFinal);
    if (!complianceResult.isCompliant) {
      throw new Error(
        `Final content cannot be sent due to compliance issues: ${complianceResult.issues.join("; ")}`
      );
    }

    contentToSend = trimmedFinal;
  }

  // Final PII check before sending
  const piiCheck = checkTextForPII(contentToSend);
  if (piiCheck.hasPII) {
    throw new Error(
      `Cannot send draft — PII detected in content: ${piiCheck.detectedTypes.join(", ")}. ` +
        `Please remove personal information before sending.`
    );
  }

  // Update draft status to sent and persist final content
  const updatedDraft = await prisma.draft.update({
    where: { id: draftId },
    data: {
      content: contentToSend,
      status: "sent",
      isEdited: finalContent !== undefined && finalContent !== null ? true : draft.isEdited,
    },
  });

  // Update DM status to sent
  try {
    await updateDMStatus({
      dmId: draft.dmId,
      newStatus: "sent",
      changedBy: userId,
      details: `Draft ${draftId} sent as reply by agent.`,
    });
  } catch (error) {
    // If DM status update fails (e.g., invalid transition), log but don't block
    // The draft is already marked as sent
    console.error(
      "⚠️ Failed to update DM status to sent:",
      error instanceof Error ? error.message : String(error)
    );

    // Try to update to "replied" as a fallback
    try {
      await updateDMStatus({
        dmId: draft.dmId,
        newStatus: "replied",
        changedBy: userId,
        details: `Draft ${draftId} sent as reply by agent (fallback status).`,
      });
    } catch (fallbackError) {
      console.error(
        "⚠️ Failed to update DM status to replied (fallback):",
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      );
    }
  }

  // Log the send action
  await logDraftSent(draftId, userId, draft.dm.platform);

  const sentAt = new Date().toISOString();

  return {
    draftId: updatedDraft.id,
    dmId: draft.dmId,
    status: "sent",
    sentAt,
    platform: draft.dm.platform,
    senderHandle: draft.dm.senderHandle,
  };
}

/**
 * Get a draft by ID with its associated DM.
 */
export async function getDraftById(draftId: string): Promise<DraftResponse | null> {
  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required.");
  }

  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: {
      dm: true,
    },
  });

  if (!draft) {
    return null;
  }

  return {
    id: draft.id,
    dmId: draft.dmId,
    content: draft.content,
    confidenceScore: draft.confidenceScore,
    isEdited: draft.isEdited,
    status: draft.status,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    dm: draft.dm
      ? {
          id: draft.dm.id,
          platform: draft.dm.platform,
          senderName: draft.dm.senderName,
          senderHandle: draft.dm.senderHandle,
          message: draft.dm.message,
          timestamp: draft.dm.timestamp.toISOString(),
          status: draft.dm.status,
          createdAt: draft.dm.createdAt.toISOString(),
          updatedAt: draft.dm.updatedAt.toISOString(),
        }
      : undefined,
  };
}

/**
 * List drafts for a specific DM, ordered by most recent first.
 */
export async function listDraftsForDM(dmId: string): Promise<DraftResponse[]> {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  const drafts = await prisma.draft.findMany({
    where: { dmId },
    orderBy: { createdAt: "desc" },
  });

  return drafts.map((draft) => ({
    id: draft.id,
    dmId: draft.dmId,
    content: draft.content,
    confidenceScore: draft.confidenceScore,
    isEdited: draft.isEdited,
    status: draft.status,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  }));
}

/**
 * Get the list of valid status transitions for a draft.
 * Useful for UI to show available actions.
 */
export function getValidDraftTransitions(currentStatus: string): string[] {
  const normalized = currentStatus.toLowerCase().trim();
  return VALID_DRAFT_TRANSITIONS[normalized] ?? [];
}

/**
 * Check if a specific draft status transition is allowed.
 */
export function canTransitionDraft(fromStatus: string, toStatus: string): boolean {
  const normalizedFrom = fromStatus.toLowerCase().trim();
  const normalizedTo = toStatus.toLowerCase().trim();

  if (!isValidDraftStatus(normalizedFrom) || !isValidDraftStatus(normalizedTo)) {
    return false;
  }

  return isValidDraftTransition(normalizedFrom, normalizedTo);
}

/**
 * Check if a draft is ready to be sent (approved and compliant).
 */
export async function isDraftReadyToSend(draftId: string): Promise<{
  ready: boolean;
  issues: string[];
}> {
  if (!draftId || draftId.trim().length === 0) {
    return { ready: false, issues: ["Draft ID is required."] };
  }

  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    return { ready: false, issues: [`Draft not found: ${draftId}.`] };
  }

  const issues: string[] = [];

  if (draft.status !== "approved") {
    issues.push(`Draft must be approved before sending. Current status: "${draft.status}".`);
  }

  const complianceResult = validateDraftCompliance(draft.content);
  if (!complianceResult.isCompliant) {
    issues.push(...complianceResult.issues);
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}