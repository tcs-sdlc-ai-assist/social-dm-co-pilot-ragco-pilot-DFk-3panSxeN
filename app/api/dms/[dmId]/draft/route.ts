import { NextRequest, NextResponse } from "next/server";
import { generateDraft } from "@/services/draft-generator";
import { listDraftsForDM } from "@/services/draft-composer";
import type { ApiErrorResponse } from "@/types";

/**
 * GET /api/dms/[dmId]/draft
 *
 * Retrieves existing drafts for a specific DM, ordered by most recent first.
 * Returns all drafts associated with the DM including content, confidence scores,
 * edit status, and draft status.
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

    const drafts = await listDraftsForDM(dmId);

    return NextResponse.json(
      {
        dmId,
        drafts,
        total: drafts.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ GET /api/dms/[dmId]/draft error:", errorMessage);

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
      message: "Failed to retrieve drafts.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/dms/[dmId]/draft
 *
 * Triggers AI-powered draft generation for a specific DM.
 * Uses the DraftGeneratorService RAG pipeline:
 * 1. Retrieves relevant knowledge base entries based on DM content
 * 2. Sanitizes DM content (redacts PII) before sending to LLM
 * 3. Constructs a prompt with context and brand guidelines
 * 4. Generates a draft response via Azure OpenAI (or fallback template)
 * 5. Validates the draft for compliance
 * 6. Calculates a confidence score
 * 7. Persists the draft and updates DM status
 *
 * Request Body (optional):
 *   {
 *     "knowledgeContext": ["Elara", "3BR"],  // Additional keywords for context retrieval
 *     "forceRegenerate": false               // Force regeneration even if draft exists
 *   }
 *
 * Returns the generated draft with confidence score and metadata.
 */
export async function POST(
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

    const knowledgeContext: string[] = Array.isArray(body.knowledgeContext)
      ? (body.knowledgeContext as unknown[]).filter(
          (item): item is string => typeof item === "string"
        )
      : [];

    const forceRegenerate =
      typeof body.forceRegenerate === "boolean" ? body.forceRegenerate : false;

    const result = await generateDraft({
      dmId,
      knowledgeContext,
      forceRegenerate,
    });

    return NextResponse.json(
      {
        draftId: result.draftId,
        dmId,
        content: result.content,
        confidenceScore: result.confidenceScore,
        tokensUsed: result.tokensUsed,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/dms/[dmId]/draft error:", errorMessage);

    if (errorMessage.includes("DM not found")) {
      const errorResponse: ApiErrorResponse = {
        error: "NotFoundError",
        message: errorMessage,
        statusCode: 404,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (
      errorMessage.includes("DM ID is required") ||
      errorMessage.includes("cannot be empty")
    ) {
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

    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      const errorResponse: ApiErrorResponse = {
        error: "RateLimitError",
        message: "Draft generation rate limit exceeded. Please try again shortly.",
        statusCode: 429,
      };
      return NextResponse.json(errorResponse, { status: 429 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to generate draft.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}