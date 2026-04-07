import { prisma } from "@/lib/db";
import { azureOpenAIConfig } from "@/lib/config";
import { sanitizeForLLM, checkTextForPII } from "@/services/privacy-compliance";
import {
  logLeadCreated,
  logPIIDetected,
  logAction,
  AuditActions,
  AuditEntityTypes,
} from "@/services/audit-logger";
import { LEAD_SCORE_HIGH_PRIORITY, LEAD_SCORE_MEDIUM_PRIORITY } from "@/lib/constants";
import type { LeadScoreResult, LeadResponse } from "@/types";
import knowledgeBase from "@/data/knowledge-base.json";

// Types

export interface ExtractedLeadData {
  name: string;
  contact: string | null;
  budget: string | null;
  location: string | null;
  intent: string | null;
  confidence: number;
}

export interface ExtractLeadParams {
  dmId: string;
  forceReextract?: boolean;
}

export interface ExtractLeadResult {
  lead: LeadResponse;
  extractedData: ExtractedLeadData;
  scoreResult: LeadScoreResult;
  isNew: boolean;
}

// Budget extraction patterns

function extractBudget(text: string): string | null {
  const lower = text.toLowerCase();

  // Match range patterns: "$500-550k", "$500k-$550k", "$500,000 - $550,000"
  const rangePatterns = [
    /\$\s?([\d,]+)\s*k?\s*[-–to]+\s*\$?\s?([\d,]+)\s*k/gi,
    /\$\s?([\d,]+)\s*[-–to]+\s*\$?\s?([\d,]+)/gi,
    /budget\s+(?:is\s+)?(?:around\s+)?(?:of\s+)?\$\s?([\d,]+)\s*k?\s*[-–to]+\s*\$?\s?([\d,]+)\s*k?/gi,
  ];

  for (const pattern of rangePatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(text);
    if (match && match[1] && match[2]) {
      let min = parseInt(match[1].replace(/,/g, ""), 10);
      let max = parseInt(match[2].replace(/,/g, ""), 10);
      if (min < 10000) min *= 1000;
      if (max < 10000) max *= 1000;
      return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    }
  }

  // Match single value patterns: "$620k", "$620,000", "budget around $620k"
  const singlePatterns = [
    /(?:budget|pre-?approved|spend|afford|looking at)\s+(?:is\s+)?(?:around\s+)?(?:of\s+)?(?:about\s+)?(?:up to\s+)?\$\s?([\d,]+)\s*k?/gi,
    /\$\s?([\d,]+)\s*k/gi,
    /\$\s?([\d,]+(?:,\d{3})+)/gi,
  ];

  for (const pattern of singlePatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(text);
    if (match && match[1]) {
      let value = parseInt(match[1].replace(/,/g, ""), 10);
      if (value < 10000) value *= 1000;
      if (value >= 100000) {
        return `$${value.toLocaleString()}`;
      }
    }
  }

  // Match "under $400k" patterns
  const underMatch = lower.match(/under\s+\$\s?([\d,]+)\s*k?/i);
  if (underMatch && underMatch[1]) {
    let value = parseInt(underMatch[1].replace(/,/g, ""), 10);
    if (value < 10000) value *= 1000;
    return `Under $${value.toLocaleString()}`;
  }

  // Match "up to $1M" patterns
  const upToMatch = lower.match(/up\s+to\s+\$\s?([\d,]+)\s*([km])?/i);
  if (upToMatch && upToMatch[1]) {
    let value = parseInt(upToMatch[1].replace(/,/g, ""), 10);
    const suffix = upToMatch[2]?.toLowerCase();
    if (suffix === "m") value *= 1000000;
    else if (suffix === "k" || value < 10000) value *= 1000;
    return `Up to $${value.toLocaleString()}`;
  }

  return null;
}

// Location extraction

function extractLocation(text: string): string | null {
  const communities = knowledgeBase.communities as Array<{
    name: string;
    location: string;
    suburb?: string;
  }>;

  const lower = text.toLowerCase();

  // Check for community names
  for (const community of communities) {
    const communityLower = community.name.toLowerCase();
    if (lower.includes(communityLower)) {
      // Check for suburb/location context
      const locationParts = community.location.split(",");
      const suburb = community.suburb ?? locationParts[0]?.trim() ?? "";
      if (suburb && lower.includes(suburb.toLowerCase())) {
        return `${community.name}, ${suburb}`;
      }
      return community.name;
    }
  }

  // Check for location names from communities
  const locationNames = [
    { pattern: "marsden park", display: "Marsden Park" },
    { pattern: "berwick", display: "Berwick" },
    { pattern: "leppington", display: "Leppington" },
    { pattern: "kalkallo", display: "Kalkallo" },
    { pattern: "treeby", display: "Treeby" },
    { pattern: "calleya", display: "Calleya" },
    { pattern: "ashfield", display: "Ashfield" },
    { pattern: "cockburn", display: "Cockburn" },
    { pattern: "aubin grove", display: "Aubin Grove" },
    { pattern: "craigieburn", display: "Craigieburn" },
  ];

  for (const loc of locationNames) {
    if (lower.includes(loc.pattern)) {
      // Try to find the associated community
      for (const community of communities) {
        if (community.location.toLowerCase().includes(loc.pattern)) {
          return `${community.name}, ${loc.display}`;
        }
      }
      return loc.display;
    }
  }

  return null;
}

// Intent extraction

function extractIntent(text: string): string | null {
  const lower = text.toLowerCase();
  const intents: string[] = [];

  // Buyer type detection
  if (lower.includes("first home") || lower.includes("first-home")) {
    intents.push("First home buyer");
  }
  if (lower.includes("invest")) {
    intents.push("Investment property");
  }
  if (lower.includes("retirement") || lower.includes("retire")) {
    intents.push("Retirement living");
  }
  if (lower.includes("downsize") || lower.includes("downsiz")) {
    intents.push("Downsizer");
  }
  if (lower.includes("upgrad")) {
    intents.push("Upgrader");
  }
  if (lower.includes("build") || lower.includes("custom")) {
    intents.push("Custom build");
  }
  if (lower.includes("relocat")) {
    intents.push("Relocating");
  }

  // Property type detection
  const bedroomMatch = lower.match(/(\d)[\s-]?bed/);
  if (bedroomMatch && bedroomMatch[1]) {
    intents.push(`${bedroomMatch[1]}-bedroom`);
  }

  if (lower.includes("land only") || (lower.includes("land") && lower.includes("block"))) {
    intents.push("Land purchase");
  } else if (lower.includes("house and land") || lower.includes("h&l")) {
    intents.push("House and land package");
  } else if (lower.includes("apartment") || lower.includes("unit")) {
    intents.push("Apartment");
  }

  // Feature preferences
  if (lower.includes("study") || lower.includes("wfh") || lower.includes("work from home")) {
    intents.push("WFH/study");
  }
  if (lower.includes("north-facing") || lower.includes("north facing")) {
    intents.push("North-facing");
  }
  if (lower.includes("corner lot") || lower.includes("corner block")) {
    intents.push("Corner lot");
  }
  if (lower.includes("display") || lower.includes("tour") || lower.includes("visit")) {
    intents.push("Wants to visit");
  }
  if (lower.includes("move-in") || lower.includes("move in") || lower.includes("ready")) {
    intents.push("Quick move-in");
  }
  if (lower.includes("pet") || lower.includes("dog") || lower.includes("cat")) {
    intents.push("Pet-friendly");
  }

  // Timeline detection
  const monthMatch = lower.match(
    /by\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
  );
  if (monthMatch && monthMatch[1]) {
    intents.push(`Timeline: by ${monthMatch[1]}`);
  }

  const midMatch = lower.match(/(?:by\s+)?mid[\s-]?(\d{4})/i);
  if (midMatch && midMatch[1]) {
    intents.push(`Timeline: mid-${midMatch[1]}`);
  }

  if (lower.includes("asap") || lower.includes("urgently") || lower.includes("quickly")) {
    intents.push("Urgent");
  }

  if (intents.length === 0) {
    // Generic intent detection
    if (lower.includes("interest") || lower.includes("looking") || lower.includes("wondering")) {
      return "General inquiry";
    }
    return null;
  }

  return intents.join(" — ");
}

// Contact extraction (from handle/platform info, not PII from message)

function extractContact(senderHandle: string, platform: string): string {
  return `${senderHandle} (${platform.charAt(0).toUpperCase() + platform.slice(1)})`;
}

// Confidence calculation for rule-based extraction

function calculateExtractionConfidence(data: ExtractedLeadData): number {
  let score = 0.3; // Base confidence for having a name

  if (data.budget) score += 0.2;
  if (data.location) score += 0.2;
  if (data.intent) {
    score += 0.15;
    // Higher confidence if intent is specific
    if (data.intent.includes("—")) {
      const parts = data.intent.split("—").length;
      score += Math.min(parts * 0.03, 0.15);
    }
  }
  if (data.contact) score += 0.05;

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

// Lead scoring

function scoreLead(data: ExtractedLeadData, message: string): LeadScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const lower = message.toLowerCase();

  // Intent signals (max 4 points)
  if (lower.includes("buy") || lower.includes("purchase") || lower.includes("looking at")) {
    score += 2;
    reasons.push("Active purchase intent");
  }
  if (lower.includes("pre-approved") || lower.includes("preapproved")) {
    score += 2;
    reasons.push("Pre-approved for finance");
  }
  if (lower.includes("tour") || lower.includes("visit") || lower.includes("display")) {
    score += 1.5;
    reasons.push("Wants to visit/tour");
  }
  if (lower.includes("schedule") || lower.includes("book") || lower.includes("available")) {
    score += 1;
    reasons.push("Ready to schedule");
  }

  // Budget signals (max 2 points)
  if (data.budget) {
    score += 2;
    reasons.push("Budget specified");
  }

  // Location signals (max 1.5 points)
  if (data.location) {
    score += 1.5;
    reasons.push("Specific location interest");
  }

  // Urgency signals (max 1.5 points)
  if (lower.includes("asap") || lower.includes("urgently") || lower.includes("quickly")) {
    score += 1.5;
    reasons.push("Urgent timeline");
  } else if (lower.match(/by\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)) {
    score += 1;
    reasons.push("Specific timeline mentioned");
  }

  // Contact info signals (max 0.5 points)
  if (data.contact) {
    score += 0.5;
    reasons.push("Contact info available");
  }

  // First home buyer bonus (eligible for grants, high conversion)
  if (lower.includes("first home") || lower.includes("first-home")) {
    score += 0.5;
    reasons.push("First home buyer (grant eligible)");
  }

  // Investor signals
  if (lower.includes("invest") || lower.includes("rental yield") || lower.includes("portfolio")) {
    score += 0.5;
    reasons.push("Investor interest");
  }

  // Retirement living (typically high-value)
  if (lower.includes("retirement") || lower.includes("downsize")) {
    score += 0.5;
    reasons.push("Retirement/downsizer interest");
  }

  // Clamp score to 0-10
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  // Determine priority
  const priorityFlag = score >= LEAD_SCORE_HIGH_PRIORITY;
  let priorityLabel: string;
  if (score >= LEAD_SCORE_HIGH_PRIORITY) {
    priorityLabel = "high";
  } else if (score >= LEAD_SCORE_MEDIUM_PRIORITY) {
    priorityLabel = "medium";
  } else {
    priorityLabel = "low";
  }

  return {
    score,
    priorityFlag,
    intent: data.intent,
    budget: data.budget,
    location: data.location,
    confidence: data.confidence,
    reasoning: `Score: ${score}/10 (${priorityLabel} priority). ${reasons.join("; ")}.`,
  };
}

// GPT-assisted extraction

interface GPTExtractionResult {
  name: string | null;
  budget: string | null;
  location: string | null;
  intent: string | null;
}

async function callGPTForExtraction(
  sanitizedMessage: string,
  senderName: string,
  platform: string
): Promise<GPTExtractionResult | null> {
  const { apiKey, endpoint, deploymentName } = azureOpenAIConfig;

  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-01`;

  const systemPrompt = `You are a lead data extraction assistant for Stockland, an Australian property developer. Extract structured lead data from social media DMs. Return ONLY valid JSON with the following fields:
- name: string (the sender's display name, already provided)
- budget: string or null (e.g., "$500,000 - $550,000", "Under $400,000")
- location: string or null (community or suburb name, e.g., "Elara, Marsden Park", "Aura at Calleya")
- intent: string or null (brief description of what the customer is looking for)

Known Stockland communities: Elara (Marsden Park, NSW), Aura (Calleya/Treeby, WA), Minta (Berwick, VIC), Willowdale (Leppington, NSW), Cloverton (Kalkallo, VIC), Cardinal Freeman (Ashfield, NSW - retirement living).

Do NOT include any PII (phone numbers, emails, addresses, tax file numbers) in the output. Only extract information explicitly stated in the message.`;

  const userPrompt = `Extract lead data from this ${platform} DM.

Sender name: ${senderName}

Message:
${sanitizedMessage}

Return ONLY valid JSON. No explanation.`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.2,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ GPT extraction API error (${response.status}): ${errorText}`);
      return null;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(jsonStr) as GPTExtractionResult;
    return parsed;
  } catch (error) {
    console.error(
      "❌ GPT extraction failed:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// Merge rule-based and GPT extraction results

function mergeExtractionResults(
  ruleBased: ExtractedLeadData,
  gptResult: GPTExtractionResult | null
): ExtractedLeadData {
  if (!gptResult) {
    return ruleBased;
  }

  return {
    name: ruleBased.name, // Always use the DM sender name
    contact: ruleBased.contact, // Always use platform handle
    budget: ruleBased.budget ?? gptResult.budget ?? null,
    location: ruleBased.location ?? gptResult.location ?? null,
    intent: ruleBased.intent ?? gptResult.intent ?? null,
    confidence: ruleBased.confidence,
  };
}

/**
 * Extract structured lead data from a DM.
 *
 * Pipeline:
 * 1. Fetch the DM from the database
 * 2. Check for existing lead (unless forceReextract)
 * 3. Run PII compliance check on the message
 * 4. Extract lead data using rule-based pattern matching
 * 5. Optionally enhance with GPT-assisted extraction
 * 6. Score and flag the lead
 * 7. Persist the lead to the database
 * 8. Log the lead creation in the audit log
 *
 * Returns the created/existing lead with extraction details and score.
 */
export async function extractLead(params: ExtractLeadParams): Promise<ExtractLeadResult> {
  const { dmId, forceReextract = false } = params;

  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  // Fetch the DM
  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  // Check for existing lead unless force re-extract
  if (!forceReextract && dm.leads.length > 0) {
    const existingLead = dm.leads[0];
    const extractedData: ExtractedLeadData = {
      name: existingLead.name,
      contact: existingLead.contact,
      budget: existingLead.budget,
      location: existingLead.location,
      intent: existingLead.intent,
      confidence: existingLead.score > 0 ? 0.9 : 0.5,
    };

    const scoreResult: LeadScoreResult = {
      score: existingLead.score,
      priorityFlag: existingLead.priorityFlag,
      intent: existingLead.intent,
      budget: existingLead.budget,
      location: existingLead.location,
      confidence: extractedData.confidence,
      reasoning: `Existing lead with score ${existingLead.score}/10.`,
    };

    return {
      lead: {
        id: existingLead.id,
        dmId: existingLead.dmId,
        name: existingLead.name,
        contact: existingLead.contact,
        budget: existingLead.budget,
        location: existingLead.location,
        intent: existingLead.intent,
        score: existingLead.score,
        priorityFlag: existingLead.priorityFlag,
        salesforceId: existingLead.salesforceId,
        status: existingLead.status,
        assignedTo: existingLead.assignedTo,
        createdAt: existingLead.createdAt.toISOString(),
        updatedAt: existingLead.updatedAt.toISOString(),
      },
      extractedData,
      scoreResult,
      isNew: false,
    };
  }

  // PII check on the original message
  const piiResult = checkTextForPII(dm.message);
  if (piiResult.hasPII) {
    await logPIIDetected("dm", dm.id, piiResult.detectedTypes);
  }

  // Sanitize message for any LLM calls
  const sanitizedMessage = sanitizeForLLM(dm.message);

  // Rule-based extraction
  const ruleBasedData: ExtractedLeadData = {
    name: dm.senderName,
    contact: extractContact(dm.senderHandle, dm.platform),
    budget: extractBudget(dm.message),
    location: extractLocation(dm.message),
    intent: extractIntent(dm.message),
    confidence: 0,
  };

  ruleBasedData.confidence = calculateExtractionConfidence(ruleBasedData);

  // GPT-assisted extraction if Azure OpenAI is configured and rule-based confidence is low
  let gptResult: GPTExtractionResult | null = null;

  if (azureOpenAIConfig.isConfigured && ruleBasedData.confidence < 0.7) {
    try {
      gptResult = await callGPTForExtraction(sanitizedMessage, dm.senderName, dm.platform);
    } catch (error) {
      console.error(
        "⚠️ GPT extraction failed, using rule-based results only:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Merge results
  const extractedData = mergeExtractionResults(ruleBasedData, gptResult);

  // Recalculate confidence after merge
  extractedData.confidence = calculateExtractionConfidence(extractedData);

  // Score the lead
  const scoreResult = scoreLead(extractedData, dm.message);

  // Persist the lead
  const lead = await prisma.lead.create({
    data: {
      dmId: dm.id,
      name: extractedData.name,
      contact: extractedData.contact,
      budget: extractedData.budget,
      location: extractedData.location,
      intent: extractedData.intent,
      score: scoreResult.score,
      priorityFlag: scoreResult.priorityFlag,
      status: "new",
    },
  });

  // Log lead creation
  await logLeadCreated(lead.id, lead.name, lead.score, lead.priorityFlag);

  // Log extraction details in audit
  await logAction({
    action: AuditActions.LEAD_CREATED,
    entityType: AuditEntityTypes.LEAD,
    entityId: lead.id,
    details: `Lead extracted from DM ${dm.id}. ${scoreResult.reasoning} Confidence: ${(extractedData.confidence * 100).toFixed(1)}%.`,
  });

  const leadResponse: LeadResponse = {
    id: lead.id,
    dmId: lead.dmId,
    name: lead.name,
    contact: lead.contact,
    budget: lead.budget,
    location: lead.location,
    intent: lead.intent,
    score: lead.score,
    priorityFlag: lead.priorityFlag,
    salesforceId: lead.salesforceId,
    status: lead.status,
    assignedTo: lead.assignedTo,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };

  return {
    lead: leadResponse,
    extractedData,
    scoreResult,
    isNew: true,
  };
}

/**
 * Re-extract lead data from a DM, forcing a new extraction even if a lead exists.
 */
export async function reextractLead(dmId: string): Promise<ExtractLeadResult> {
  return extractLead({ dmId, forceReextract: true });
}

/**
 * Extract leads from multiple DMs in batch.
 * Processes each DM individually, collecting results and errors.
 */
export async function extractLeadBatch(
  dmIds: string[]
): Promise<{
  extracted: ExtractLeadResult[];
  errors: Array<{ dmId: string; error: string }>;
}> {
  const extracted: ExtractLeadResult[] = [];
  const errors: Array<{ dmId: string; error: string }> = [];

  for (const dmId of dmIds) {
    try {
      const result = await extractLead({ dmId });
      extracted.push(result);
    } catch (error) {
      errors.push({
        dmId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { extracted, errors };
}

/**
 * Get the lead score for a given lead ID.
 * Re-scores the lead based on the associated DM content.
 */
export async function scoreExistingLead(leadId: string): Promise<LeadScoreResult> {
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

  const extractedData: ExtractedLeadData = {
    name: lead.name,
    contact: lead.contact,
    budget: lead.budget,
    location: lead.location,
    intent: lead.intent,
    confidence: 0,
  };

  extractedData.confidence = calculateExtractionConfidence(extractedData);

  const scoreResult = scoreLead(extractedData, lead.dm.message);

  // Update the lead score in the database if it changed
  if (scoreResult.score !== lead.score || scoreResult.priorityFlag !== lead.priorityFlag) {
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
 * Preview lead extraction without persisting.
 * Useful for UI preview before confirming lead creation.
 */
export async function previewLeadExtraction(
  dmId: string
): Promise<{ extractedData: ExtractedLeadData; scoreResult: LeadScoreResult }> {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  const extractedData: ExtractedLeadData = {
    name: dm.senderName,
    contact: extractContact(dm.senderHandle, dm.platform),
    budget: extractBudget(dm.message),
    location: extractLocation(dm.message),
    intent: extractIntent(dm.message),
    confidence: 0,
  };

  extractedData.confidence = calculateExtractionConfidence(extractedData);

  const scoreResult = scoreLead(extractedData, dm.message);

  return { extractedData, scoreResult };
}