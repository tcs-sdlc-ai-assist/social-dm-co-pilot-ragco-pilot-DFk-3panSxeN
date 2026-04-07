import { prisma } from "@/lib/db";
import { salesforceConfig } from "@/lib/config";
import {
  logSalesforceSync,
  logAction,
  AuditActions,
  AuditEntityTypes,
} from "@/services/audit-logger";
import type { SalesforceCreateRequest, SalesforceCreateResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateSalesforceLeadParams {
  leadId: string;
}

export interface CreateSalesforceLeadResult {
  success: boolean;
  salesforceId: string | null;
  leadId: string;
  syncedAt: string;
  mode: "live" | "simulated";
  error?: string;
}

export interface SalesforceLeadPayload {
  FirstName: string;
  LastName: string;
  Company: string;
  Description: string;
  LeadSource: string;
  Status: string;
  Rating: string;
  Custom_Budget__c: string | null;
  Custom_Location__c: string | null;
  Custom_Intent__c: string | null;
  Custom_Score__c: number;
  Custom_Priority__c: boolean;
  Custom_DM_Id__c: string;
  Custom_Platform__c: string;
}

interface SalesforceAPIResponse {
  id: string;
  success: boolean;
  errors: Array<{ message: string; statusCode: string }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const SALESFORCE_LEAD_ENDPOINT = "/sobjects/Lead";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSimulatedSalesforceId(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  // Salesforce IDs are 18 characters
  let id = "00Q"; // Lead prefix
  for (let i = 0; i < 15; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: "Unknown", lastName: "Unknown" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "(Not Provided)" };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

function mapPriorityToRating(score: number, priorityFlag: boolean): string {
  if (priorityFlag || score >= 8.0) return "Hot";
  if (score >= 5.0) return "Warm";
  return "Cold";
}

function buildSalesforcePayload(
  lead: {
    name: string;
    contact: string | null;
    budget: string | null;
    location: string | null;
    intent: string | null;
    score: number;
    priorityFlag: boolean;
    dmId: string;
  },
  platform: string
): SalesforceLeadPayload {
  const { firstName, lastName } = splitName(lead.name);

  const descriptionParts: string[] = [];
  if (lead.contact) descriptionParts.push(`Contact: ${lead.contact}`);
  if (lead.budget) descriptionParts.push(`Budget: ${lead.budget}`);
  if (lead.location) descriptionParts.push(`Location: ${lead.location}`);
  if (lead.intent) descriptionParts.push(`Intent: ${lead.intent}`);
  descriptionParts.push(`Lead Score: ${lead.score}/10`);
  descriptionParts.push(`Priority: ${lead.priorityFlag ? "High" : "Normal"}`);
  descriptionParts.push(`Source Platform: ${platform}`);

  return {
    FirstName: firstName,
    LastName: lastName,
    Company: "Social DM Lead",
    Description: descriptionParts.join("\n"),
    LeadSource: `Social Media — ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
    Status: "New",
    Rating: mapPriorityToRating(lead.score, lead.priorityFlag),
    Custom_Budget__c: lead.budget,
    Custom_Location__c: lead.location,
    Custom_Intent__c: lead.intent,
    Custom_Score__c: lead.score,
    Custom_Priority__c: lead.priorityFlag,
    Custom_DM_Id__c: lead.dmId,
    Custom_Platform__c: platform,
  };
}

// ─── Simulated Salesforce API ────────────────────────────────────────────────

async function simulateSalesforceCreate(
  payload: SalesforceLeadPayload
): Promise<SalesforceCreateResponse> {
  // Simulate network latency (100-300ms)
  const delay = 100 + Math.floor(Math.random() * 200);
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Simulate a 5% failure rate for realism
  const shouldFail = Math.random() < 0.05;

  if (shouldFail) {
    return {
      success: false,
      salesforceId: null,
      error: "Simulated Salesforce API error: UNABLE_TO_LOCK_ROW",
    };
  }

  const salesforceId = generateSimulatedSalesforceId();

  console.log(
    `✅ [Simulated] Salesforce lead created: ${salesforceId} for ${payload.FirstName} ${payload.LastName}`
  );

  return {
    success: true,
    salesforceId,
  };
}

// ─── Live Salesforce API ─────────────────────────────────────────────────────

async function callSalesforceAPI(
  payload: SalesforceLeadPayload
): Promise<SalesforceCreateResponse> {
  const { apiUrl, apiKey } = salesforceConfig;
  const url = `${apiUrl}${SALESFORCE_LEAD_ENDPOINT}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        // Rate limited — wait and retry
        const retryAfter = parseInt(response.headers.get("retry-after") ?? "5", 10);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Salesforce API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as SalesforceAPIResponse;

      if (!data.success) {
        const errorMessages = data.errors?.map((e) => e.message).join("; ") ?? "Unknown error";
        return {
          success: false,
          salesforceId: null,
          error: `Salesforce rejected lead: ${errorMessages}`,
        };
      }

      return {
        success: true,
        salesforceId: data.id,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * INITIAL_RETRY_DELAY_MS;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    salesforceId: null,
    error: lastError?.message ?? "Salesforce API call failed after retries.",
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a lead in Salesforce CRM.
 *
 * Pipeline:
 * 1. Fetch the lead and associated DM from the database
 * 2. Validate the lead exists and has not already been synced
 * 3. Build the Salesforce lead payload
 * 4. Call Salesforce API (live) or simulate (pilot mode)
 * 5. On success: update lead with Salesforce ID, log audit entry
 * 6. On failure: log error in audit, return error details
 *
 * Uses simulated mode when Salesforce is not configured (pilot).
 * Uses live mode when SALESFORCE_API_URL and SALESFORCE_API_KEY are set.
 */
export async function createSalesforceLead(
  params: CreateSalesforceLeadParams
): Promise<CreateSalesforceLeadResult> {
  const { leadId } = params;

  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required.");
  }

  // Fetch the lead with associated DM
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      dm: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}.`);
  }

  if (!lead.dm) {
    throw new Error(`Associated DM not found for lead: ${leadId}.`);
  }

  // Check if already synced
  if (lead.salesforceId) {
    return {
      success: true,
      salesforceId: lead.salesforceId,
      leadId: lead.id,
      syncedAt: lead.updatedAt.toISOString(),
      mode: salesforceConfig.isConfigured ? "live" : "simulated",
    };
  }

  // Log sync start
  await logAction({
    action: AuditActions.SALESFORCE_SYNC_STARTED,
    entityType: AuditEntityTypes.SALESFORCE,
    entityId: leadId,
    details: `Salesforce sync initiated for lead "${lead.name}" (${lead.id}). Mode: ${salesforceConfig.isConfigured ? "live" : "simulated"}.`,
  });

  // Build payload
  const payload = buildSalesforcePayload(
    {
      name: lead.name,
      contact: lead.contact,
      budget: lead.budget,
      location: lead.location,
      intent: lead.intent,
      score: lead.score,
      priorityFlag: lead.priorityFlag,
      dmId: lead.dmId,
    },
    lead.dm.platform
  );

  // Call Salesforce (live or simulated)
  let result: SalesforceCreateResponse;
  const mode: "live" | "simulated" = salesforceConfig.isConfigured ? "live" : "simulated";

  if (salesforceConfig.isConfigured) {
    result = await callSalesforceAPI(payload);
  } else {
    result = await simulateSalesforceCreate(payload);
  }

  const syncedAt = new Date().toISOString();

  if (result.success && result.salesforceId) {
    // Update lead with Salesforce ID
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        salesforceId: result.salesforceId,
      },
    });

    // Log success
    await logSalesforceSync(leadId, true, result.salesforceId);

    return {
      success: true,
      salesforceId: result.salesforceId,
      leadId: lead.id,
      syncedAt,
      mode,
    };
  } else {
    // Log failure
    await logSalesforceSync(leadId, false, null, result.error ?? "Unknown error");

    return {
      success: false,
      salesforceId: null,
      leadId: lead.id,
      syncedAt,
      mode,
      error: result.error ?? "Salesforce sync failed.",
    };
  }
}

/**
 * Sync multiple leads to Salesforce in batch.
 * Processes each lead individually, collecting results and errors.
 */
export async function syncLeadBatch(
  leadIds: string[]
): Promise<{
  synced: CreateSalesforceLeadResult[];
  errors: Array<{ leadId: string; error: string }>;
}> {
  const synced: CreateSalesforceLeadResult[] = [];
  const errors: Array<{ leadId: string; error: string }> = [];

  for (const leadId of leadIds) {
    try {
      const result = await createSalesforceLead({ leadId });
      if (result.success) {
        synced.push(result);
      } else {
        errors.push({
          leadId,
          error: result.error ?? "Salesforce sync failed.",
        });
      }
    } catch (error) {
      errors.push({
        leadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { synced, errors };
}

/**
 * Check the sync status of a lead.
 * Returns whether the lead has been synced to Salesforce and the Salesforce ID.
 */
export async function getSyncStatus(
  leadId: string
): Promise<{
  isSynced: boolean;
  salesforceId: string | null;
  leadId: string;
}> {
  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required.");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      salesforceId: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}.`);
  }

  return {
    isSynced: lead.salesforceId !== null && lead.salesforceId.length > 0,
    salesforceId: lead.salesforceId,
    leadId: lead.id,
  };
}

/**
 * Get all leads that have not been synced to Salesforce.
 * Useful for batch sync operations and monitoring.
 */
export async function getUnsyncedLeads(): Promise<
  Array<{
    id: string;
    name: string;
    score: number;
    priorityFlag: boolean;
    status: string;
    createdAt: string;
  }>
> {
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { salesforceId: null },
        { salesforceId: "" },
      ],
    },
    orderBy: [
      { priorityFlag: "desc" },
      { score: "desc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      name: true,
      score: true,
      priorityFlag: true,
      status: true,
      createdAt: true,
    },
  });

  return leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    score: lead.score,
    priorityFlag: lead.priorityFlag,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
  }));
}

/**
 * Retry a failed Salesforce sync for a specific lead.
 * Clears any existing Salesforce ID and attempts a fresh sync.
 */
export async function retrySalesforceSync(
  leadId: string
): Promise<CreateSalesforceLeadResult> {
  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required.");
  }

  // Clear existing Salesforce ID to force re-sync
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      salesforceId: null,
    },
  });

  return createSalesforceLead({ leadId });
}