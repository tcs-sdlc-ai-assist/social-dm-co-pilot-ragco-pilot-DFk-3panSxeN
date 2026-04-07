import { NextRequest, NextResponse } from "next/server";
import { extractLead, previewLeadExtraction, extractLeadBatch } from "@/services/lead-extractor";
import type { ApiErrorResponse } from "@/types";

/**
 * POST /api/leads/extract
 *
 * Extracts structured lead data from a DM using the LeadExtractor service.
 * Uses a pipeline of rule-based pattern matching and optional GPT-assisted extraction
 * to identify lead fields: name, contact, budget, location, and intent.
 *
 * Supports three modes:
 *
 * 1. Single DM extraction:
 *    {
 *      "dmId": "dm-001",
 *      "forceReextract": false  // Optional: force re-extraction even if lead exists
 *    }
 *
 * 2. Batch DM extraction:
 *    {
 *      "dmIds": ["dm-001", "dm-002", "dm-003"]
 *    }
 *
 * 3. Preview extraction (without persisting):
 *    {
 *      "dmId": "dm-001",
 *      "preview": true
 *    }
 *
 * Returns the extracted lead with score, priority flag, and extraction confidence.
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

    const { dmId, dmIds, forceReextract, preview } = body;

    // Batch extraction mode
    if (Array.isArray(dmIds)) {
      const validDmIds = (dmIds as unknown[]).filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      );

      if (validDmIds.length === 0) {
        const errorResponse: ApiErrorResponse = {
          error: "ValidationError",
          message: "dmIds must be a non-empty array of strings.",
          statusCode: 400,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      const result = await extractLeadBatch(validDmIds);

      return NextResponse.json(
        {
          extracted: result.extracted.map((item) => ({
            lead: item.lead,
            extractedData: item.extractedData,
            scoreResult: item.scoreResult,
            isNew: item.isNew,
          })),
          errors: result.errors,
          total: validDmIds.length,
          successCount: result.extracted.length,
          errorCount: result.errors.length,
        },
        { status: 200 }
      );
    }

    // Single DM extraction (or preview)
    if (!dmId || typeof dmId !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "dmId is required and must be a string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (dmId.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "dmId cannot be empty.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Preview mode — extract without persisting
    if (preview === true) {
      const previewResult = await previewLeadExtraction(dmId);

      return NextResponse.json(
        {
          dmId,
          preview: true,
          extractedData: previewResult.extractedData,
          scoreResult: previewResult.scoreResult,
        },
        { status: 200 }
      );
    }

    // Standard extraction mode
    const shouldForceReextract =
      typeof forceReextract === "boolean" ? forceReextract : false;

    const result = await extractLead({
      dmId,
      forceReextract: shouldForceReextract,
    });

    return NextResponse.json(
      {
        lead: result.lead,
        extractedData: result.extractedData,
        scoreResult: result.scoreResult,
        isNew: result.isNew,
      },
      { status: result.isNew ? 201 : 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/leads/extract error:", errorMessage);

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
        message: "Lead extraction rate limit exceeded. Please try again shortly.",
        statusCode: 429,
      };
      return NextResponse.json(errorResponse, { status: 429 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to extract lead data.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}