import { NextRequest, NextResponse } from "next/server";
import { updateDMStatus, getDMStatusHistory, getValidTransitions } from "@/services/dm-status-tracker";
import type { ApiErrorResponse } from "@/types";

/**
 * GET /api/dms/[dmId]/status
 *
 * Returns the status history for a specific DM, including all status transitions
 * with timestamps, who made the change, and details.
 *
 * Also returns the current status and valid transitions from that status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { dmId: string } }
) {
  try {
    const { dmId } = params;

    if (!dmId || dmId.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "DM ID is required.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const history = await getDMStatusHistory(dmId);

    // Determine current status from the most recent history entry or fetch from DB
    // The getDMStatusHistory function already validates the DM exists
    const { prisma } = await import("@/lib/db");
    const dm = await prisma.dM.findUnique({
      where: { id: dmId },
      select: { id: true, status: true },
    });

    if (!dm) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: `DM not found: ${dmId}.`,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const validTransitions = getValidTransitions(dm.status);

    return NextResponse.json(
      {
        dmId: dm.id,
        currentStatus: dm.status,
        validTransitions,
        history,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ GET /api/dms/[dmId]/status error:", errorMessage);

    if (errorMessage.includes("DM not found")) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to retrieve DM status history.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PATCH /api/dms/[dmId]/status
 *
 * Updates the status of a DM. Validates the status transition is allowed,
 * persists the change, and records it in the audit log.
 *
 * Request Body:
 *   {
 *     "status": "drafted" | "sent" | "replied" | "escalated" | "new",
 *     "changedBy": "user-agent-001",
 *     "details": "Optional details about the status change"
 *   }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { dmId: string } }
) {
  try {
    const { dmId } = params;

    if (!dmId || dmId.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "DM ID is required.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

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

    const { status, changedBy, details } = body;

    if (!status || typeof status !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "status is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!changedBy || typeof changedBy !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "changedBy is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const validStatuses = ["new", "drafted", "replied", "sent", "escalated"];
    if (!validStatuses.includes(status.toLowerCase().trim())) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: `Invalid status: "${status}". Must be one of: ${validStatuses.join(", ")}.`,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const result = await updateDMStatus({
      dmId,
      newStatus: status as string,
      changedBy: changedBy as string,
      details: typeof details === "string" ? details : null,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ PATCH /api/dms/[dmId]/status error:", errorMessage);

    if (errorMessage.includes("DM not found")) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (
      errorMessage.includes("Invalid status") ||
      errorMessage.includes("Invalid status transition") ||
      errorMessage.includes("is required")
    ) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: errorMessage,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to update DM status.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}