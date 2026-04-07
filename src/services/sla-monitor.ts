import { prisma } from "@/lib/db";
import { SLA_BREACH_THRESHOLD_MS } from "@/lib/constants";
import {
  triggerNotification,
  triggerEscalationNotification,
} from "@/services/notification-manager";
import { updateDMStatus } from "@/services/dm-status-tracker";
import {
  logAction,
  AuditActions,
  AuditEntityTypes,
} from "@/services/audit-logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SLABreachedDM {
  dmId: string;
  platform: string;
  senderName: string;
  senderHandle: string;
  message: string;
  timestamp: string;
  status: string;
  elapsedMs: number;
  elapsedMinutes: number;
  elapsedHours: number;
}

export interface SLABreachResult {
  checkedAt: string;
  thresholdMs: number;
  thresholdMinutes: number;
  breachedDMs: SLABreachedDM[];
  notificationsCreated: number;
  escalationsTriggered: number;
  errors: Array<{ dmId: string; error: string }>;
}

export interface SLAStatusSummary {
  totalNewDMs: number;
  withinSLA: number;
  approachingSLA: number;
  breachedSLA: number;
  oldestUnrespondedMinutes: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// DMs approaching SLA breach (at 75% of threshold)
const SLA_WARNING_THRESHOLD_MS = Math.floor(SLA_BREACH_THRESHOLD_MS * 0.75);

// Escalation threshold: DMs unanswered for 2x the SLA threshold
const SLA_ESCALATION_THRESHOLD_MS = SLA_BREACH_THRESHOLD_MS * 2;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Check for SLA breaches on DMs that have been in "new" status
 * longer than the SLA threshold (default: 1 hour).
 *
 * For each breached DM:
 * 1. Creates an SLA breach notification for all managers
 * 2. If the DM has exceeded the escalation threshold (2x SLA),
 *    triggers an escalation notification
 * 3. Logs the SLA breach in the audit log
 *
 * Deduplicates notifications — will not create a new SLA breach
 * notification if one already exists (unread or read) for the same DM.
 *
 * Returns a summary of breached DMs, notifications created, and any errors.
 */
export async function checkSLABreaches(): Promise<SLABreachResult> {
  const now = new Date();
  const checkedAt = now.toISOString();
  const thresholdDate = new Date(now.getTime() - SLA_BREACH_THRESHOLD_MS);
  const escalationDate = new Date(now.getTime() - SLA_ESCALATION_THRESHOLD_MS);

  // Find DMs that are still "new" and older than the SLA threshold
  const breachedDMRecords = await prisma.dM.findMany({
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

  if (breachedDMRecords.length === 0) {
    return {
      checkedAt,
      thresholdMs: SLA_BREACH_THRESHOLD_MS,
      thresholdMinutes: Math.floor(SLA_BREACH_THRESHOLD_MS / 60000),
      breachedDMs: [],
      notificationsCreated: 0,
      escalationsTriggered: 0,
      errors: [],
    };
  }

  // Get all managers to notify
  const managers = await prisma.user.findMany({
    where: { role: "manager" },
  });

  let notificationsCreated = 0;
  let escalationsTriggered = 0;
  const errors: Array<{ dmId: string; error: string }> = [];

  const breachedDMs: SLABreachedDM[] = breachedDMRecords.map((dm) => {
    const elapsedMs = now.getTime() - dm.timestamp.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedHours = Math.round((elapsedMs / 3600000) * 10) / 10;
    return {
      dmId: dm.id,
      platform: dm.platform,
      senderName: dm.senderName,
      senderHandle: dm.senderHandle,
      message: dm.message,
      timestamp: dm.timestamp.toISOString(),
      status: dm.status,
      elapsedMs,
      elapsedMinutes,
      elapsedHours,
    };
  });

  for (const dm of breachedDMRecords) {
    const elapsedMs = now.getTime() - dm.timestamp.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    try {
      // Check if an SLA breach notification already exists for this DM
      const existingNotification = await prisma.notification.findFirst({
        where: {
          dmId: dm.id,
          type: "sla_breach",
          status: { in: ["unread", "read"] },
        },
      });

      if (existingNotification) {
        // Already notified — check if we need to escalate
        const needsEscalation = dm.timestamp.getTime() < escalationDate.getTime();

        if (needsEscalation) {
          // Check if escalation already exists
          const existingEscalation = await prisma.notification.findFirst({
            where: {
              dmId: dm.id,
              type: "escalation",
              status: { in: ["unread", "read"] },
            },
          });

          if (!existingEscalation) {
            try {
              const escalationResults = await triggerEscalationNotification(
                dm.id,
                "system",
                `SLA breach escalation: DM unanswered for ${elapsedMinutes} minutes (${Math.round(elapsedMs / 3600000 * 10) / 10} hours). Automatic escalation triggered.`
              );
              escalationsTriggered += escalationResults.length;

              // Update DM status to escalated
              try {
                await updateDMStatus({
                  dmId: dm.id,
                  newStatus: "escalated",
                  changedBy: "system",
                  details: `DM auto-escalated due to SLA breach. Unanswered for ${elapsedMinutes} minutes.`,
                });
              } catch (statusError) {
                // Status update failure should not block escalation
                console.error(
                  `⚠️ Failed to update DM status to escalated for ${dm.id}:`,
                  statusError instanceof Error ? statusError.message : String(statusError)
                );
              }

              // Log the escalation
              await logAction({
                action: AuditActions.DM_STATUS_UPDATED,
                entityType: AuditEntityTypes.DM,
                entityId: dm.id,
                details: `SLA breach escalation: DM from ${dm.senderName} (${dm.senderHandle}) on ${dm.platform} unanswered for ${elapsedMinutes} minutes. Auto-escalated by system.`,
              });
            } catch (escalationError) {
              errors.push({
                dmId: dm.id,
                error: `Escalation failed: ${escalationError instanceof Error ? escalationError.message : String(escalationError)}`,
              });
            }
          }
        }

        // Skip creating a new SLA breach notification since one already exists
        continue;
      }

      // Create SLA breach notifications for all managers
      const details = `SLA breach: DM from ${dm.senderName} (${dm.senderHandle}) on ${dm.platform} has been unanswered for ${elapsedMinutes} minutes. Received at ${dm.timestamp.toISOString()}.`;

      for (const manager of managers) {
        try {
          await triggerNotification({
            type: "sla_breach",
            recipient: manager.email,
            dmId: dm.id,
            details,
          });
          notificationsCreated++;
        } catch (notifError) {
          errors.push({
            dmId: dm.id,
            error: `Failed to notify ${manager.email}: ${notifError instanceof Error ? notifError.message : String(notifError)}`,
          });
        }
      }

      // Log the SLA breach detection in audit
      await logAction({
        action: "sla_breach_detected",
        entityType: AuditEntityTypes.DM,
        entityId: dm.id,
        details: `SLA breach detected: DM from ${dm.senderName} (${dm.senderHandle}) on ${dm.platform} unanswered for ${elapsedMinutes} minutes. ${managers.length} manager(s) notified.`,
      });
    } catch (error) {
      errors.push({
        dmId: dm.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    checkedAt,
    thresholdMs: SLA_BREACH_THRESHOLD_MS,
    thresholdMinutes: Math.floor(SLA_BREACH_THRESHOLD_MS / 60000),
    breachedDMs,
    notificationsCreated,
    escalationsTriggered,
    errors,
  };
}

/**
 * Get a summary of SLA status across all active DMs.
 * Returns counts of DMs within SLA, approaching SLA, and breached SLA.
 * Useful for dashboard display.
 */
export async function getSLAStatusSummary(): Promise<SLAStatusSummary> {
  const now = new Date();
  const breachThresholdDate = new Date(now.getTime() - SLA_BREACH_THRESHOLD_MS);
  const warningThresholdDate = new Date(now.getTime() - SLA_WARNING_THRESHOLD_MS);

  // Get all DMs in "new" status
  const newDMs = await prisma.dM.findMany({
    where: {
      status: "new",
    },
    orderBy: {
      timestamp: "asc",
    },
    select: {
      id: true,
      timestamp: true,
    },
  });

  const totalNewDMs = newDMs.length;
  let withinSLA = 0;
  let approachingSLA = 0;
  let breachedSLA = 0;
  let oldestUnrespondedMinutes: number | null = null;

  for (const dm of newDMs) {
    const dmTimestamp = dm.timestamp.getTime();

    if (dmTimestamp < breachThresholdDate.getTime()) {
      breachedSLA++;
    } else if (dmTimestamp < warningThresholdDate.getTime()) {
      approachingSLA++;
    } else {
      withinSLA++;
    }
  }

  // Calculate oldest unresponded DM age
  if (newDMs.length > 0) {
    const oldestDM = newDMs[0]; // Already sorted by timestamp asc
    const elapsedMs = now.getTime() - oldestDM.timestamp.getTime();
    oldestUnrespondedMinutes = Math.floor(elapsedMs / 60000);
  }

  return {
    totalNewDMs,
    withinSLA,
    approachingSLA,
    breachedSLA,
    oldestUnrespondedMinutes,
  };
}

/**
 * Get all DMs that are currently breaching SLA.
 * Returns detailed information about each breached DM.
 */
export async function getBreachedDMs(): Promise<SLABreachedDM[]> {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - SLA_BREACH_THRESHOLD_MS);

  const breachedDMRecords = await prisma.dM.findMany({
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

  return breachedDMRecords.map((dm) => {
    const elapsedMs = now.getTime() - dm.timestamp.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedHours = Math.round((elapsedMs / 3600000) * 10) / 10;
    return {
      dmId: dm.id,
      platform: dm.platform,
      senderName: dm.senderName,
      senderHandle: dm.senderHandle,
      message: dm.message,
      timestamp: dm.timestamp.toISOString(),
      status: dm.status,
      elapsedMs,
      elapsedMinutes,
      elapsedHours,
    };
  });
}

/**
 * Get DMs that are approaching the SLA breach threshold (75% of threshold).
 * Useful for proactive alerting before a breach occurs.
 */
export async function getApproachingSLADMs(): Promise<SLABreachedDM[]> {
  const now = new Date();
  const breachThresholdDate = new Date(now.getTime() - SLA_BREACH_THRESHOLD_MS);
  const warningThresholdDate = new Date(now.getTime() - SLA_WARNING_THRESHOLD_MS);

  const approachingDMRecords = await prisma.dM.findMany({
    where: {
      status: "new",
      timestamp: {
        gte: breachThresholdDate,
        lt: warningThresholdDate,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  return approachingDMRecords.map((dm) => {
    const elapsedMs = now.getTime() - dm.timestamp.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedHours = Math.round((elapsedMs / 3600000) * 10) / 10;
    return {
      dmId: dm.id,
      platform: dm.platform,
      senderName: dm.senderName,
      senderHandle: dm.senderHandle,
      message: dm.message,
      timestamp: dm.timestamp.toISOString(),
      status: dm.status,
      elapsedMs,
      elapsedMinutes,
      elapsedHours,
    };
  });
}

/**
 * Calculate the time remaining before a specific DM breaches SLA.
 * Returns the remaining time in milliseconds, or a negative value if already breached.
 */
export async function getTimeToSLABreach(
  dmId: string
): Promise<{
  dmId: string;
  remainingMs: number;
  remainingMinutes: number;
  isBreached: boolean;
  isApproaching: boolean;
}> {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
    select: {
      id: true,
      timestamp: true,
      status: true,
    },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  // If DM is not in "new" status, SLA is not applicable
  if (dm.status !== "new") {
    return {
      dmId: dm.id,
      remainingMs: SLA_BREACH_THRESHOLD_MS,
      remainingMinutes: Math.floor(SLA_BREACH_THRESHOLD_MS / 60000),
      isBreached: false,
      isApproaching: false,
    };
  }

  const now = new Date();
  const elapsedMs = now.getTime() - dm.timestamp.getTime();
  const remainingMs = SLA_BREACH_THRESHOLD_MS - elapsedMs;
  const remainingMinutes = Math.floor(remainingMs / 60000);

  const isBreached = remainingMs <= 0;
  const isApproaching = !isBreached && elapsedMs >= SLA_WARNING_THRESHOLD_MS;

  return {
    dmId: dm.id,
    remainingMs,
    remainingMinutes,
    isBreached,
    isApproaching,
  };
}

/**
 * Get the SLA breach threshold configuration.
 * Useful for UI display and configuration transparency.
 */
export function getSLAConfig(): {
  breachThresholdMs: number;
  breachThresholdMinutes: number;
  warningThresholdMs: number;
  warningThresholdMinutes: number;
  escalationThresholdMs: number;
  escalationThresholdMinutes: number;
} {
  return {
    breachThresholdMs: SLA_BREACH_THRESHOLD_MS,
    breachThresholdMinutes: Math.floor(SLA_BREACH_THRESHOLD_MS / 60000),
    warningThresholdMs: SLA_WARNING_THRESHOLD_MS,
    warningThresholdMinutes: Math.floor(SLA_WARNING_THRESHOLD_MS / 60000),
    escalationThresholdMs: SLA_ESCALATION_THRESHOLD_MS,
    escalationThresholdMinutes: Math.floor(SLA_ESCALATION_THRESHOLD_MS / 60000),
  };
}