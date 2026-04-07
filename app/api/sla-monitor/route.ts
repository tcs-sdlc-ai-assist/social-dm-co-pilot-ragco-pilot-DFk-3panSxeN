import { NextRequest, NextResponse } from "next/server";
import {
  checkSLABreaches,
  getSLAStatusSummary,
  getBreachedDMs,
  getSLAConfig,
} from "@/services/sla-monitor";
import type { ApiErrorResponse } from "@/types";

/**
 * POST /api/sla-monitor
 *
 * Triggers an SLA breach check across all DMs currently in "new" status.
 * Designed to be called by Vercel cron jobs or client-side polling.
 *
 * Pipeline:
 * 1. Scans all DMs with status "new" that exceed the SLA threshold (default: 1 hour)
 * 2. Creates SLA breach notifications for all managers (deduplicated)
 * 3. For DMs exceeding the escalation threshold (2x SLA), triggers escalation
 *    and updates DM status to "escalated"
 * 4. Logs all SLA breaches in the audit log
 *
 * Request Body (optional):
 *   {
 *     "includeDetails": true  // Optional: include full breached DM details (default: false)
 *   }
 *
 * Returns a summary of breached DMs, notifications created, and escalations triggered.
 */
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};

    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text) as Record<string, unknown>;
      }
    } catch {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "Invalid JSON body.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const includeDetails =
      typeof body.includeDetails === "boolean" ? body.includeDetails : false;

    const result = await checkSLABreaches();

    const response: Record<string, unknown> = {
      checkedAt: result.checkedAt,
      thresholdMs: result.thresholdMs,
      thresholdMinutes: result.thresholdMinutes,
      breachedCount: result.breachedDMs.length,
      notificationsCreated: result.notificationsCreated,
      escalationsTriggered: result.escalationsTriggered,
      errorCount: result.errors.length,
    };

    if (includeDetails) {
      response.breachedDMs = result.breachedDMs;
      response.errors = result.errors;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/sla-monitor error:", errorMessage);

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to run SLA breach check.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * GET /api/sla-monitor
 *
 * Returns the current SLA status summary and configuration.
 * Useful for dashboard display and monitoring.
 *
 * Query Parameters:
 *   - breached (string, optional): "true" to include detailed list of breached DMs
 *   - config (string, optional): "true" to include SLA configuration thresholds
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const includeBreached = searchParams.get("breached") === "true";
    const includeConfig = searchParams.get("config") === "true";

    const summary = await getSLAStatusSummary();

    const response: Record<string, unknown> = {
      summary: {
        totalNewDMs: summary.totalNewDMs,
        withinSLA: summary.withinSLA,
        approachingSLA: summary.approachingSLA,
        breachedSLA: summary.breachedSLA,
        oldestUnrespondedMinutes: summary.oldestUnrespondedMinutes,
      },
    };

    if (includeBreached) {
      const breachedDMs = await getBreachedDMs();
      response.breachedDMs = breachedDMs;
    }

    if (includeConfig) {
      const slaConfig = getSLAConfig();
      response.config = slaConfig;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ GET /api/sla-monitor error:", errorMessage);

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to retrieve SLA status.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}