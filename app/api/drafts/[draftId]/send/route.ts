import { NextRequest, NextResponse } from "next/server";
import { sendDraft } from "@/services/draft-composer";
import type { ApiErrorResponse } from "@/types";

/**
 * POST /api/drafts/[draftId]/send
 *
 * Sends an approved draft as a reply to the original DM.
 * Enforces human-in-the-loop: only drafts with status "approved" can be sent.
 * Low-confidence drafts must have been edited and approved before sending.
 *
 * Request Body:
 *   {
 *     "userId": "user-agent-001",
 *     "finalContent": "Optional final content override (compliance-checked before sending)"
 *   }
 *
 * Returns the send result including draft ID, DM ID, sent timestamp, and platform.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { draftId: string } }
) {
  try {
    const { draftId } = params;

    if (!draftId || draftId.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "Draft ID is required.",
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

    const { userId, finalContent } = body;

    if (!userId || typeof userId !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "userId is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const result = await sendDraft({
      draftId,
      userId: userId as string,
      finalContent: typeof finalContent === "string" ? finalContent : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/drafts/[draftId]/send error:", errorMessage);

    if (errorMessage.includes("Draft not found") || errorMessage.includes("Associated DM not found")) {
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
      errorMessage.includes("exceeds maximum length") ||
      errorMessage.includes("must be approved before sending") ||
      errorMessage.includes("compliance issues")
    ) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: errorMessage,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (
      errorMessage.includes("PII detected") ||
      errorMessage.includes("privacy") ||
      errorMessage.includes("Cannot send draft — PII")
    ) {
      const errorResponse: ApiErrorResponse = {
        error: "PrivacyViolationError",
        message: errorMessage,
        statusCode: 403,
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to send draft.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}