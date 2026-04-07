import { prisma } from "@/lib/db";
import { checkTextForPII, redactPII } from "@/services/privacy-compliance";
import { logDMIngested, logPIIDetected } from "@/services/audit-logger";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";
import type { DMFilterParams, PaginatedResponse, DMResponse } from "@/types";

interface RawDMInput {
  id?: string;
  platform: string;
  senderName: string;
  senderHandle: string;
  message: string;
  timestamp: string | Date;
  status?: string;
}

interface NormalizedDM {
  platform: string;
  senderName: string;
  senderHandle: string;
  message: string;
  timestamp: Date;
  status: string;
}

const SUPPORTED_PLATFORMS = ["instagram", "facebook", "twitter", "linkedin"];

function normalizePlatform(platform: string): string {
  const lower = platform.toLowerCase().trim();
  if (!SUPPORTED_PLATFORMS.includes(lower)) {
    throw new Error(`Unsupported platform: ${platform}. Supported: ${SUPPORTED_PLATFORMS.join(", ")}`);
  }
  return lower;
}

function normalizeSenderName(name: string): string {
  return name.trim().substring(0, 128);
}

function normalizeSenderHandle(handle: string): string {
  return handle.trim().substring(0, 128);
}

function normalizeMessage(message: string): string {
  if (!message || message.trim().length === 0) {
    throw new Error("DM message cannot be empty.");
  }
  return message.trim();
}

function normalizeTimestamp(timestamp: string | Date): Date {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${String(timestamp)}`);
  }
  return date;
}

function normalizeDM(raw: RawDMInput): NormalizedDM {
  return {
    platform: normalizePlatform(raw.platform),
    senderName: normalizeSenderName(raw.senderName),
    senderHandle: normalizeSenderHandle(raw.senderHandle),
    message: normalizeMessage(raw.message),
    timestamp: normalizeTimestamp(raw.timestamp),
    status: raw.status ?? "new",
  };
}

/**
 * Ingest a single DM: normalize, run PII check, persist to database.
 * If PII is detected, the message is sanitized before storage and an audit log is created.
 * Returns the created DM record.
 */
export async function ingestDM(raw: RawDMInput): Promise<DMResponse> {
  const normalized = normalizeDM(raw);

  const piiResult = checkTextForPII(normalized.message);

  let messageToStore = normalized.message;

  if (piiResult.hasPII) {
    messageToStore = redactPII(normalized.message);
  }

  const existingDM = await prisma.dM.findFirst({
    where: {
      platform: normalized.platform,
      senderHandle: normalized.senderHandle,
      timestamp: normalized.timestamp,
    },
  });

  if (existingDM) {
    return {
      id: existingDM.id,
      platform: existingDM.platform,
      senderName: existingDM.senderName,
      senderHandle: existingDM.senderHandle,
      message: existingDM.message,
      timestamp: existingDM.timestamp.toISOString(),
      status: existingDM.status,
      createdAt: existingDM.createdAt.toISOString(),
      updatedAt: existingDM.updatedAt.toISOString(),
    };
  }

  const dm = await prisma.dM.create({
    data: {
      platform: normalized.platform,
      senderName: normalized.senderName,
      senderHandle: normalized.senderHandle,
      message: messageToStore,
      timestamp: normalized.timestamp,
      status: "new",
    },
  });

  await logDMIngested(dm.id, dm.platform, dm.senderHandle);

  if (piiResult.hasPII) {
    await logPIIDetected("dm", dm.id, piiResult.detectedTypes);
  }

  return {
    id: dm.id,
    platform: dm.platform,
    senderName: dm.senderName,
    senderHandle: dm.senderHandle,
    message: dm.message,
    timestamp: dm.timestamp.toISOString(),
    status: dm.status,
    createdAt: dm.createdAt.toISOString(),
    updatedAt: dm.updatedAt.toISOString(),
  };
}

/**
 * Ingest multiple DMs in batch. Processes each DM individually,
 * collecting results and errors. Returns all successfully ingested DMs.
 */
export async function ingestDMBatch(
  rawDMs: RawDMInput[]
): Promise<{ ingested: DMResponse[]; errors: Array<{ index: number; error: string }> }> {
  const ingested: DMResponse[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < rawDMs.length; i++) {
    try {
      const dm = await ingestDM(rawDMs[i]);
      ingested.push(dm);
    } catch (error) {
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ingested, errors };
}

/**
 * List DMs with pagination, filtering, and search.
 * Supports filtering by platform, status, and free-text search on message/sender.
 */
export async function listDMs(params: DMFilterParams = {}): Promise<PaginatedResponse<DMResponse>> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.platform) {
    where.platform = params.platform.toLowerCase();
  }

  if (params.status) {
    where.status = params.status.toLowerCase();
  }

  if (params.search && params.search.trim().length > 0) {
    const searchTerm = params.search.trim();
    where.OR = [
      { message: { contains: searchTerm, mode: "insensitive" } },
      { senderName: { contains: searchTerm, mode: "insensitive" } },
      { senderHandle: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const [dms, total] = await Promise.all([
    prisma.dM.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
      include: {
        drafts: {
          orderBy: { createdAt: "desc" },
        },
        leads: true,
      },
    }),
    prisma.dM.count({ where }),
  ]);

  const data: DMResponse[] = dms.map((dm) => ({
    id: dm.id,
    platform: dm.platform,
    senderName: dm.senderName,
    senderHandle: dm.senderHandle,
    message: dm.message,
    timestamp: dm.timestamp.toISOString(),
    status: dm.status,
    createdAt: dm.createdAt.toISOString(),
    updatedAt: dm.updatedAt.toISOString(),
    drafts: dm.drafts.map((draft) => ({
      id: draft.id,
      dmId: draft.dmId,
      content: draft.content,
      confidenceScore: draft.confidenceScore,
      isEdited: draft.isEdited,
      status: draft.status,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    })),
    leads: dm.leads.map((lead) => ({
      id: lead.id,
      dmId: lead.dmId,
      name: lead.name,
      contact: lead.contact,
      budget: lead.budget,
      location: lead.location,
      intent: lead.intent,
      score: lead.score,
      priorityFlag: lead.priorityFlag,
      salesforceId: lead.salesforceId,
      status: lead.status,
      assignedTo: lead.assignedTo,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    })),
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
 * Get a single DM by ID with related drafts, leads, and notifications.
 */
export async function getDMById(dmId: string): Promise<DMResponse | null> {
  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
    include: {
      drafts: {
        orderBy: { createdAt: "desc" },
      },
      leads: true,
      notifications: true,
    },
  });

  if (!dm) {
    return null;
  }

  return {
    id: dm.id,
    platform: dm.platform,
    senderName: dm.senderName,
    senderHandle: dm.senderHandle,
    message: dm.message,
    timestamp: dm.timestamp.toISOString(),
    status: dm.status,
    createdAt: dm.createdAt.toISOString(),
    updatedAt: dm.updatedAt.toISOString(),
    drafts: dm.drafts.map((draft) => ({
      id: draft.id,
      dmId: draft.dmId,
      content: draft.content,
      confidenceScore: draft.confidenceScore,
      isEdited: draft.isEdited,
      status: draft.status,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    })),
    leads: dm.leads.map((lead) => ({
      id: lead.id,
      dmId: lead.dmId,
      name: lead.name,
      contact: lead.contact,
      budget: lead.budget,
      location: lead.location,
      intent: lead.intent,
      score: lead.score,
      priorityFlag: lead.priorityFlag,
      salesforceId: lead.salesforceId,
      status: lead.status,
      assignedTo: lead.assignedTo,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    })),
    notifications: dm.notifications.map((notif) => ({
      id: notif.id,
      leadId: notif.leadId,
      dmId: notif.dmId,
      type: notif.type,
      status: notif.status,
      recipient: notif.recipient,
      details: notif.details,
      createdAt: notif.createdAt.toISOString(),
    })),
  };
}

/**
 * Load and ingest all simulated DMs from the static data file.
 * Used for initial seeding / demo purposes.
 */
export async function ingestSimulatedDMs(): Promise<{
  ingested: DMResponse[];
  errors: Array<{ index: number; error: string }>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const simulatedData = await import("@/data/simulated-dms.json");
  const rawDMs: RawDMInput[] = simulatedData.dms.map(
    (dm: {
      id?: string;
      platform: string;
      senderName: string;
      senderHandle: string;
      message: string;
      timestamp: string;
      status?: string;
    }) => ({
      id: dm.id,
      platform: dm.platform,
      senderName: dm.senderName,
      senderHandle: dm.senderHandle,
      message: dm.message,
      timestamp: dm.timestamp,
      status: dm.status,
    })
  );

  return ingestDMBatch(rawDMs);
}