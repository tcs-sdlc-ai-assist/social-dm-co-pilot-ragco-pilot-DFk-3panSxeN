import { prisma } from "@/lib/db";
import { logAction, AuditActions, AuditEntityTypes } from "@/services/audit-logger";

// Valid DM statuses
const VALID_STATUSES = ["new", "drafted", "replied", "sent", "escalated"] as const;
type DMStatusValue = (typeof VALID_STATUSES)[number];

// Valid status transitions map: from → allowed destinations
const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["drafted", "escalated"],
  drafted: ["sent", "replied", "escalated", "new"],
  replied: ["escalated"],
  sent: ["escalated"],
  escalated: ["new", "drafted"],
};

export interface StatusHistoryEntry {
  id: string;
  dmId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  changedAt: string;
  details: string | null;
}

export interface UpdateDMStatusParams {
  dmId: string;
  newStatus: string;
  changedBy: string;
  details?: string | null;
}

export interface UpdateDMStatusResult {
  id: string;
  platform: string;
  senderName: string;
  senderHandle: string;
  message: string;
  timestamp: string;
  status: string;
  previousStatus: string;
  createdAt: string;
  updatedAt: string;
}

function isValidStatus(status: string): status is DMStatusValue {
  return VALID_STATUSES.includes(status as DMStatusValue);
}

function isValidTransition(fromStatus: string, toStatus: string): boolean {
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed) {
    return false;
  }
  return allowed.includes(toStatus);
}

/**
 * Update the status of a DM with transition validation.
 * Validates that the transition is allowed, persists the change,
 * records the status change in audit log, and returns the updated DM.
 */
export async function updateDMStatus(params: UpdateDMStatusParams): Promise<UpdateDMStatusResult> {
  const { dmId, newStatus, changedBy, details = null } = params;

  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  if (!newStatus || newStatus.trim().length === 0) {
    throw new Error("New status is required.");
  }

  if (!changedBy || changedBy.trim().length === 0) {
    throw new Error("Changed by (user identifier) is required.");
  }

  const normalizedStatus = newStatus.toLowerCase().trim();

  if (!isValidStatus(normalizedStatus)) {
    throw new Error(
      `Invalid status: "${newStatus}". Valid statuses are: ${VALID_STATUSES.join(", ")}.`
    );
  }

  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  const oldStatus = dm.status;

  // Allow no-op if status is already the target
  if (oldStatus === normalizedStatus) {
    return {
      id: dm.id,
      platform: dm.platform,
      senderName: dm.senderName,
      senderHandle: dm.senderHandle,
      message: dm.message,
      timestamp: dm.timestamp.toISOString(),
      status: dm.status,
      previousStatus: oldStatus,
      createdAt: dm.createdAt.toISOString(),
      updatedAt: dm.updatedAt.toISOString(),
    };
  }

  if (!isValidTransition(oldStatus, normalizedStatus)) {
    throw new Error(
      `Invalid status transition: "${oldStatus}" → "${normalizedStatus}". ` +
        `Allowed transitions from "${oldStatus}": ${(VALID_TRANSITIONS[oldStatus] ?? []).join(", ") || "none"}.`
    );
  }

  const updatedDM = await prisma.dM.update({
    where: { id: dmId },
    data: {
      status: normalizedStatus,
    },
  });

  await logAction({
    action: AuditActions.DM_STATUS_UPDATED,
    entityType: AuditEntityTypes.DM,
    entityId: dmId,
    userId: changedBy,
    details:
      details ??
      `DM status changed from "${oldStatus}" to "${normalizedStatus}" by ${changedBy}.`,
  });

  return {
    id: updatedDM.id,
    platform: updatedDM.platform,
    senderName: updatedDM.senderName,
    senderHandle: updatedDM.senderHandle,
    message: updatedDM.message,
    timestamp: updatedDM.timestamp.toISOString(),
    status: updatedDM.status,
    previousStatus: oldStatus,
    createdAt: updatedDM.createdAt.toISOString(),
    updatedAt: updatedDM.updatedAt.toISOString(),
  };
}

/**
 * Get the status change history for a DM from the audit log.
 * Returns all status change entries ordered by most recent first.
 */
export async function getDMStatusHistory(dmId: string): Promise<StatusHistoryEntry[]> {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: AuditEntityTypes.DM,
      entityId: dmId,
      action: AuditActions.DM_STATUS_UPDATED,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return auditLogs.map((log) => {
    const statusChange = parseStatusChangeDetails(log.details);

    return {
      id: log.id,
      dmId: log.entityId,
      oldStatus: statusChange.oldStatus,
      newStatus: statusChange.newStatus,
      changedBy: log.userId ?? "system",
      changedAt: log.createdAt.toISOString(),
      details: log.details,
    };
  });
}

/**
 * Parse old and new status from audit log details string.
 * Expected format: 'DM status changed from "old" to "new" by user.'
 */
function parseStatusChangeDetails(details: string | null): {
  oldStatus: string;
  newStatus: string;
} {
  if (!details) {
    return { oldStatus: "unknown", newStatus: "unknown" };
  }

  const match = details.match(/from "([^"]+)" to "([^"]+)"/);
  if (match && match[1] && match[2]) {
    return { oldStatus: match[1], newStatus: match[2] };
  }

  return { oldStatus: "unknown", newStatus: "unknown" };
}

/**
 * Get the list of valid transitions from a given status.
 * Useful for UI to show available actions.
 */
export function getValidTransitions(currentStatus: string): string[] {
  const normalized = currentStatus.toLowerCase().trim();
  return VALID_TRANSITIONS[normalized] ?? [];
}

/**
 * Check if a specific status transition is allowed.
 */
export function canTransition(fromStatus: string, toStatus: string): boolean {
  const normalizedFrom = fromStatus.toLowerCase().trim();
  const normalizedTo = toStatus.toLowerCase().trim();

  if (!isValidStatus(normalizedFrom) || !isValidStatus(normalizedTo)) {
    return false;
  }

  return isValidTransition(normalizedFrom, normalizedTo);
}

/**
 * Bulk update DM statuses. Processes each update individually,
 * collecting results and errors.
 */
export async function bulkUpdateDMStatus(
  updates: UpdateDMStatusParams[]
): Promise<{
  updated: UpdateDMStatusResult[];
  errors: Array<{ index: number; dmId: string; error: string }>;
}> {
  const updated: UpdateDMStatusResult[] = [];
  const errors: Array<{ index: number; dmId: string; error: string }> = [];

  for (let i = 0; i < updates.length; i++) {
    try {
      const result = await updateDMStatus(updates[i]);
      updated.push(result);
    } catch (error) {
      errors.push({
        index: i,
        dmId: updates[i].dmId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { updated, errors };
}