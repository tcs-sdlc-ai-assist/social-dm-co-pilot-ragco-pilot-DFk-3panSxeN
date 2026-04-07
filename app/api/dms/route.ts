import { NextRequest, NextResponse } from "next/server";
import { listDMs, ingestDM, ingestSimulatedDMs } from "@/services/dm-ingestion";
import type { ApiErrorResponse } from "@/types";

/**
 * GET /api/dms
 *
 * Returns a paginated list of DMs with status, platform, sender info, and timestamps.
 * Supports filtering by status, platform, and free-text search via query params.
 *
 * Query Parameters:
 *   - page (number, default 1)
 *   - limit (number, default 20)
 *   - platform (string, optional): "instagram" | "facebook" | "twitter" | "linkedin"
 *   - status (string, optional): "new" | "drafted" | "replied" | "sent" | "escalated"
 *   - search (string, optional): free-text search on message/sender
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const platform = searchParams.get("platform") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

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

    const validPlatforms = ["instagram", "facebook", "twitter", "linkedin"];
    if (platform && !validPlatforms.includes(platform.toLowerCase())) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: `Invalid platform parameter. Must be one of: ${validPlatforms.join(", ")}.`,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const validStatuses = ["new", "drafted", "replied", "sent", "escalated"];
    if (status && !validStatuses.includes(status.toLowerCase())) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: `Invalid status parameter. Must be one of: ${validStatuses.join(", ")}.`,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const result = await listDMs({
      page,
      limit,
      platform,
      status,
      search,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("❌ GET /api/dms error:", error instanceof Error ? error.message : String(error));
    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to retrieve DMs.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/dms
 *
 * Ingests new DMs. Supports two modes:
 *
 * 1. Single DM ingestion: Provide a JSON body with DM fields.
 *    {
 *      "platform": "instagram",
 *      "senderName": "Sarah M.",
 *      "senderHandle": "@sarah_m_designs",
 *      "message": "Hi! I'm interested in...",
 *      "timestamp": "2024-11-15T09:23:00Z"
 *    }
 *
 * 2. Simulated batch ingestion: Provide { "simulate": true } to ingest
 *    all simulated DMs from the static data file.
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

    // Simulated batch ingestion mode
    if (body.simulate === true) {
      const result = await ingestSimulatedDMs();

      return NextResponse.json(
        {
          message: `Ingested ${result.ingested.length} simulated DMs.`,
          ingested: result.ingested.length,
          errors: result.errors.length,
          details: {
            ingestedDMs: result.ingested,
            errorDetails: result.errors,
          },
        },
        { status: 201 }
      );
    }

    // Single DM ingestion mode
    const { platform, senderName, senderHandle, message, timestamp, status: dmStatus } = body;

    if (!platform || typeof platform !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "platform is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!senderName || typeof senderName !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "senderName is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!senderHandle || typeof senderHandle !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "senderHandle is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!message || typeof message !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "message is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!timestamp || (typeof timestamp !== "string" && !(timestamp instanceof Date))) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "timestamp is required and must be a valid date string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const dm = await ingestDM({
      platform: platform as string,
      senderName: senderName as string,
      senderHandle: senderHandle as string,
      message: message as string,
      timestamp: timestamp as string | Date,
      status: typeof dmStatus === "string" ? dmStatus : undefined,
    });

    return NextResponse.json(dm, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/dms error:", errorMessage);

    // Check for known validation errors from the service layer
    if (
      errorMessage.includes("Unsupported platform") ||
      errorMessage.includes("cannot be empty") ||
      errorMessage.includes("Invalid timestamp")
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
      message: "Failed to ingest DM.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}