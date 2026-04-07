import { prisma } from "@/lib/db";
import {
  LEAD_SCORE_HIGH_PRIORITY,
  LEAD_SCORE_MEDIUM_PRIORITY,
  LEAD_SCORE_MIN,
  LEAD_SCORE_MAX,
} from "@/lib/constants";
import {
  logAction,
  AuditActions,
  AuditEntityTypes,
} from "@/services/audit-logger";
import type { LeadScoreResult } from "@/types";
import knowledgeBase from "@/data/knowledge-base.json";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScoreLeadParams {
  leadId?: string;
  message: string;
  name?: string;
  contact?: string | null;
  budget?: string | null;
  location?: string | null;
  intent?: string | null;
}

export interface ScoreLeadByIdParams {
  leadId: string;
  persistUpdate?: boolean;
}

export interface ScoreBreakdown {
  intentScore: number;
  engagementScore: number;
  budgetScore: number;
  locationScore: number;
  urgencyScore: number;
  completenessScore: number;
  total: number;
  reasons: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Maximum contribution per scoring dimension (sums to 10)
const MAX_INTENT_SCORE = 3.0;
const MAX_ENGAGEMENT_SCORE = 2.0;
const MAX_BUDGET_SCORE = 2.0;
const MAX_LOCATION_SCORE = 1.5;
const MAX_URGENCY_SCORE = 1.0;
const MAX_COMPLETENESS_SCORE = 0.5;

// Known high-demand communities from the knowledge base
const HIGH_DEMAND_COMMUNITIES: string[] = knowledgeBase.communities
  .filter((c) => c.status === "selling")
  .map((c) => c.name.toLowerCase());

// Known location names from the knowledge base
const KNOWN_LOCATIONS: string[] = knowledgeBase.communities.flatMap((c) => {
  const parts: string[] = [c.name.toLowerCase()];
  const locationParts = c.location.split(",").map((p) => p.trim().toLowerCase());
  parts.push(...locationParts);
  return parts;
});

// ─── Intent Signal Detection ─────────────────────────────────────────────────

function scoreIntentSignals(message: string, intent: string | null): { score: number; reasons: string[] } {
  const lower = message.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Strong purchase intent signals (up to 1.5)
  if (
    lower.includes("buy") ||
    lower.includes("purchase") ||
    lower.includes("looking to buy") ||
    lower.includes("want to buy")
  ) {
    score += 1.5;
    reasons.push("Active purchase intent detected");
  } else if (
    lower.includes("looking at") ||
    lower.includes("interested in") ||
    lower.includes("looking for")
  ) {
    score += 1.0;
    reasons.push("Interest-level intent detected");
  } else if (
    lower.includes("wondering") ||
    lower.includes("curious") ||
    lower.includes("just checking")
  ) {
    score += 0.3;
    reasons.push("Exploratory intent detected");
  }

  // Pre-approval is a very strong signal (up to 1.0)
  if (lower.includes("pre-approved") || lower.includes("preapproved") || lower.includes("pre approved")) {
    score += 1.0;
    reasons.push("Pre-approved for finance");
  }

  // Specific property type intent (up to 0.5)
  if (
    lower.includes("house and land") ||
    lower.includes("h&l") ||
    lower.includes("land") ||
    lower.includes("apartment") ||
    lower.includes("retirement")
  ) {
    score += 0.5;
    reasons.push("Specific property type interest");
  }

  // Intent field from extraction adds confidence
  if (intent && intent.length > 0) {
    const intentParts = intent.split("—").length;
    if (intentParts >= 3) {
      score += 0.3;
      reasons.push("Multi-faceted intent identified");
    } else if (intentParts >= 2) {
      score += 0.2;
      reasons.push("Detailed intent identified");
    }
  }

  return {
    score: Math.min(score, MAX_INTENT_SCORE),
    reasons,
  };
}

// ─── Engagement Signal Detection ─────────────────────────────────────────────

function scoreEngagementSignals(message: string): { score: number; reasons: string[] } {
  const lower = message.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Wants to visit / tour / book (strong engagement)
  if (
    lower.includes("visit") ||
    lower.includes("tour") ||
    lower.includes("display") ||
    lower.includes("open day") ||
    lower.includes("come and see") ||
    lower.includes("look around")
  ) {
    score += 1.0;
    reasons.push("Wants to visit/tour");
  }

  // Ready to schedule / book
  if (
    lower.includes("book") ||
    lower.includes("schedule") ||
    lower.includes("arrange") ||
    lower.includes("available this") ||
    lower.includes("available for")
  ) {
    score += 0.5;
    reasons.push("Ready to schedule");
  }

  // Asks specific questions (shows research / engagement)
  const questionCount = (message.match(/\?/g) || []).length;
  if (questionCount >= 3) {
    score += 0.5;
    reasons.push("Multiple specific questions asked");
  } else if (questionCount >= 1) {
    score += 0.3;
    reasons.push("Specific questions asked");
  }

  // Message length as engagement proxy (longer = more invested)
  if (message.length >= 300) {
    score += 0.3;
    reasons.push("Detailed message (high engagement)");
  } else if (message.length >= 150) {
    score += 0.15;
    reasons.push("Moderate message detail");
  }

  // Mentions specific features (shows research)
  const featureKeywords = [
    "bedroom", "bed", "bathroom", "bath", "garage", "study",
    "alfresco", "north-facing", "north facing", "corner lot",
    "walk-in", "butler", "ensuite", "open plan", "open-plan",
  ];
  const featureMatches = featureKeywords.filter((kw) => lower.includes(kw));
  if (featureMatches.length >= 3) {
    score += 0.3;
    reasons.push("Multiple specific features mentioned");
  } else if (featureMatches.length >= 1) {
    score += 0.15;
    reasons.push("Specific features mentioned");
  }

  return {
    score: Math.min(score, MAX_ENGAGEMENT_SCORE),
    reasons,
  };
}

// ─── Budget Signal Detection ─────────────────────────────────────────────────

function scoreBudgetSignals(message: string, budget: string | null): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (budget && budget.length > 0) {
    // Budget was successfully extracted — strong signal
    score += 1.5;
    reasons.push("Budget specified");

    // Check if budget is a range (shows more thought/research)
    if (budget.includes("-") || budget.includes("to")) {
      score += 0.3;
      reasons.push("Budget range provided (considered buyer)");
    }

    // Check for pre-approval context alongside budget
    const lower = message.toLowerCase();
    if (lower.includes("pre-approved") || lower.includes("preapproved")) {
      score += 0.2;
      reasons.push("Budget backed by pre-approval");
    }
  } else {
    // Check for budget-adjacent signals in the message
    const lower = message.toLowerCase();
    if (lower.includes("budget") || lower.includes("afford") || lower.includes("spend")) {
      score += 0.5;
      reasons.push("Budget discussion without specific amount");
    }
    if (lower.includes("deposit") || lower.includes("saved") || lower.includes("saving")) {
      score += 0.3;
      reasons.push("Deposit/savings mentioned");
    }
  }

  return {
    score: Math.min(score, MAX_BUDGET_SCORE),
    reasons,
  };
}

// ─── Location Signal Detection ───────────────────────────────────────────────

function scoreLocationSignals(message: string, location: string | null): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (location && location.length > 0) {
    // Location was successfully extracted
    score += 1.0;
    reasons.push("Specific location interest");

    // Check if it matches a known high-demand community
    const locationLower = location.toLowerCase();
    const matchesHighDemand = HIGH_DEMAND_COMMUNITIES.some(
      (community) => locationLower.includes(community)
    );

    if (matchesHighDemand) {
      score += 0.5;
      reasons.push("High-demand community match");
    }
  } else {
    // Check for location-adjacent signals in the message
    const lower = message.toLowerCase();
    const matchesKnownLocation = KNOWN_LOCATIONS.some((loc) => lower.includes(loc));
    if (matchesKnownLocation) {
      score += 0.7;
      reasons.push("Known location mentioned in message");
    }
  }

  return {
    score: Math.min(score, MAX_LOCATION_SCORE),
    reasons,
  };
}

// ─── Urgency Signal Detection ────────────────────────────────────────────────

function scoreUrgencySignals(message: string): { score: number; reasons: string[] } {
  const lower = message.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Immediate urgency
  if (
    lower.includes("asap") ||
    lower.includes("urgently") ||
    lower.includes("quickly") ||
    lower.includes("as soon as possible") ||
    lower.includes("right away")
  ) {
    score += 1.0;
    reasons.push("Urgent timeline");
  }

  // Specific month/date timeline
  const monthPattern = /by\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  if (monthPattern.test(lower)) {
    score += 0.7;
    reasons.push("Specific month deadline mentioned");
  }

  // Mid-year / end-of-year timeline
  const midYearPattern = /(?:by\s+)?(?:mid|end of|early)\s*[-\s]?\d{4}/i;
  if (midYearPattern.test(lower)) {
    score += 0.5;
    reasons.push("Year-based timeline mentioned");
  }

  // Currently renting / staying with family (motivated to move)
  if (
    lower.includes("currently renting") ||
    lower.includes("staying with family") ||
    lower.includes("staying with") ||
    lower.includes("need to move")
  ) {
    score += 0.4;
    reasons.push("Currently in temporary housing (motivated mover)");
  }

  // Move-in ready preference
  if (
    lower.includes("move-in") ||
    lower.includes("move in") ||
    lower.includes("ready to move") ||
    lower.includes("completed homes") ||
    lower.includes("quick settlement")
  ) {
    score += 0.3;
    reasons.push("Wants move-in ready property");
  }

  return {
    score: Math.min(score, MAX_URGENCY_SCORE),
    reasons,
  };
}

// ─── Completeness Score ──────────────────────────────────────────────────────

function scoreCompleteness(
  contact: string | null,
  budget: string | null,
  location: string | null,
  intent: string | null
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  let fieldsPresent = 0;

  if (contact && contact.length > 0) fieldsPresent++;
  if (budget && budget.length > 0) fieldsPresent++;
  if (location && location.length > 0) fieldsPresent++;
  if (intent && intent.length > 0) fieldsPresent++;

  if (fieldsPresent >= 4) {
    score = 0.5;
    reasons.push("Complete lead profile (all fields extracted)");
  } else if (fieldsPresent >= 3) {
    score = 0.35;
    reasons.push("Near-complete lead profile");
  } else if (fieldsPresent >= 2) {
    score = 0.2;
    reasons.push("Partial lead profile");
  } else if (fieldsPresent >= 1) {
    score = 0.1;
    reasons.push("Minimal lead profile");
  }

  return {
    score: Math.min(score, MAX_COMPLETENESS_SCORE),
    reasons,
  };
}

// ─── Score Aggregation ───────────────────────────────────────────────────────

function computeScoreBreakdown(params: ScoreLeadParams): ScoreBreakdown {
  const { message, contact, budget, location, intent } = params;

  const intentResult = scoreIntentSignals(message, intent);
  const engagementResult = scoreEngagementSignals(message);
  const budgetResult = scoreBudgetSignals(message, budget);
  const locationResult = scoreLocationSignals(message, location);
  const urgencyResult = scoreUrgencySignals(message);
  const completenessResult = scoreCompleteness(contact, budget, location, intent);

  const total =
    intentResult.score +
    engagementResult.score +
    budgetResult.score +
    locationResult.score +
    urgencyResult.score +
    completenessResult.score;

  const reasons = [
    ...intentResult.reasons,
    ...engagementResult.reasons,
    ...budgetResult.reasons,
    ...locationResult.reasons,
    ...urgencyResult.reasons,
    ...completenessResult.reasons,
  ];

  return {
    intentScore: Math.round(intentResult.score * 100) / 100,
    engagementScore: Math.round(engagementResult.score * 100) / 100,
    budgetScore: Math.round(budgetResult.score * 100) / 100,
    locationScore: Math.round(locationResult.score * 100) / 100,
    urgencyScore: Math.round(urgencyResult.score * 100) / 100,
    completenessScore: Math.round(completenessResult.score * 100) / 100,
    total: Math.max(LEAD_SCORE_MIN, Math.min(LEAD_SCORE_MAX, Math.round(total * 10) / 10)),
    reasons,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Score a lead based on declared intent, engagement signals, budget indicators,
 * location match, urgency, and profile completeness.
 *
 * Uses ONLY behavioural and declared signals — no demographic data is used
 * (bias mitigation). Returns a numeric score 0–10 and a high-priority flag (≥8.0).
 *
 * Scoring dimensions:
 * - Intent signals (max 3.0): purchase intent, pre-approval, property type
 * - Engagement signals (max 2.0): visit requests, questions, message detail
 * - Budget signals (max 2.0): budget specified, range, pre-approval backing
 * - Location signals (max 1.5): specific location, high-demand community
 * - Urgency signals (max 1.0): timeline, current housing situation
 * - Completeness (max 0.5): number of extracted lead fields
 */
export function scoreLead(params: ScoreLeadParams): LeadScoreResult {
  const { message, budget, location, intent } = params;

  if (!message || message.trim().length === 0) {
    return {
      score: 0,
      priorityFlag: false,
      intent: intent ?? null,
      budget: budget ?? null,
      location: location ?? null,
      confidence: 0,
      reasoning: "Score: 0/10 (low priority). No message content to score.",
    };
  }

  const breakdown = computeScoreBreakdown(params);

  const priorityFlag = breakdown.total >= LEAD_SCORE_HIGH_PRIORITY;

  let priorityLabel: string;
  if (breakdown.total >= LEAD_SCORE_HIGH_PRIORITY) {
    priorityLabel = "high";
  } else if (breakdown.total >= LEAD_SCORE_MEDIUM_PRIORITY) {
    priorityLabel = "medium";
  } else {
    priorityLabel = "low";
  }

  // Confidence is based on how many scoring dimensions contributed
  const activeDimensions = [
    breakdown.intentScore > 0,
    breakdown.engagementScore > 0,
    breakdown.budgetScore > 0,
    breakdown.locationScore > 0,
    breakdown.urgencyScore > 0,
    breakdown.completenessScore > 0,
  ].filter(Boolean).length;

  const confidence = Math.min(1, Math.round((activeDimensions / 6 + 0.3) * 100) / 100);

  const reasoningSummary = `Score: ${breakdown.total}/10 (${priorityLabel} priority). ${breakdown.reasons.join("; ")}.`;

  return {
    score: breakdown.total,
    priorityFlag,
    intent: intent ?? null,
    budget: budget ?? null,
    location: location ?? null,
    confidence,
    reasoning: reasoningSummary,
  };
}

/**
 * Score an existing lead by ID. Fetches the lead and its associated DM,
 * then runs the scoring algorithm. Optionally persists the updated score.
 */
export async function scoreLeadById(params: ScoreLeadByIdParams): Promise<LeadScoreResult> {
  const { leadId, persistUpdate = true } = params;

  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required.");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      dm: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}.`);
  }

  if (!lead.dm) {
    throw new Error(`Associated DM not found for lead: ${leadId}.`);
  }

  const scoreResult = scoreLead({
    leadId: lead.id,
    message: lead.dm.message,
    name: lead.name,
    contact: lead.contact,
    budget: lead.budget,
    location: lead.location,
    intent: lead.intent,
  });

  // Persist the updated score if it changed
  if (persistUpdate && (scoreResult.score !== lead.score || scoreResult.priorityFlag !== lead.priorityFlag)) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        score: scoreResult.score,
        priorityFlag: scoreResult.priorityFlag,
      },
    });

    await logAction({
      action: AuditActions.LEAD_SCORE_UPDATED,
      entityType: AuditEntityTypes.LEAD,
      entityId: leadId,
      details: `Lead score updated from ${lead.score} to ${scoreResult.score}. Priority: ${scoreResult.priorityFlag ? "High" : "Normal"}. ${scoreResult.reasoning}`,
    });
  }

  return scoreResult;
}

/**
 * Score multiple leads in batch. Processes each lead individually,
 * collecting results and errors.
 */
export async function scoreLeadBatch(
  leadIds: string[],
  persistUpdate: boolean = true
): Promise<{
  scored: Array<{ leadId: string; result: LeadScoreResult }>;
  errors: Array<{ leadId: string; error: string }>;
}> {
  const scored: Array<{ leadId: string; result: LeadScoreResult }> = [];
  const errors: Array<{ leadId: string; error: string }> = [];

  for (const leadId of leadIds) {
    try {
      const result = await scoreLeadById({ leadId, persistUpdate });
      scored.push({ leadId, result });
    } catch (error) {
      errors.push({
        leadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { scored, errors };
}

/**
 * Get the detailed score breakdown for a lead.
 * Useful for UI transparency and explainability.
 */
export function getScoreBreakdown(params: ScoreLeadParams): ScoreBreakdown {
  if (!params.message || params.message.trim().length === 0) {
    return {
      intentScore: 0,
      engagementScore: 0,
      budgetScore: 0,
      locationScore: 0,
      urgencyScore: 0,
      completenessScore: 0,
      total: 0,
      reasons: ["No message content to score."],
    };
  }

  return computeScoreBreakdown(params);
}

/**
 * Determine the priority label for a given score.
 */
export function getPriorityFromScore(score: number): "high" | "medium" | "low" {
  if (score >= LEAD_SCORE_HIGH_PRIORITY) return "high";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "medium";
  return "low";
}

/**
 * Check if a score qualifies as high priority.
 */
export function isHighPriority(score: number): boolean {
  return score >= LEAD_SCORE_HIGH_PRIORITY;
}