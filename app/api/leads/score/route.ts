import { NextRequest, NextResponse } from "next/server";
import { scoreLead, scoreLeadById, getScoreBreakdown } from "@/services/lead-scorer";
import { triggerHighPriorityLeadNotification } from "@/services/notification-manager";
import type { ApiErrorResponse } from "@/types";

/**
 * POST /api/leads/score
 *
 * Scores a lead using the LeadScorer service. Supports two modes:
 *
 * 1. Score by lead ID (persisted lead):
 *    {
 *      "leadId": "lead-001",
 *      "persistUpdate": true,       // Optional: persist updated score to DB (default: true)
 *      "triggerNotification": true   // Optional: trigger notification if high-priority (default: true)
 *    }
 *
 * 2. Score by message content (ad-hoc scoring without persistence):
 *    {
 *      "message": "Hi, I'm looking for a 3BR in Elara...",
 *      "name": "Sarah M.",
 *      "contact": "@sarah_m_designs (Instagram)",
 *      "budget": "$500,000 - $550,000",
 *      "location": "Elara, Marsden Park",
 *      "intent": "First home buyer — 3-bedroom",
 *      "breakdown": true             // Optional: include detailed score breakdown (default: false)
 *    }
 *
 * Returns the numeric score (0–10), high-priority flag, and scoring reasoning.
 * If the lead is high-priority and triggerNotification is true, triggers a
 * high-priority lead notification to the assigned agent or all managers.
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

    const { leadId, message, name, contact, budget, location, intent, persistUpdate, triggerNotification: shouldTriggerNotification, breakdown } = body;

    // Mode 1: Score by lead ID
    if (leadId && typeof leadId === "string") {
      if (leadId.trim().length === 0) {
        const errorResponse: ApiErrorResponse = {
          error: "ValidationError",
          message: "leadId cannot be empty.",
          statusCode: 400,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      const shouldPersist = typeof persistUpdate === "boolean" ? persistUpdate : true;

      const scoreResult = await scoreLeadById({
        leadId: leadId.trim(),
        persistUpdate: shouldPersist,
      });

      // Trigger high-priority notification if applicable
      const shouldNotify = typeof shouldTriggerNotification === "boolean" ? shouldTriggerNotification : true;

      if (shouldNotify && scoreResult.priorityFlag) {
        try {
          await triggerHighPriorityLeadNotification(leadId.trim());
        } catch (notifError) {
          // Notification failure should not block the scoring response
          console.error(
            "⚠️ Failed to trigger high-priority lead notification:",
            notifError instanceof Error ? notifError.message : String(notifError)
          );
        }
      }

      // Optionally include breakdown
      let scoreBreakdown = undefined;
      if (breakdown === true) {
        // Fetch the lead to get the message for breakdown
        const { prisma } = await import("@/lib/db");
        const lead = await prisma.lead.findUnique({
          where: { id: leadId.trim() },
          include: { dm: true },
        });

        if (lead && lead.dm) {
          scoreBreakdown = getScoreBreakdown({
            leadId: lead.id,
            message: lead.dm.message,
            name: lead.name,
            contact: lead.contact,
            budget: lead.budget,
            location: lead.location,
            intent: lead.intent,
          });
        }
      }

      return NextResponse.json(
        {
          leadId: leadId.trim(),
          score: scoreResult.score,
          priorityFlag: scoreResult.priorityFlag,
          intent: scoreResult.intent,
          budget: scoreResult.budget,
          location: scoreResult.location,
          confidence: scoreResult.confidence,
          reasoning: scoreResult.reasoning,
          ...(scoreBreakdown ? { breakdown: scoreBreakdown } : {}),
        },
        { status: 200 }
      );
    }

    // Mode 2: Score by message content (ad-hoc)
    if (!message || typeof message !== "string") {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "Either leadId or message is required. leadId must be a string, or message must be a non-empty string.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (message.trim().length === 0) {
      const errorResponse: ApiErrorResponse = {
        error: "ValidationError",
        message: "message cannot be empty.",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const scoreParams = {
      message: message as string,
      name: typeof name === "string" ? name : undefined,
      contact: typeof contact === "string" ? contact : null,
      budget: typeof budget === "string" ? budget : null,
      location: typeof location === "string" ? location : null,
      intent: typeof intent === "string" ? intent : null,
    };

    const scoreResult = scoreLead(scoreParams);

    // Optionally include breakdown
    let scoreBreakdown = undefined;
    if (breakdown === true) {
      scoreBreakdown = getScoreBreakdown(scoreParams);
    }

    return NextResponse.json(
      {
        score: scoreResult.score,
        priorityFlag: scoreResult.priorityFlag,
        intent: scoreResult.intent,
        budget: scoreResult.budget,
        location: scoreResult.location,
        confidence: scoreResult.confidence,
        reasoning: scoreResult.reasoning,
        ...(scoreBreakdown ? { breakdown: scoreBreakdown } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ POST /api/leads/score error:", errorMessage);

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
      errorMessage.includes("is required") ||
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
        message: "Lead scoring rate limit exceeded. Please try again shortly.",
        statusCode: 429,
      };
      return NextResponse.json(errorResponse, { status: 429 });
    }

    const errorResponse: ApiErrorResponse = {
      error: "InternalServerError",
      message: "Failed to score lead.",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}