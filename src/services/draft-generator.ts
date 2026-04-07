import { prisma } from "@/lib/db";
import { azureOpenAIConfig } from "@/lib/config";
import { sanitizeForLLM, validateDraftCompliance } from "@/services/privacy-compliance";
import { logDraftGenerated, logPIIDetected } from "@/services/audit-logger";
import { checkTextForPII } from "@/services/privacy-compliance";
import { updateDMStatus } from "@/services/dm-status-tracker";
import { CONFIDENCE_THRESHOLD_LOW } from "@/lib/constants";
import type { DraftGenerationResult } from "@/types";
import knowledgeBase from "@/data/knowledge-base.json";

// Types for knowledge base structures

interface KBListing {
  id: string;
  type: string;
  name: string;
  bedrooms?: number;
  bathrooms?: number;
  garage?: number;
  parking?: number;
  floorPlan?: string;
  landSize?: string;
  houseSize?: string;
  size?: string;
  priceFrom?: number;
  priceTo?: number;
  features?: string[];
  availability?: string;
  estimatedCompletion?: string;
  suitableFor?: string[];
}

interface KBGrant {
  name: string;
  amount: number | null;
  eligibility: string;
  details: string;
}

interface KBDisplayVillage {
  address: string;
  openHours: string;
  displayHomes: number;
  builders: string[];
}

interface KBCommunity {
  id: string;
  name: string;
  location: string;
  state: string;
  type: string;
  status: string;
  description: string;
  features: string[];
  amenities: string[];
  listings: KBListing[];
  displayVillage?: KBDisplayVillage;
  grants?: KBGrant[];
  investorInfo?: {
    expectedRentalYield: string;
    medianRent: string;
    capitalGrowth: string;
    vacancyRate: string;
    depreciationBenefits: string;
  };
  retirementLivingInfo?: {
    contractType: string;
    exitFee: string;
    ongoingFees: string;
    ageRequirement: string;
    petsAllowed: boolean;
    careServices: string;
    waitlist: string;
  };
}

interface KBFAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface KBResponseTemplate {
  id: string;
  platform: string;
  category: string;
  name: string;
  template: string;
  variables: string[];
  tone: string;
}

interface RetrievedContext {
  communities: KBCommunity[];
  listings: KBListing[];
  faqs: KBFAQ[];
  templates: KBResponseTemplate[];
  grants: KBGrant[];
  relevanceScore: number;
}

interface GenerateDraftParams {
  dmId: string;
  knowledgeContext?: string[];
  forceRegenerate?: boolean;
}

// Keyword extraction helpers

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const keywords: string[] = [];

  // Community names
  const communityNames = ["elara", "aura", "calleya", "minta", "willowdale", "cloverton", "cardinal freeman"];
  for (const name of communityNames) {
    if (lower.includes(name)) {
      keywords.push(name);
    }
  }

  // Location names
  const locations = [
    "marsden park", "berwick", "leppington", "kalkallo", "treeby", "ashfield",
    "cockburn", "aubin grove", "craigieburn",
  ];
  for (const loc of locations) {
    if (lower.includes(loc)) {
      keywords.push(loc);
    }
  }

  // Property types
  if (lower.includes("land")) keywords.push("land");
  if (lower.includes("house and land") || lower.includes("h&l")) keywords.push("house_and_land");
  if (lower.includes("retirement") || lower.includes("downsize") || lower.includes("downsiz")) keywords.push("retirement");
  if (lower.includes("apartment") || lower.includes("unit")) keywords.push("apartment");

  // Buyer types
  if (lower.includes("first home") || lower.includes("first-home")) keywords.push("first_home_buyer");
  if (lower.includes("invest")) keywords.push("investor");
  if (lower.includes("family") || lower.includes("families")) keywords.push("family");
  if (lower.includes("upgrad")) keywords.push("upgrader");
  if (lower.includes("downsize") || lower.includes("downsiz")) keywords.push("downsizer");

  // Features
  if (/\d[\s-]?bed/.test(lower)) {
    const match = lower.match(/(\d)[\s-]?bed/);
    if (match && match[1]) {
      keywords.push(`${match[1]}_bedroom`);
    }
  }
  if (lower.includes("study") || lower.includes("wfh") || lower.includes("work from home")) keywords.push("study");
  if (lower.includes("garage")) keywords.push("garage");
  if (lower.includes("north-facing") || lower.includes("north facing")) keywords.push("north_facing");
  if (lower.includes("corner lot") || lower.includes("corner block")) keywords.push("corner_lot");
  if (lower.includes("display")) keywords.push("display_village");
  if (lower.includes("grant")) keywords.push("grants");
  if (lower.includes("pet") || lower.includes("dog") || lower.includes("cat")) keywords.push("pets");

  // Budget extraction
  const budgetMatch = lower.match(/\$[\d,]+k?/g);
  if (budgetMatch) {
    keywords.push("has_budget");
  }

  // Rental yield / investment
  if (lower.includes("rental yield") || lower.includes("yield")) keywords.push("rental_yield");
  if (lower.includes("capital growth")) keywords.push("capital_growth");

  return [...new Set(keywords)];
}

function extractBudgetRange(text: string): { min: number; max: number } | null {
  const lower = text.toLowerCase();

  // Match patterns like "$500-550k", "$500k-$550k", "$500,000 - $550,000"
  const rangeMatch = lower.match(/\$?([\d,]+)\s*k?\s*[-–to]+\s*\$?([\d,]+)\s*k?/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    let min = parseInt(rangeMatch[1].replace(/,/g, ""), 10);
    let max = parseInt(rangeMatch[2].replace(/,/g, ""), 10);
    if (min < 10000) min *= 1000;
    if (max < 10000) max *= 1000;
    return { min, max };
  }

  // Match single values like "$620k", "$620,000"
  const singleMatch = lower.match(/\$?([\d,]+)\s*k?/);
  if (singleMatch && singleMatch[1]) {
    let value = parseInt(singleMatch[1].replace(/,/g, ""), 10);
    if (value < 10000) value *= 1000;
    // Create a range around the single value (±10%)
    return { min: Math.floor(value * 0.9), max: Math.ceil(value * 1.1) };
  }

  return null;
}

function extractBedroomCount(text: string): number | null {
  const match = text.toLowerCase().match(/(\d)[\s-]?bed/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

// RAG retrieval functions

function retrieveRelevantCommunities(keywords: string[]): KBCommunity[] {
  const communities = knowledgeBase.communities as unknown as KBCommunity[];
  const scored: Array<{ community: KBCommunity; score: number }> = [];

  for (const community of communities) {
    let score = 0;
    const communityLower = community.name.toLowerCase();
    const locationLower = community.location.toLowerCase();

    for (const keyword of keywords) {
      if (communityLower.includes(keyword) || locationLower.includes(keyword)) {
        score += 10;
      }
      if (community.type === "retirement_living" && keyword === "retirement") {
        score += 8;
      }
      if (keyword === "investor" && (community as Record<string, unknown>).investorInfo) {
        score += 5;
      }
      if (keyword === "first_home_buyer" && community.grants && community.grants.length > 0) {
        score += 3;
      }
    }

    if (score > 0) {
      scored.push({ community, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.community);
}

function retrieveRelevantListings(
  communities: KBCommunity[],
  keywords: string[],
  budgetRange: { min: number; max: number } | null,
  bedroomCount: number | null
): KBListing[] {
  const allListings: Array<{ listing: KBListing; score: number }> = [];

  for (const community of communities) {
    for (const listing of community.listings) {
      let score = 0;

      // Budget match
      if (budgetRange && listing.priceFrom && listing.priceTo) {
        if (listing.priceFrom <= budgetRange.max && listing.priceTo >= budgetRange.min) {
          score += 10;
        } else if (listing.priceFrom <= budgetRange.max * 1.1) {
          score += 3;
        }
      }

      // Bedroom match
      if (bedroomCount && listing.bedrooms) {
        if (listing.bedrooms === bedroomCount) {
          score += 8;
        } else if (Math.abs(listing.bedrooms - bedroomCount) === 1) {
          score += 3;
        }
      }

      // Feature keywords
      for (const keyword of keywords) {
        if (keyword === "land" && listing.type === "land") score += 5;
        if (keyword === "house_and_land" && listing.type === "house_and_land") score += 5;
        if (keyword === "apartment" && listing.type === "retirement_apartment") score += 5;
        if (keyword === "study" && listing.features?.some((f) => f.toLowerCase().includes("study"))) score += 4;
        if (keyword === "garage" && (listing.garage ?? 0) >= 2) score += 3;
        if (keyword === "north_facing" && listing.features?.some((f) => f.toLowerCase().includes("north"))) score += 4;
        if (keyword === "corner_lot" && listing.features?.some((f) => f.toLowerCase().includes("corner"))) score += 4;
        if (keyword === "first_home_buyer" && listing.suitableFor?.includes("first_home_buyers")) score += 3;
        if (keyword === "investor" && listing.suitableFor?.includes("investors")) score += 3;
        if (keyword === "family" && listing.suitableFor?.includes("families")) score += 3;
      }

      if (listing.availability === "available") {
        score += 2;
      }

      if (score > 0) {
        allListings.push({ listing, score });
      }
    }
  }

  allListings.sort((a, b) => b.score - a.score);
  return allListings.slice(0, 5).map((s) => s.listing);
}

function retrieveRelevantFAQs(keywords: string[]): KBFAQ[] {
  const faqs = knowledgeBase.faqs as unknown as KBFAQ[];
  const scored: Array<{ faq: KBFAQ; score: number }> = [];

  for (const faq of faqs) {
    let score = 0;
    const faqLower = (faq.question + " " + faq.answer + " " + faq.category).toLowerCase();

    for (const keyword of keywords) {
      if (faqLower.includes(keyword.replace(/_/g, " "))) {
        score += 3;
      }
      if (faq.category === "first_home_buyers" && keyword === "first_home_buyer") score += 5;
      if (faq.category === "investment" && keyword === "investor") score += 5;
      if (faq.category === "retirement_living" && keyword === "retirement") score += 5;
      if (faq.category === "display_village" && keyword === "display_village") score += 5;
      if (faq.category === "pricing" && keyword === "has_budget") score += 3;
    }

    if (score > 0) {
      scored.push({ faq, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.faq);
}

function retrieveRelevantTemplates(keywords: string[], platform: string): KBResponseTemplate[] {
  const templates = knowledgeBase.responseTemplates as unknown as KBResponseTemplate[];
  const scored: Array<{ template: KBResponseTemplate; score: number }> = [];

  for (const template of templates) {
    let score = 0;

    if (template.platform === platform || template.platform === "any") {
      score += 2;
    }

    for (const keyword of keywords) {
      if (keyword === "first_home_buyer" && template.category === "first_home_buyer") score += 5;
      if (keyword === "investor" && template.category === "investor") score += 5;
      if (keyword === "family" && template.category === "family_home") score += 5;
      if (keyword === "retirement" && template.category === "retirement_living") score += 5;
      if (keyword === "display_village" && template.category === "display_village") score += 5;
      if (keyword === "land" && template.category === "land") score += 5;
    }

    if (score > 0) {
      scored.push({ template, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.template);
}

function retrieveRelevantGrants(communities: KBCommunity[], keywords: string[]): KBGrant[] {
  if (!keywords.includes("first_home_buyer") && !keywords.includes("grants")) {
    return [];
  }

  const grants: KBGrant[] = [];
  for (const community of communities) {
    if (community.grants) {
      for (const grant of community.grants) {
        grants.push(grant);
      }
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return grants.filter((g) => {
    if (seen.has(g.name)) return false;
    seen.add(g.name);
    return true;
  });
}

function retrieveContext(message: string, platform: string, additionalKeywords: string[] = []): RetrievedContext {
  const keywords = [...extractKeywords(message), ...additionalKeywords];
  const budgetRange = extractBudgetRange(message);
  const bedroomCount = extractBedroomCount(message);

  const communities = retrieveRelevantCommunities(keywords);
  const listings = retrieveRelevantListings(communities, keywords, budgetRange, bedroomCount);
  const faqs = retrieveRelevantFAQs(keywords);
  const templates = retrieveRelevantTemplates(keywords, platform);
  const grants = retrieveRelevantGrants(communities, keywords);

  // Calculate relevance score based on how much context we found
  let relevanceScore = 0;
  if (communities.length > 0) relevanceScore += 0.3;
  if (listings.length > 0) relevanceScore += 0.3;
  if (faqs.length > 0) relevanceScore += 0.2;
  if (templates.length > 0) relevanceScore += 0.1;
  if (grants.length > 0) relevanceScore += 0.1;

  return {
    communities,
    listings,
    faqs,
    templates,
    grants,
    relevanceScore,
  };
}

// Prompt construction

function buildContextSection(context: RetrievedContext): string {
  const sections: string[] = [];

  if (context.communities.length > 0) {
    sections.push("## Relevant Communities");
    for (const community of context.communities) {
      sections.push(`### ${community.name} — ${community.location}`);
      sections.push(community.description);
      if (community.displayVillage) {
        sections.push(`Display Village: ${community.displayVillage.address}, Open: ${community.displayVillage.openHours}, ${community.displayVillage.displayHomes} display homes.`);
      }
      if (community.investorInfo) {
        sections.push(`Investor Info: Rental yield ${community.investorInfo.expectedRentalYield}, Vacancy rate ${community.investorInfo.vacancyRate}, ${community.investorInfo.capitalGrowth}`);
      }
      if (community.retirementLivingInfo) {
        sections.push(`Retirement Living: ${community.retirementLivingInfo.ageRequirement}. Pets: ${community.retirementLivingInfo.petsAllowed ? "Yes" : "No"}. ${community.retirementLivingInfo.waitlist}`);
      }
    }
  }

  if (context.listings.length > 0) {
    sections.push("\n## Relevant Listings");
    for (const listing of context.listings) {
      const price = listing.priceFrom && listing.priceTo
        ? `$${listing.priceFrom.toLocaleString()} - $${listing.priceTo.toLocaleString()}`
        : "Price on application";
      const beds = listing.bedrooms ? `${listing.bedrooms} bed` : "";
      const baths = listing.bathrooms ? `, ${listing.bathrooms} bath` : "";
      const garageStr = listing.garage ? `, ${listing.garage} garage` : "";
      const land = listing.landSize ? `, Land: ${listing.landSize}` : "";
      sections.push(`- ${listing.name} (${listing.type}): ${beds}${baths}${garageStr}${land}. Price: ${price}. Availability: ${listing.availability ?? "unknown"}.`);
      if (listing.features && listing.features.length > 0) {
        sections.push(`  Features: ${listing.features.join(", ")}`);
      }
      if (listing.estimatedCompletion) {
        sections.push(`  Estimated completion: ${listing.estimatedCompletion}`);
      }
    }
  }

  if (context.faqs.length > 0) {
    sections.push("\n## Relevant FAQs");
    for (const faq of context.faqs) {
      sections.push(`Q: ${faq.question}`);
      sections.push(`A: ${faq.answer}`);
    }
  }

  if (context.grants.length > 0) {
    sections.push("\n## Available Grants");
    for (const grant of context.grants) {
      const amount = grant.amount ? `$${grant.amount.toLocaleString()}` : "Varies";
      sections.push(`- ${grant.name}: ${amount}. ${grant.eligibility}. ${grant.details}`);
    }
  }

  if (context.templates.length > 0) {
    sections.push("\n## Response Style Templates (for tone reference only)");
    for (const template of context.templates) {
      sections.push(`- ${template.name} (${template.tone}): ${template.template}`);
    }
  }

  return sections.join("\n");
}

function buildSystemPrompt(): string {
  const brandGuidelines = knowledgeBase.brandGuidelines;

  return `You are a helpful social media customer service assistant for Stockland, one of Australia's leading property developers. Your role is to draft friendly, professional responses to customer DMs on social media (Instagram and Facebook).

## Brand Voice
${brandGuidelines.tone.description}

## Do:
${brandGuidelines.tone.doList.map((item) => `- ${item}`).join("\n")}

## Don't:
${brandGuidelines.tone.dontList.map((item) => `- ${item}`).join("\n")}

## Compliance Rules:
- Never request or store sensitive personal information via social media DMs
- Do not provide financial advice — recommend customers seek independent financial advice
- Prices are subject to change and availability
- Grant eligibility is subject to government criteria
- Rental yield projections are estimates only

## Response Guidelines:
- Keep responses under 1500 characters for social media
- Use 1-2 emojis maximum per message (appropriate to platform)
- Always include a clear call to action (e.g., visit display village, book a tour, call us)
- Personalise the response using the customer's name
- Address all questions raised in the customer's message
- Reference specific listings, prices, and features from the knowledge base when available
- Be accurate — only mention details that are in the provided context
- If you don't have specific information, offer to connect the customer with the sales team`;
}

function buildUserPrompt(
  senderName: string,
  senderHandle: string,
  platform: string,
  sanitizedMessage: string,
  contextSection: string
): string {
  return `Please draft a response to the following customer DM.

## Customer Details
- Name: ${senderName}
- Handle: ${senderHandle}
- Platform: ${platform}

## Customer Message
${sanitizedMessage}

## Knowledge Base Context
${contextSection}

## Instructions
Draft a warm, helpful response that:
1. Greets the customer by name
2. Addresses their specific questions and needs
3. References relevant listings, prices, and features from the knowledge base
4. Includes relevant grant information if applicable
5. Ends with a clear call to action
6. Stays under 1500 characters
7. Uses appropriate tone for ${platform} (slightly more casual for Instagram, slightly more professional for Facebook)

Respond with ONLY the draft message text. Do not include any meta-commentary, labels, or explanations.`;
}

// Confidence score calculation

function calculateConfidenceScore(
  context: RetrievedContext,
  draftContent: string,
  messageLength: number
): number {
  let score = 0.5; // Base score

  // Context relevance contributes up to 0.3
  score += context.relevanceScore * 0.3;

  // Listing match quality
  if (context.listings.length >= 3) {
    score += 0.05;
  } else if (context.listings.length >= 1) {
    score += 0.03;
  }

  // FAQ match quality
  if (context.faqs.length >= 2) {
    score += 0.03;
  }

  // Grant information included when relevant
  if (context.grants.length > 0) {
    score += 0.02;
  }

  // Draft quality heuristics
  if (draftContent.length >= 200 && draftContent.length <= 1500) {
    score += 0.03;
  }

  // Check if draft mentions specific details from context
  const draftLower = draftContent.toLowerCase();
  let detailMatches = 0;

  for (const community of context.communities) {
    if (draftLower.includes(community.name.toLowerCase())) {
      detailMatches++;
    }
  }

  for (const listing of context.listings) {
    if (draftLower.includes(listing.name.toLowerCase())) {
      detailMatches++;
    }
    if (listing.priceFrom && draftLower.includes(listing.priceFrom.toLocaleString())) {
      detailMatches++;
    }
  }

  score += Math.min(detailMatches * 0.02, 0.1);

  // Penalize very short messages (less context to work with)
  if (messageLength < 50) {
    score -= 0.05;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

// Fallback draft generation (template-based)

function generateFallbackDraft(
  senderName: string,
  platform: string,
  context: RetrievedContext
): DraftGenerationResult {
  const greeting = platform === "instagram"
    ? `Hi ${senderName}! 👋 Thanks so much for reaching out to us.`
    : `Hi ${senderName}! Thanks for getting in touch with us.`;

  const parts: string[] = [greeting];

  if (context.communities.length > 0) {
    const community = context.communities[0];
    parts.push(`\nWe'd love to help you explore what's available at ${community.name} in ${community.location}.`);

    if (context.listings.length > 0) {
      const listing = context.listings[0];
      const price = listing.priceFrom && listing.priceTo
        ? `from $${listing.priceFrom.toLocaleString()} to $${listing.priceTo.toLocaleString()}`
        : "";
      parts.push(`We have some great options including our ${listing.name}${price ? ` ${price}` : ""}.`);
    }

    if (community.displayVillage) {
      parts.push(`\nI'd recommend visiting our display village at ${community.displayVillage.address} (open ${community.displayVillage.openHours}) to see the homes in person.`);
    }
  } else {
    parts.push("\nWe have a range of communities and homes that might be perfect for you.");
    parts.push("I'd love to learn more about what you're looking for so I can point you in the right direction.");
  }

  if (context.grants.length > 0) {
    const grant = context.grants[0];
    if (grant.amount) {
      parts.push(`\nYou may also be eligible for the ${grant.name} of $${grant.amount.toLocaleString()}.`);
    }
  }

  parts.push("\nWould you like to chat more about your options? I'm here to help! 😊");

  const content = parts.join(" ").replace(/\s+/g, " ").replace(/ \n /g, "\n\n").trim();

  return {
    content,
    confidenceScore: Math.max(0.5, context.relevanceScore * 0.6 + 0.3),
    tokensUsed: 0,
  };
}

// Azure OpenAI call

async function callAzureOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const { apiKey, endpoint, deploymentName } = azureOpenAIConfig;

  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-01`;

  const body = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 800,
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0.3,
    presence_penalty: 0.1,
  };

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        // Rate limited — wait and retry
        const retryAfter = parseInt(response.headers.get("retry-after") ?? "5", 10);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens: number };
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Azure OpenAI returned empty response.");
      }

      const tokensUsed = data.usage?.total_tokens ?? 0;

      return { content: content.trim(), tokensUsed };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("Azure OpenAI call failed after retries.");
}

/**
 * Generate an AI-powered draft response for a DM.
 *
 * Uses a RAG pipeline:
 * 1. Retrieves relevant knowledge base entries based on DM content
 * 2. Sanitizes DM content (redacts PII) before sending to LLM
 * 3. Constructs a prompt with context and brand guidelines
 * 4. Generates a draft response via Azure OpenAI
 * 5. Validates the draft for compliance
 * 6. Calculates a confidence score based on knowledge base match quality
 * 7. Persists the draft and updates DM status
 *
 * Falls back to template-based generation if Azure OpenAI is unavailable.
 */
export async function generateDraft(params: GenerateDraftParams): Promise<DraftGenerationResult & { draftId: string }> {
  const { dmId, knowledgeContext = [], forceRegenerate = false } = params;

  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required.");
  }

  // Fetch the DM
  const dm = await prisma.dM.findUnique({
    where: { id: dmId },
    include: {
      drafts: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!dm) {
    throw new Error(`DM not found: ${dmId}.`);
  }

  // Check for existing draft unless force regenerate
  if (!forceRegenerate && dm.drafts.length > 0) {
    const existingDraft = dm.drafts[0];
    return {
      draftId: existingDraft.id,
      content: existingDraft.content,
      confidenceScore: existingDraft.confidenceScore,
      tokensUsed: 0,
    };
  }

  // PII check on the original message
  const piiResult = checkTextForPII(dm.message);
  if (piiResult.hasPII) {
    await logPIIDetected("dm", dm.id, piiResult.detectedTypes);
  }

  // Sanitize message for LLM (redact PII)
  const sanitizedMessage = sanitizeForLLM(dm.message);

  // Retrieve relevant context from knowledge base
  const context = retrieveContext(sanitizedMessage, dm.platform, knowledgeContext);
  const contextSection = buildContextSection(context);

  let draftContent: string;
  let tokensUsed: number;
  let usedLLM = false;

  // Attempt Azure OpenAI generation
  if (azureOpenAIConfig.isConfigured) {
    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(
        dm.senderName,
        dm.senderHandle,
        dm.platform,
        sanitizedMessage,
        contextSection
      );

      const result = await callAzureOpenAI(systemPrompt, userPrompt);
      draftContent = result.content;
      tokensUsed = result.tokensUsed;
      usedLLM = true;
    } catch (error) {
      console.error("❌ Azure OpenAI generation failed, falling back to template:", error instanceof Error ? error.message : String(error));
      const fallback = generateFallbackDraft(dm.senderName, dm.platform, context);
      draftContent = fallback.content;
      tokensUsed = fallback.tokensUsed;
    }
  } else {
    // Azure OpenAI not configured — use fallback
    const fallback = generateFallbackDraft(dm.senderName, dm.platform, context);
    draftContent = fallback.content;
    tokensUsed = fallback.tokensUsed;
  }

  // Validate draft compliance (no PII in output)
  const complianceResult = validateDraftCompliance(draftContent);
  if (!complianceResult.isCompliant) {
    // If PII detected in draft, redact it
    if (complianceResult.piiCheck.hasPII) {
      draftContent = complianceResult.piiCheck.sanitizedContent;
    }
  }

  // Calculate confidence score
  const confidenceScore = usedLLM
    ? calculateConfidenceScore(context, draftContent, dm.message.length)
    : Math.max(CONFIDENCE_THRESHOLD_LOW - 0.1, calculateConfidenceScore(context, draftContent, dm.message.length) * 0.8);

  // Persist the draft
  const draft = await prisma.draft.create({
    data: {
      dmId: dm.id,
      content: draftContent,
      confidenceScore,
      isEdited: false,
      status: "pending",
    },
  });

  // Log draft generation
  await logDraftGenerated(draft.id, dm.id, confidenceScore);

  // Update DM status to "drafted" if currently "new"
  if (dm.status === "new") {
    try {
      await updateDMStatus({
        dmId: dm.id,
        newStatus: "drafted",
        changedBy: "system",
        details: `AI draft generated with confidence ${(confidenceScore * 100).toFixed(1)}%.`,
      });
    } catch (error) {
      // Status update failure should not block draft generation
      console.error("⚠️ Failed to update DM status to drafted:", error instanceof Error ? error.message : String(error));
    }
  }

  return {
    draftId: draft.id,
    content: draftContent,
    confidenceScore,
    tokensUsed,
  };
}

/**
 * Regenerate a draft for a DM, forcing a new generation even if one exists.
 */
export async function regenerateDraft(dmId: string, knowledgeContext: string[] = []): Promise<DraftGenerationResult & { draftId: string }> {
  return generateDraft({
    dmId,
    knowledgeContext,
    forceRegenerate: true,
  });
}

/**
 * Generate drafts for multiple DMs in batch.
 * Processes each DM individually, collecting results and errors.
 */
export async function generateDraftBatch(
  dmIds: string[],
  knowledgeContext: string[] = []
): Promise<{
  generated: Array<DraftGenerationResult & { draftId: string; dmId: string }>;
  errors: Array<{ dmId: string; error: string }>;
}> {
  const generated: Array<DraftGenerationResult & { draftId: string; dmId: string }> = [];
  const errors: Array<{ dmId: string; error: string }> = [];

  for (const dmId of dmIds) {
    try {
      const result = await generateDraft({ dmId, knowledgeContext });
      generated.push({ ...result, dmId });
    } catch (error) {
      errors.push({
        dmId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { generated, errors };
}

/**
 * Get the retrieved knowledge base context for a DM message.
 * Useful for debugging and transparency.
 */
export function getRetrievedContext(message: string, platform: string, additionalKeywords: string[] = []): RetrievedContext {
  return retrieveContext(message, platform, additionalKeywords);
}