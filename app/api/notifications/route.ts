import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications,
  triggerNotification,
  markAsRead,
  markAsDismissed,
  markAllAsRead,
  getUnreadCount,
} from "@/services/notification-manager";
import type { ApiErrorResponse } from "@/types";

/**
 * GET /api/notifications
 *
 * Returns a paginated list of notifications with filtering support.
 * Supports filtering by type, status, and recipient via query params.
 *
 * Query Parameters:
 *   - page (number, default 1)
 *   - limit (number, default 20)
 *   - type (string, optional): "new_dm" | "high_priority_lead" | "unassigned_lead" | "draft_ready" | "draft_sent" | "lead_assigned" | "escalation" | "sla_breach" | "salesforce_sync_success" | "salesforce_sync_failed"
 *   - status (string, optional): "unread" | "read" | "dismissed"
 *   - recipient (string, optional): email of the recipient
 *   - countOnly (string, optional): "true" to return only unread count for recipient
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const type = searchParams.get("type") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const recipient = searchParams.get("recipient") ?? undefined;
    const countOnly = searchParams.get("countOnly") ?? undefined;

    if (isNaN(page) || page < 1) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "Invalid page parameter. Must be a positive integer.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (isNaN(limit) || limit < 1) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "Invalid limit parameter. Must be a positive integer.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const validTypes = [
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
    ];
    if (type && !validTypes.includes(type.toLowerCase())) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: `Invalid type parameter. Must be one of: ${validTypes.join(", ")}.`,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const validStatuses = ["unread", "read", "dismissed"];
    if (status && !validStatuses.includes(status.toLowerCase())) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: `Invalid status parameter. Must be one of: ${validStatuses.join(", ")}.`,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Count-only mode: return just the unread count for a recipient
    if (countOnly === "true") {
      if (!recipient || recipient.trim().length === 0) {
        const errorResponse: ApiErrorResponse = {
          error: "ValidationError",
          message: "recipient is required when countOnly is true.",
          statusCode: 400,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      const unreadCount = await getUnreadCount(recipient);

      return NextResponse.json(
        {
          recipient,
          unreadCount,
        },
        { status: 200 }
      );
    }

    const result = await getNotifications({
      page,
      limit,
      type,
      status,
      recipient,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      "❌ GET /api/notifications error:",
      error instanceof Error ? error.message : String(error)
    );
    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to retrieve notifications.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/notifications
 *
 * Manually triggers a notification or marks all notifications as read for a recipient.
 *
 * Supports two modes:
 *
 * 1. Trigger a new notification:
 *    {
 *      "type": "high_priority_lead" | "sla_breach" | "new_dm" | ...,
 *      "recipient": "agent@stockland.com.au",
 *      "dmId": "dm-001",          // Optional
 *      "leadId": "lead-001",      // Optional
 *      "details": "Description"   // Optional
 *    }
 *
 * 2. Mark all notifications as read for a recipient:
 *    {
 *      "action": "markAllRead",
 *      "recipient": "agent@stockland.com.au"
 *    }
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

    const { action } = body;

    // Mode 2: Mark all as read
    if (action === "markAllRead") {
      const { recipient } = body;

      if (!recipient || typeof recipient !== "string") {
        const errorResponse: ApiErrorResponse = {
          error: "ValidationError",
          message: "recipient is required and must be a string.",
          statusCode: 400,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      if (recipient.trim().length === 0) {
        const errorResponse: ApiErrorResponse = {
          error: "ValidationError",
          message: "recipient cannot be empty.",
          statusCode: 400,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      const result = await markAllAsRead(recipient as string);

      return NextResponse.json(
        {
          recipient,
          updatedCount: result.updatedCount,
        },
        { status: 200 }
      );
    }

    // Mode 1: Trigger a new notification
    const { type, recipient, dmId, leadId, details } = body;

    if (!type || typeof type !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "type is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!recipient || typeof recipient !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "recipient is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (type.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "type cannot be empty.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (recipient.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "recipient cannot be empty.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const result = await triggerNotification({
      type: type as string,
      recipient: recipient as string,
      dmId: typeof dmId === "string" ? dmId : null,
      leadId: typeof leadId === "string" ? leadId : null,
      details: typeof details === "string" ? details : null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/notifications error:", errorMessage);

    if (errorMessage.includes("Invalid notification type")) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: errorMessage,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (
      errorMessage.includes("is required") ||
      errorMessage.includes("cannot be empty")
    ) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: errorMessage,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (
      errorMessage.includes("DM not found") ||
      errorMessage.includes("Lead not found") ||
      errorMessage.includes("Referenced DM not found") ||
      errorMessage.includes("Referenced Lead not found")
    ) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to process notification request.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 *
 * Updates the status of a notification (mark as read or dismissed).
 *
 * Request Body:
 *   {
 *     "notificationId": "notif-001",
 *     "status": "read" | "dismissed"
 *   }
 */
export async function PATCH(request: NextRequest) {
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

    const { notificationId, status } = body;

    if (!notificationId || typeof notificationId !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "notificationId is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (notificationId.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "notificationId cannot be empty.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!status || typeof status !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "status is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const normalizedStatus = (status as string).toLowerCase().trim();
    const validStatuses = ["read", "dismissed"];

    if (!validStatuses.includes(normalizedStatus)) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: `Invalid status: "${status}". Must be one of: ${validStatuses.join(", ")}.`,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (normalizedStatus === "read") {
      const result = await markAsRead({
        notificationId: notificationId as string,
      });

      return NextResponse.json(result, { status: 200 });
    }

    if (normalizedStatus === "dismissed") {
      const result = await markAsDismissed({
        notificationId: notificationId as string,
      });

      return NextResponse.json(result, { status: 200 });
    }

    // Should not reach here due to validation above
    const errorResponse: ApiErrorResponse = {
      error: "ValidationError",
      message: `Unhandled status: "${status}".`,
      statusCode: 400,
    };
    return NextResponse.json(errorResponse, { status: 400 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ PATCH /api/notifications error:", errorMessage);

    if (errorMessage.includes("Notification not found")) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (
      errorMessage.includes("is required") ||
      errorMessage.includes("cannot be empty") ||
      errorMessage.includes("Cannot mark")
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
      message: "Failed to update notification.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}