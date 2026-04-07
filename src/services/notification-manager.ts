import { prisma } from "@/lib/db";
import {
  logNotificationCreated,
  logAction,
  AuditActions,
  AuditEntityTypes,
} from "@/services/audit-logger";
import {
  SLA_BREACH_THRESHOLD_MS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  LEAD_SCORE_HIGH_PRIORITY,
} from "@/lib/constants";
import type {
  NotificationResponse,
  NotificationFilterParams,
  PaginatedResponse,
} from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TriggerNotificationParams {
  type: string;
  recipient: string;
  dmId?: string | null;
  leadId?: string | null;
  details?: string | null;
}

export interface TriggerNotificationResult {
  notificationId: string;
  type: string;
  status: string;
  recipient: string;
  createdAt: string;
}

export interface MarkAsReadParams {
  notificationId: string;
}

export interface MarkAsDismissedParams {
  notificationId: string;
}

export interface SLABreachCheckResult {
  breachedDMs: Array<{
    dmId: string;
    senderName: string;
    senderHandle: string;
    platform: string;
    elapsedMs: number;
    elapsedMinutes: number;
  }>;
  notificationsCreated: number;
  errors: Array<{ dmId: string; error: string }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_NOTIFICATION_TYPES = [
  "new_dm",
  "high_priority_lead",
  "unassigned_lead",
  "draft_ready",
  "draft_sent",
  "lead_assigned",
  "escalation",
  "sla_breach",
  "salesforce_sync_success",
  "salesforce_sync_failed",
] as const;

type NotificationTypeValue = (typeof VALID_NOTIFICATION_TYPES)[number];

const VALID_NOTIFICATION_STATUSES = ["unread", "read", "dismissed"] as const;
type NotificationStatusValue = (typeof VALID_NOTIFICATION_STATUSES)[number];

// ─── Validation Helpers ──────────────────────────────────────────────────────

function isValidNotificationType(type: string): type is NotificationTypeValue {
  return VALID_NOTIFICATION_TYPES.includes(type as NotificationTypeValue);
}

function isValidNotificationStatus(status: string): status is NotificationStatusValue {
  return VALID_NOTIFICATION_STATUSES.includes(status as NotificationStatusValue);
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Trigger (create) a new notification.
 *
 * Creates a notification record in the database and logs the creation
 * in the audit log. Validates the notification type and ensures
 * referenced DM/Lead exist if provided.
 */
export async function triggerNotification(
  params: TriggerNotificationParams
): Promise<TriggerNotificationResult> {
  const { type, recipient, dmId = null, leadId = null, details = null } = params;

  if (!type || type.trim().length === 0) {
    throw new Error("Notification type is required.");
  }

  if (!recipient || recipient.trim().length === 0) {
    throw new Error("Notification recipient is required.");
  }

  const normalizedType = type.toLowerCase().trim();

  if (!isValidNotificationType(normalizedType)) {
    throw new Error(
      `Invalid notification type: "${type}". Valid types are: ${VALID_NOTIFICATION_TYPES.join(", ")}.`
    );
  }

  // Validate referenced DM exists if provided
  if (dmId) {
    const dm = await prisma.dM.findUnique({ where: { id: dmId } });
    if (!dm) {
      throw new Error(`Referenced DM not found: ${dmId}.`);
    }
  }

  // Validate referenced Lead exists if provided
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new Error(`Referenced Lead not found: ${leadId}.`);
    }
  }

  const notification = await prisma.notification.create({
    data: {
      type: normalizedType,
      status: "unread",
      recipient: recipient.trim(),
      dmId: dmId ?? null,
      leadId: leadId ?? null,
      details: details ?? null,
    },
  });

  // Log notification creation
  await logNotificationCreated(notification.id, normalizedType, recipient.trim());

  return {
    notificationId: notification.id,
    type: notification.type,
    status: notification.status,
    recipient: notification.recipient,
    createdAt: notification.createdAt.toISOString(),
  };
}

/**
 * Get notifications with pagination and filtering.
 * Supports filtering by type, status, and recipient.
 */
export async function getNotifications(
  params: NotificationFilterParams = {}
): Promise<PaginatedResponse<NotificationResponse>> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.type) {
    where.type = params.type.toLowerCase().trim();
  }

  if (params.status) {
    where.status = params.status.toLowerCase().trim();
  }

  if (params.recipient) {
    where.recipient = params.recipient.trim();
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        lead: true,
        dm: true,
      },
    }),
    prisma.notification.count({ where }),
  ]);

  const data: NotificationResponse[] = notifications.map((notif) => ({
    id: notif.id,
    leadId: notif.leadId,
    dmId: notif.dmId,
    type: notif.type,
    status: notif.status,
    recipient: notif.recipient,
    details: notif.details,
    createdAt: notif.createdAt.toISOString(),
    lead: notif.lead
      ? {
          id: notif.lead.id,
          dmId: notif.lead.dmId,
          name: notif.lead.name,
          contact: notif.lead.contact,
          budget: notif.lead.budget,
          location: notif.lead.location,
          intent: notif.lead.intent,
          score: notif.lead.score,
          priorityFlag: notif.lead.priorityFlag,
          salesforceId: notif.lead.salesforceId,
          status: notif.lead.status,
          assignedTo: notif.lead.assignedTo,
          createdAt: notif.lead.createdAt.toISOString(),
          updatedAt: notif.lead.updatedAt.toISOString(),
        }
      : null,
    dm: notif.dm
      ? {
          id: notif.dm.id,
          platform: notif.dm.platform,
          senderName: notif.dm.senderName,
          senderHandle: notif.dm.senderHandle,
          message: notif.dm.message,
          timestamp: notif.dm.timestamp.toISOString(),
          status: notif.dm.status,
          createdAt: notif.dm.createdAt.toISOString(),
          updatedAt: notif.dm.updatedAt.toISOString(),
        }
      : null,
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single notification by ID.
 */
export async function getNotificationById(
  notificationId: string
): Promise<NotificationResponse | null> {
  if (!notificationId || notificationId.trim().length === 0) {
    throw new Error("Notification ID is required.");
  }

  const notif = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      lead: true,
      dm: true,
    },
  });

  if (!notif) {
    return null;
  }

  return {
    id: notif.id,
    leadId: notif.leadId,
    dmId: notif.dmId,
    type: notif.type,
    status: notif.status,
    recipient: notif.recipient,
    details: notif.details,
    createdAt: notif.createdAt.toISOString(),
    lead: notif.lead
      ? {
          id: notif.lead.id,
          dmId: notif.lead.dmId,
          name: notif.lead.name,
          contact: notif.lead.contact,
          budget: notif.lead.budget,
          location: notif.lead.location,
          intent: notif.lead.intent,
          score: notif.lead.score,
          priorityFlag: notif.lead.priorityFlag,
          salesforceId: notif.lead.salesforceId,
          status: notif.lead.status,
          assignedTo: notif.lead.assignedTo,
          createdAt: notif.lead.createdAt.toISOString(),
          updatedAt: notif.lead.updatedAt.toISOString(),
        }
      : null,
    dm: notif.dm
      ? {
          id: notif.dm.id,
          platform: notif.dm.platform,
          senderName: notif.dm.senderName,
          senderHandle: notif.dm.senderHandle,
          message: notif.dm.message,
          timestamp: notif.dm.timestamp.toISOString(),
          status: notif.dm.status,
          createdAt: notif.dm.createdAt.toISOString(),
          updatedAt: notif.dm.updatedAt.toISOString(),
        }
      : null,
  };
}

/**
 * Mark a notification as read.
 * Updates the notification status from "unread" to "read".
 */
export async function markAsRead(
  params: MarkAsReadParams
): Promise<NotificationResponse> {
  const { notificationId } = params;

  if (!notificationId || notificationId.trim().length === 0) {
    throw new Error("Notification ID is required.");
  }

  const notif = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notif) {
    throw new Error(`Notification not found: ${notificationId}.`);
  }

  if (notif.status === "read") {
    // Already read — return as-is
    return {
      id: notif.id,
      leadId: notif.leadId,
      dmId: notif.dmId,
      type: notif.type,
      status: notif.status,
      recipient: notif.recipient,
      details: notif.details,
      createdAt: notif.createdAt.toISOString(),
    };
  }

  if (notif.status === "dismissed") {
    throw new Error("Cannot mark a dismissed notification as read.");
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: "read",
    },
  });

  await logAction({
    action: AuditActions.NOTIFICATION_READ,
    entityType: AuditEntityTypes.NOTIFICATION,
    entityId: notificationId,
    details: `Notification marked as read. Type: ${updated.type}, Recipient: ${updated.recipient}.`,
  });

  return {
    id: updated.id,
    leadId: updated.leadId,
    dmId: updated.dmId,
    type: updated.type,
    status: updated.status,
    recipient: updated.recipient,
    details: updated.details,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Mark a notification as dismissed.
 * Updates the notification status to "dismissed".
 */
export async function markAsDismissed(
  params: MarkAsDismissedParams
): Promise<NotificationResponse> {
  const { notificationId } = params;

  if (!notificationId || notificationId.trim().length === 0) {
    throw new Error("Notification ID is required.");
  }

  const notif = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notif) {
    throw new Error(`Notification not found: ${notificationId}.`);
  }

  if (notif.status === "dismissed") {
    // Already dismissed — return as-is
    return {
      id: notif.id,
      leadId: notif.leadId,
      dmId: notif.dmId,
      type: notif.type,
      status: notif.status,
      recipient: notif.recipient,
      details: notif.details,
      createdAt: notif.createdAt.toISOString(),
    };
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: "dismissed",
    },
  });

  await logAction({
    action: AuditActions.NOTIFICATION_DISMISSED,
    entityType: AuditEntityTypes.NOTIFICATION,
    entityId: notificationId,
    details: `Notification dismissed. Type: ${updated.type}, Recipient: ${updated.recipient}.`,
  });

  return {
    id: updated.id,
    leadId: updated.leadId,
    dmId: updated.dmId,
    type: updated.type,
    status: updated.status,
    recipient: updated.recipient,
    details: updated.details,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Mark all notifications as read for a specific recipient.
 * Returns the count of notifications updated.
 */
export async function markAllAsRead(recipient: string): Promise<{ updatedCount: number }> {
  if (!recipient || recipient.trim().length === 0) {
    throw new Error("Recipient is required.");
  }

  const result = await prisma.notification.updateMany({
    where: {
      recipient: recipient.trim(),
      status: "unread",
    },
    data: {
      status: "read",
    },
  });

  return { updatedCount: result.count };
}

/**
 * Get the count of unread notifications for a specific recipient.
 */
export async function getUnreadCount(recipient: string): Promise<number> {
  if (!recipient || recipient.trim().length === 0) {
    throw new Error("Recipient is required.");
  }

  const count = await prisma.notification.count({
    where: {
      recipient: recipient.trim(),
      status: "unread",
    },
  });

  return count;
}

// ─── High-Priority Lead Notification ─────────────────────────────────────────

/**
 * Trigger a notification for a high-priority lead.
 * Automatically determines the recipient based on lead assignment.
 * If the lead is unassigned, notifies all managers.
 */
export async function triggerHighPriorityLeadNotification(
  leadId: string
): Promise<TriggerNotificationResult[]> {
  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required.");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      dm: true,
      assignedUser: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}.`);
  }

  if (lead.score < LEAD_SCORE_HIGH_PRIORITY && !lead.priorityFlag) {
    // Not a high-priority lead — no notification needed
    return [];
  }

  const results: TriggerNotificationResult[] = [];

  const details = `High-priority lead from ${lead.name}${lead.budget ? ` — budget: ${lead.budget}` : ""}${lead.location ? `, location: ${lead.location}` : ""}. Score: ${lead.score}/10.`;

  if (lead.assignedTo && lead.assignedUser) {
    // Notify the assigned agent
    const result = await triggerNotification({
      type: "high_priority_lead",
      recipient: lead.assignedUser.email,
      leadId: lead.id,
      dmId: lead.dmId,
      details,
    });
    results.push(result);
  } else {
    // Lead is unassigned — notify all managers
    const managers = await prisma.user.findMany({
      where: { role: "manager" },
    });

    const unassignedDetails = `Unassigned high-priority lead from ${lead.name}${lead.budget ? ` — budget: ${lead.budget}` : ""}${lead.location ? `, location: ${lead.location}` : ""}. Score: ${lead.score}/10. Please assign an agent.`;

    for (const manager of managers) {
      try {
        const result = await triggerNotification({
          type: "unassigned_lead",
          recipient: manager.email,
          leadId: lead.id,
          dmId: lead.dmId,
          details: unassignedDetails,
        });
        results.push(result);
      } catch (error) {
        console.error(
          `⚠️ Failed to notify manager ${manager.email}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  return results;
}

// ─── SLA Breach Detection ────────────────────────────────────────────────────

/**
 * Check for SLA breaches on DMs that have been in "new" status
 * longer than the SLA threshold (default: 1 hour).
 *
 * For each breached DM, creates an SLA breach notification
 * for all managers. Returns a summary of breached DMs and
 * notifications created.
 */
export async function checkSLABreaches(): Promise<SLABreachCheckResult> {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - SLA_BREACH_THRESHOLD_MS);

  // Find DMs that are still "new" and older than the SLA threshold
  const breachedDMs = await prisma.dM.findMany({
    where: {
      status: "new",
      timestamp: {
        lt: thresholdDate,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  if (breachedDMs.length === 0) {
    return {
      breachedDMs: [],
      notificationsCreated: 0,
      errors: [],
    };
  }

  // Get all managers to notify
  const managers = await prisma.user.findMany({
    where: { role: "manager" },
  });

  // Also get agents for their assigned DMs
  const agents = await prisma.user.findMany({
    where: { role: "agent" },
  });

  const allRecipients = [...managers, ...agents];

  let notificationsCreated = 0;
  const errors: Array<{ dmId: string; error: string }> = [];

  const breachedDMDetails = breachedDMs.map((dm) => {
    const elapsedMs = now.getTime() - dm.timestamp.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    return {
      dmId: dm.id,
      senderName: dm.senderName,
      senderHandle: dm.senderHandle,
      platform: dm.platform,
      elapsedMs,
      elapsedMinutes,
    };
  });

  for (const dm of breachedDMs) {
    const elapsedMs = now.getTime() - dm.timestamp.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    // Check if an SLA breach notification already exists for this DM
    const existingNotification = await prisma.notification.findFirst({
      where: {
        dmId: dm.id,
        type: "sla_breach",
        status: { in: ["unread", "read"] },
      },
    });

    if (existingNotification) {
      // Already notified — skip to avoid duplicate notifications
      continue;
    }

    const details = `SLA breach: DM from ${dm.senderName} (${dm.senderHandle}) on ${dm.platform} has been unanswered for ${elapsedMinutes} minutes. Received at ${dm.timestamp.toISOString()}.`;

    // Notify managers about the SLA breach
    for (const recipient of managers) {
      try {
        await triggerNotification({
          type: "sla_breach",
          recipient: recipient.email,
          dmId: dm.id,
          details,
        });
        notificationsCreated++;
      } catch (error) {
        errors.push({
          dmId: dm.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    breachedDMs: breachedDMDetails,
    notificationsCreated,
    errors,
  };
}

// ─── Escalation Notification ─────────────────────────────────────────────────

/**
 * Trigger an escalation notification for a DM.
 * Notifies all managers that a DM has been escalated.
 */
export async function triggerEscalationNotification(
  dmId: string,
  escalatedBy: string,
  reason?: string | null
): Promise<TriggerNotificationResult[]> {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  if (!escalatedBy || escalatedBy.trim().length === 0) {
    throw new Error("Escalated by (user identifier) is required.");
  }

  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  const managers = await prisma.user.findMany({
    where: { role: "manager" },
  });

  const details = `DM from ${dm.senderName} (${dm.senderHandle}) on ${dm.platform} has been escalated by ${escalatedBy}.${reason ? ` Reason: ${reason}` : ""}`;

  const results: TriggerNotificationResult[] = [];

  for (const manager of managers) {
    try {
      const result = await triggerNotification({
        type: "escalation",
        recipient: manager.email,
        dmId: dm.id,
        details,
      });
      results.push(result);
    } catch (error) {
      console.error(
        `⚠️ Failed to notify manager ${manager.email} about escalation:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return results;
}

// ─── Salesforce Sync Notification ────────────────────────────────────────────

/**
 * Trigger a notification for a Salesforce sync result.
 * Notifies the assigned agent (or all managers if unassigned)
 * about the sync success or failure.
 */
export async function triggerSalesforceSyncNotification(
  leadId: string,
  success: boolean,
  salesforceId?: string | null,
  error?: string | null
): Promise<TriggerNotificationResult[]> {
  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required.");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      assignedUser: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}.`);
  }

  const type = success ? "salesforce_sync_success" : "salesforce_sync_failed";
  const details = success
    ? `Lead "${lead.name}" successfully synced to Salesforce. Salesforce ID: ${salesforceId ?? "unknown"}.`
    : `Salesforce sync failed for lead "${lead.name}". Error: ${error ?? "unknown"}.`;

  const results: TriggerNotificationResult[] = [];

  if (lead.assignedTo && lead.assignedUser) {
    try {
      const result = await triggerNotification({
        type,
        recipient: lead.assignedUser.email,
        leadId: lead.id,
        dmId: lead.dmId,
        details,
      });
      results.push(result);
    } catch (err) {
      console.error(
        `⚠️ Failed to notify agent about Salesforce sync:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  } else {
    // Notify managers if lead is unassigned
    const managers = await prisma.user.findMany({
      where: { role: "manager" },
    });

    for (const manager of managers) {
      try {
        const result = await triggerNotification({
          type,
          recipient: manager.email,
          leadId: lead.id,
          dmId: lead.dmId,
          details,
        });
        results.push(result);
      } catch (err) {
        console.error(
          `⚠️ Failed to notify manager about Salesforce sync:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  return results;
}

// ─── New DM Notification ─────────────────────────────────────────────────────

/**
 * Trigger a notification for a new DM received.
 * Notifies all agents about the new incoming DM.
 */
export async function triggerNewDMNotification(
  dmId: string
): Promise<TriggerNotificationResult[]> {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  const agents = await prisma.user.findMany({
    where: { role: "agent" },
  });

  const details = `New DM from ${dm.senderName} (${dm.senderHandle}) on ${dm.platform}.`;

  const results: TriggerNotificationResult[] = [];

  for (const agent of agents) {
    try {
      const result = await triggerNotification({
        type: "new_dm",
        recipient: agent.email,
        dmId: dm.id,
        details,
      });
      results.push(result);
    } catch (error) {
      console.error(
        `⚠️ Failed to notify agent ${agent.email} about new DM:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return results;
}

// ─── Lead Assignment Notification ────────────────────────────────────────────

/**
 * Trigger a notification when a lead is assigned to an agent.
 */
export async function triggerLeadAssignedNotification(
  leadId: string,
  assignedToUserId: string
): Promise<TriggerNotificationResult | null> {
  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required.");
  }

  if (!assignedToUserId || assignedToUserId.trim().length === 0) {
    throw new Error("Assigned user ID is required.");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      dm: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}.`);
  }

  const assignedUser = await prisma.user.findUnique({
    where: { id: assignedToUserId },
  });

  if (!assignedUser) {
    throw new Error(`Assigned user not found: ${assignedToUserId}.`);
  }

  const details = `Lead "${lead.name}" has been assigned to you.${lead.budget ? ` Budget: ${lead.budget}.` : ""}${lead.location ? ` Location: ${lead.location}.` : ""} Score: ${lead.score}/10.`;

  try {
    const result = await triggerNotification({
      type: "lead_assigned",
      recipient: assignedUser.email,
      leadId: lead.id,
      dmId: lead.dmId,
      details,
    });
    return result;
  } catch (error) {
    console.error(
      `⚠️ Failed to notify agent ${assignedUser.email} about lead assignment:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// ─── Draft Ready Notification ────────────────────────────────────────────────

/**
 * Trigger a notification when an AI draft is ready for review.
 */
export async function triggerDraftReadyNotification(
  draftId: string,
  dmId: string
): Promise<TriggerNotificationResult[]> {
  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required.");
  }

  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  const agents = await prisma.user.findMany({
    where: { role: "agent" },
  });

  const details = `AI draft ready for review — DM from ${dm.senderName} (${dm.senderHandle}) on ${dm.platform}. Draft ID: ${draftId}.`;

  const results: TriggerNotificationResult[] = [];

  for (const agent of agents) {
    try {
      const result = await triggerNotification({
        type: "draft_ready",
        recipient: agent.email,
        dmId: dm.id,
        details,
      });
      results.push(result);
    } catch (error) {
      console.error(
        `⚠️ Failed to notify agent ${agent.email} about draft ready:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return results;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Delete old dismissed notifications older than the specified number of days.
 * Used for data lifecycle management.
 */
export async function cleanupDismissedNotifications(
  olderThanDays: number = 90
): Promise<{ deletedCount: number }> {
  if (olderThanDays < 1) {
    throw new Error("olderThanDays must be at least 1.");
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.notification.deleteMany({
    where: {
      status: "dismissed",
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return { deletedCount: result.count };
}

/**
 * Get notification statistics for a recipient.
 * Returns counts by type and status.
 */
export async function getNotificationStats(
  recipient: string
): Promise<{
  total: number;
  unread: number;
  read: number;
  dismissed: number;
  byType: Record<string, number>;
}> {
  if (!recipient || recipient.trim().length === 0) {
    throw new Error("Recipient is required.");
  }

  const trimmedRecipient = recipient.trim();

  const [total, unread, read, dismissed] = await Promise.all([
    prisma.notification.count({ where: { recipient: trimmedRecipient } }),
    prisma.notification.count({ where: { recipient: trimmedRecipient, status: "unread" } }),
    prisma.notification.count({ where: { recipient: trimmedRecipient, status: "read" } }),
    prisma.notification.count({ where: { recipient: trimmedRecipient, status: "dismissed" } }),
  ]);

  // Count by type
  const byTypeResults = await prisma.notification.groupBy({
    by: ["type"],
    where: { recipient: trimmedRecipient },
    _count: {
      type: true,
    },
  });

  const byType: Record<string, number> = {};
  for (const result of byTypeResults) {
    byType[result.type] = result._count.type;
  }

  return {
    total,
    unread,
    read,
    dismissed,
    byType,
  };
}