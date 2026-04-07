import { NextRequest, NextResponse } from "next/server";
import { editDraft, approveDraft, rejectDraft, sendDraft, getDraftById } from "@/services/draft-composer";
import type { ApiErrorResponse } from "@/types";

/**
 * GET /api/drafts/[draftId]
 *
 * Retrieves a single draft by ID with its associated DM.
 */
export async function GET(
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

    const draft = await getDraftById(draftId);

    if (!draft) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: `Draft not found: ${draftId}.`,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    return NextResponse.json(draft, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ GET /api/drafts/[draftId] error:", errorMessage);

    if (errorMessage.includes("Draft not found")) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to retrieve draft.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PUT /api/drafts/[draftId]
 *
 * Updates draft content via DraftComposerService.editDraft().
 * Enforces human-in-the-loop review: validates compliance (no PII in edited content),
 * marks the draft as edited, and persists the updated content.
 *
 * Request Body:
 *   {
 *     "content": "Updated draft text...",
 *     "userId": "user-agent-001"
 *   }
 *
 * Returns the updated draft along with any compliance issues detected.
 */
export async function PUT(
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

    const { content, userId } = body;

    if (!content || typeof content !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "content is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "userId is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const result = await editDraft({
      draftId,
      content: content as string,
      userId: userId as string,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ PUT /api/drafts/[draftId] error:", errorMessage);

    if (errorMessage.includes("Draft not found")) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (
      errorMessage.includes("cannot be empty") ||
      errorMessage.includes("is required") ||
      errorMessage.includes("exceeds maximum length")
    ) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: errorMessage,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (errorMessage.includes("already been sent")) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: errorMessage,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (errorMessage.includes("PII detected") || errorMessage.includes("privacy")) {
      const errorResponse: ApiErrorResponse = {
        error: "PrivacyViolationError",
        message: errorMessage,
        statusCode: 403,
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to update draft.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/drafts/[draftId]
 *
 * Performs actions on a draft: approve, reject, or send.
 * Enforces human-in-the-loop: only approved drafts can be sent,
 * and low-confidence drafts must be edited before approval.
 *
 * Request Body:
 *   {
 *     "action": "approve" | "reject" | "send",
 *     "userId": "user-agent-001",
 *     "reason": "Optional reason for rejection",
 *     "finalContent": "Optional final content override when sending"
 *   }
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

    const { action, userId, reason, finalContent } = body;

    if (!action || typeof action !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "action is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "userId is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const validActions = ["approve", "reject", "send"];
    const normalizedAction = (action as string).toLowerCase().trim();

    if (!validActions.includes(normalizedAction)) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: `Invalid action: "${action}". Must be one of: ${validActions.join(", ")}.`,
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (normalizedAction === "approve") {
      const result = await approveDraft({
        draftId,
        userId: userId as string,
      });

      return NextResponse.json(result, { status: 200 });
    }

    if (normalizedAction === "reject") {
      const result = await rejectDraft({
        draftId,
        userId: userId as string,
        reason: typeof reason === "string" ? reason : undefined,
      });

      return NextResponse.json(result, { status: 200 });
    }

    if (normalizedAction === "send") {
      const result = await sendDraft({
        draftId,
        userId: userId as string,
        finalContent: typeof finalContent === "string" ? finalContent : undefined,
      });

      return NextResponse.json(result, { status: 200 });
    }

    // Should not reach here due to validation above
    const errorResponse: ApiErrorResponse = {
      error: "ValidationError",
      message: `Unhandled action: "${action}".`,
      statusCode: 400,
    };
    return NextResponse.json(errorResponse, { status: 400 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/drafts/[draftId] error:", errorMessage);

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
      errorMessage.includes("Cannot approve") ||
      errorMessage.includes("Cannot reject") ||
      errorMessage.includes("low confidence") ||
      errorMessage.includes("has not been edited") ||
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
      message: "Failed to process draft action.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}