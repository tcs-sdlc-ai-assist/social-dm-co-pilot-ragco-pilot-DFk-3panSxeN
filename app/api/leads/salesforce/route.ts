import { NextRequest, NextResponse } from "next/server";
import { createSalesforceLead, syncLeadBatch, getSyncStatus, getUnsyncedLeads } from "@/services/salesforce-sync";
import { triggerSalesforceSyncNotification } from "@/services/notification-manager";
import type { ApiErrorResponse } from "@/types";

/**
 * POST /api/leads/salesforce
 *
 * Creates a lead in Salesforce CRM via the SalesforceSync service.
 * Uses live Salesforce API when configured, otherwise falls back to simulated mode.
 *
 * Supports three modes:
 *
 * 1. Single lead sync:
 *    {
 *      "leadId": "lead-001",
 *      "triggerNotification": true  // Optional: notify agent/managers on sync result (default: true)
 *    }
 *
 * 2. Batch lead sync:
 *    {
 *      "leadIds": ["lead-001", "lead-002", "lead-003"]
 *    }
 *
 * 3. Sync status check:
 *    {
 *      "leadId": "lead-001",
 *      "checkStatus": true
 *    }
 *
 * Returns confirmation with Salesforce ID, sync mode (live/simulated), and timestamp.
 */
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "Invalid JSON body.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { leadId, leadIds, checkStatus, triggerNotification: shouldTriggerNotification } = body;

    // Batch sync mode
    if (Array.isArray(leadIds)) {
      const validLeadIds = (leadIds as unknown[]).filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      );

      if (validLeadIds.length === 0) {
        const errorResponse: ApiErrorResponse = {
          error: "ValidationError",
          message: "leadIds must be a non-empty array of strings.",
          statusCode: 400,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      const result = await syncLeadBatch(validLeadIds);

      // Trigger notifications for each synced lead
      const shouldNotify = typeof shouldTriggerNotification === "boolean" ? shouldTriggerNotification : true;

      if (shouldNotify) {
        for (const syncedLead of result.synced) {
          try {
            await triggerSalesforceSyncNotification(
              syncedLead.leadId,
              syncedLead.success,
              syncedLead.salesforceId,
              syncedLead.error ?? null
            );
          } catch (notifError) {
            console.error(
              "⚠️ Failed to trigger Salesforce sync notification:",
              notifError instanceof Error ? notifError.message : String(notifError)
            );
          }
        }

        for (const errorItem of result.errors) {
          try {
            await triggerSalesforceSyncNotification(
              errorItem.leadId,
              false,
              null,
              errorItem.error
            );
          } catch (notifError) {
            console.error(
              "⚠️ Failed to trigger Salesforce sync failure notification:",
              notifError instanceof Error ? notifError.message : String(notifError)
            );
          }
        }
      }

      return NextResponse.json(
        {
          synced: result.synced,
          errors: result.errors,
          total: validLeadIds.length,
          successCount: result.synced.length,
          errorCount: result.errors.length,
        },
        { status: 200 }
      );
    }

    // Single lead operations
    if (!leadId || typeof leadId !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "leadId is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (leadId.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "leadId cannot be empty.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Status check mode
    if (checkStatus === true) {
      const status = await getSyncStatus(leadId.trim());

      return NextResponse.json(
        {
          leadId: status.leadId,
          isSynced: status.isSynced,
          salesforceId: status.salesforceId,
        },
        { status: 200 }
      );
    }

    // Standard single lead sync
    const result = await createSalesforceLead({ leadId: leadId.trim() });

    // Trigger notification for sync result
    const shouldNotify = typeof shouldTriggerNotification === "boolean" ? shouldTriggerNotification : true;

    if (shouldNotify) {
      try {
        await triggerSalesforceSyncNotification(
          result.leadId,
          result.success,
          result.salesforceId,
          result.error ?? null
        );
      } catch (notifError) {
        // Notification failure should not block the sync response
        console.error(
          "⚠️ Failed to trigger Salesforce sync notification:",
          notifError instanceof Error ? notifError.message : String(notifError)
        );
      }
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          leadId: result.leadId,
          salesforceId: null,
          syncedAt: result.syncedAt,
          mode: result.mode,
          error: result.error,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        leadId: result.leadId,
        salesforceId: result.salesforceId,
        syncedAt: result.syncedAt,
        mode: result.mode,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/leads/salesforce error:", errorMessage);

    if (errorMessage.includes("Lead not found")) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (errorMessage.includes("Associated DM not found")) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (
      errorMessage.includes("Lead ID is required") ||
      errorMessage.includes("cannot be empty") ||
      errorMessage.includes("must be a string")
    ) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: errorMessage,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      const errorResponse: ApiErrorResponse = {
        error: "RateLimitError",
        message: "Salesforce sync rate limit exceeded. Please try again shortly.",
        statusCode: 429,
      };
      return NextResponse.json(errorResponse, { status: 429 });
    }

    if (errorMessage.includes("Salesforce API error") || errorMessage.includes("Salesforce")) {
      const errorResponse: ApiErrorResponse = {
        error: "ExternalServiceError",
        message: "Salesforce API unavailable. Please retry later.",
        statusCode: 502,
      };
      return NextResponse.json(errorResponse, { status: 502 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to sync lead to Salesforce.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * GET /api/leads/salesforce
 *
 * Returns all leads that have not yet been synced to Salesforce.
 * Useful for batch sync operations and monitoring the sync queue.
 *
 * Returns leads ordered by priority (high-priority first), then by score (descending),
 * then by creation date (oldest first).
 */
export async function GET() {
  try {
    const unsyncedLeads = await getUnsyncedLeads();

    return NextResponse.json(
      {
        leads: unsyncedLeads,
        total: unsyncedLeads.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ GET /api/leads/salesforce error:", errorMessage);

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to retrieve unsynced leads.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}