import { prisma } from "@/lib/db";

export interface LogActionParams {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  details?: string | null;
}

/**
 * Record an audit log entry for compliance tracking.
 * Logs all system actions including DM ingestion, draft generation,
 * lead creation, Salesforce sync, and notifications.
 */
export async function logAction({
  action,
  entityType,
  entityId,
  userId = null,
  details = null,
}: LogActionParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        details,
      },
    });
  } catch (error) {
    // Log the error but do not throw — audit logging failures
    // should not block primary operations
    console.error("❌ Failed to write audit log:", {
      action,
      entityType,
      entityId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Predefined action constants for consistency across the codebase

export const AuditActions = {
  // DM actions
  DM_INGESTED: "dm_ingested",
  DM_STATUS_UPDATED: "dm_status_updated",

  // Draft actions
  DRAFT_GENERATED: "draft_generated",
  DRAFT_EDITED: "draft_edited",
  DRAFT_APPROVED: "draft_approved",
  DRAFT_REJECTED: "draft_rejected",
  DRAFT_SENT: "draft_sent",

  // Lead actions
  LEAD_CREATED: "lead_created",
  LEAD_UPDATED: "lead_updated",
  LEAD_ASSIGNED: "lead_assigned",
  LEAD_STATUS_CHANGED: "lead_status_changed",
  LEAD_SCORE_UPDATED: "lead_score_updated",

  // Salesforce actions
  SALESFORCE_SYNC_STARTED: "salesforce_sync_started",
  SALESFORCE_SYNC_SUCCESS: "salesforce_sync_success",
  SALESFORCE_SYNC_FAILED: "salesforce_sync_failed",

  // Notification actions
  NOTIFICATION_CREATED: "notification_created",
  NOTIFICATION_READ: "notification_read",
  NOTIFICATION_DISMISSED: "notification_dismissed",

  // PII / Compliance actions
  PII_DETECTED: "pii_detected",
  PII_REDACTED: "pii_redacted",
  COMPLIANCE_CHECK_FAILED: "compliance_check_failed",

  // User actions
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

// Predefined entity type constants for consistency

export const AuditEntityTypes = {
  DM: "dm",
  DRAFT: "draft",
  LEAD: "lead",
  NOTIFICATION: "notification",
  USER: "user",
  SALESFORCE: "salesforce",
} as const;

export type AuditEntityType = (typeof AuditEntityTypes)[keyof typeof AuditEntityTypes];

// Convenience helper functions for common audit log patterns

export async function logDMIngested(dmId: string, platform: string, senderHandle: string): Promise<void> {
  await logAction({
    action: AuditActions.DM_INGESTED,
    entityType: AuditEntityTypes.DM,
    entityId: dmId,
    details: `DM ingested from ${platform} — sender: ${senderHandle}.`,
  });
}

export async function logDraftGenerated(draftId: string, dmId: string, confidenceScore: number): Promise<void> {
  await logAction({
    action: AuditActions.DRAFT_GENERATED,
    entityType: AuditEntityTypes.DRAFT,
    entityId: draftId,
    details: `AI draft generated for DM ${dmId}. Confidence: ${(confidenceScore * 100).toFixed(1)}%.`,
  });
}

export async function logDraftEdited(draftId: string, userId: string): Promise<void> {
  await logAction({
    action: AuditActions.DRAFT_EDITED,
    entityType: AuditEntityTypes.DRAFT,
    entityId: draftId,
    userId,
    details: `Draft edited by agent.`,
  });
}

export async function logDraftApproved(draftId: string, userId: string): Promise<void> {
  await logAction({
    action: AuditActions.DRAFT_APPROVED,
    entityType: AuditEntityTypes.DRAFT,
    entityId: draftId,
    userId,
    details: `Draft approved by agent.`,
  });
}

export async function logDraftSent(draftId: string, userId: string, platform: string): Promise<void> {
  await logAction({
    action: AuditActions.DRAFT_SENT,
    entityType: AuditEntityTypes.DRAFT,
    entityId: draftId,
    userId,
    details: `Draft sent via ${platform}.`,
  });
}

export async function logLeadCreated(
  leadId: string,
  name: string,
  score: number,
  priorityFlag: boolean
): Promise<void> {
  await logAction({
    action: AuditActions.LEAD_CREATED,
    entityType: AuditEntityTypes.LEAD,
    entityId: leadId,
    details: `Lead auto-created for ${name}. Score: ${score}, Priority: ${priorityFlag ? "High" : "Normal"}.`,
  });
}

export async function logLeadAssigned(leadId: string, assignedTo: string, userId: string): Promise<void> {
  await logAction({
    action: AuditActions.LEAD_ASSIGNED,
    entityType: AuditEntityTypes.LEAD,
    entityId: leadId,
    userId,
    details: `Lead assigned to user ${assignedTo}.`,
  });
}

export async function logLeadStatusChanged(leadId: string, oldStatus: string, newStatus: string, userId?: string | null): Promise<void> {
  await logAction({
    action: AuditActions.LEAD_STATUS_CHANGED,
    entityType: AuditEntityTypes.LEAD,
    entityId: leadId,
    userId: userId ?? null,
    details: `Lead status changed from "${oldStatus}" to "${newStatus}".`,
  });
}

export async function logSalesforceSync(
  leadId: string,
  success: boolean,
  salesforceId?: string | null,
  error?: string | null
): Promise<void> {
  if (success) {
    await logAction({
      action: AuditActions.SALESFORCE_SYNC_SUCCESS,
      entityType: AuditEntityTypes.SALESFORCE,
      entityId: leadId,
      details: `Lead synced to Salesforce. Salesforce ID: ${salesforceId ?? "unknown"}.`,
    });
  } else {
    await logAction({
      action: AuditActions.SALESFORCE_SYNC_FAILED,
      entityType: AuditEntityTypes.SALESFORCE,
      entityId: leadId,
      details: `Salesforce sync failed for lead. Error: ${error ?? "unknown"}.`,
    });
  }
}

export async function logNotificationCreated(notificationId: string, type: string, recipient: string): Promise<void> {
  await logAction({
    action: AuditActions.NOTIFICATION_CREATED,
    entityType: AuditEntityTypes.NOTIFICATION,
    entityId: notificationId,
    details: `Notification created — type: ${type}, recipient: ${recipient}.`,
  });
}

export async function logPIIDetected(entityType: string, entityId: string, detectedTypes: string[]): Promise<void> {
  await logAction({
    action: AuditActions.PII_DETECTED,
    entityType,
    entityId,
    details: `PII detected — types: ${detectedTypes.join(", ")}. Content was sanitized before processing.`,
  });
}