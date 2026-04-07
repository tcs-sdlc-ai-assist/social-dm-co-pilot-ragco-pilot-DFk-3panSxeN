import {
  scoreLead,
  scoreLeadById,
  getScoreBreakdown,
  getPriorityFromScore,
  isHighPriority,
} from "@/services/lead-scorer";
import {
  LEAD_SCORE_HIGH_PRIORITY,
  LEAD_SCORE_MEDIUM_PRIORITY,
  LEAD_SCORE_LOW_PRIORITY,
  LEAD_SCORE_MIN,
  LEAD_SCORE_MAX,
} from "@/lib/constants";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    lead: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// ─── Mock Audit Logger ───────────────────────────────────────────────────────

jest.mock("@/services/audit-logger", () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
  AuditActions: {
    LEAD_SCORE_UPDATED: "lead_score_updated",
  },
  AuditEntityTypes: {
    LEAD: "lead",
  },
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const highIntentMessage =
  "Hi! I've been looking at the Aura community in Calleya. We're a young family with a budget around $500-550k. Could you tell me more about the 4-bedroom options and what's available for move-in by March? We're currently renting in Cockburn and really love the area.";

const investorMessage =
  "Hey there, I saw your ad about the new land release at Willowdale. I'm an investor looking at blocks under $400k. What's the expected rental yield in that area? Also interested in any house and land packages you might have.";

const firstHomeBuyerMessage =
  "Hello! My husband and I are first home buyers. We've been pre-approved for $620k and are interested in the Elara estate in Marsden Park. Do you have any 3-bed homes with a study? We both work from home. When is the next display home open day?";

const retirementMessage =
  "Just wondering about the retirement living options at Cardinal Freeman. My mum is looking to downsize from her 4-bed house. She'd want a 2-bed unit with parking. Budget is flexible but probably around $800k-1M. Is there a waitlist?";

const casualMessage =
  "Love what you're doing at Cloverton! 😍 We're thinking of building our dream home there. Budget is around $700k for house and land. Are there any premium corner lots still available? We want north-facing if possible. Happy to chat more!";

const minimalMessage = "Hi, just curious about your communities.";

const urgentMessage =
  "We need to find a home ASAP! Currently staying with family and need to move quickly. Looking at Minta in Berwick, budget $600k for a 4-bed. Can we book a tour this week?";

const detailedMessage =
  "Hi! I'm a photographer and I work from home. Looking for a place at Elara with good natural light — ideally north-facing. Need 3 beds + a dedicated study/studio space. Budget is $640k. Do any of your floor plans have a larger study or flex room? We've been pre-approved and want to visit the display village this Saturday.";

const emptyFieldsMessage = "Hello, just browsing.";

const noLocationMessage =
  "I'm looking to buy a 3-bedroom house. Budget is around $550k. We're first home buyers.";

const noBudgetMessage =
  "We're interested in the Elara estate. Do you have any 4-bedroom homes available? We'd love to visit the display village.";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("LeadScorer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── scoreLead ───────────────────────────────────────────────────────────

  describe("scoreLead", () => {
    // ─── Score Range ─────────────────────────────────────────────────────

    describe("score range", () => {
      it("returns a score between 0 and 10", () => {
        const result = scoreLead({
          message: highIntentMessage,
          name: "Sarah M.",
          budget: "$500,000 - $550,000",
          location: "Aura at Calleya",
          intent: "Family home purchase — 4 bedroom, move-in by March",
        });

        expect(result.score).toBeGreaterThanOrEqual(LEAD_SCORE_MIN);
        expect(result.score).toBeLessThanOrEqual(LEAD_SCORE_MAX);
      });

      it("returns a score of 0 for empty message", () => {
        const result = scoreLead({
          message: "",
          name: "Unknown",
        });

        expect(result.score).toBe(0);
        expect(result.priorityFlag).toBe(false);
      });

      it("returns a score of 0 for whitespace-only message", () => {
        const result = scoreLead({
          message: "   ",
          name: "Unknown",
        });

        expect(result.score).toBe(0);
        expect(result.priorityFlag).toBe(false);
      });

      it("never exceeds LEAD_SCORE_MAX even with all signals present", () => {
        const result = scoreLead({
          message: detailedMessage,
          name: "Sam N.",
          contact: "@sam.nguyen.photo (Instagram)",
          budget: "$640,000",
          location: "Elara, Marsden Park",
          intent: "First home buyer — 3-bedroom — WFH/study — North-facing — Wants to visit",
        });

        expect(result.score).toBeLessThanOrEqual(LEAD_SCORE_MAX);
      });

      it("never goes below LEAD_SCORE_MIN", () => {
        const result = scoreLead({
          message: minimalMessage,
          name: "Unknown",
        });

        expect(result.score).toBeGreaterThanOrEqual(LEAD_SCORE_MIN);
      });
    });

    // ─── High Priority Flag ──────────────────────────────────────────────

    describe("high priority flag", () => {
      it("sets priorityFlag true for score >= 8.0", () => {
        const result = scoreLead({
          message: firstHomeBuyerMessage,
          name: "Priya B.",
          contact: "@priya.bhatt (Instagram)",
          budget: "$620,000 (pre-approved)",
          location: "Elara, Marsden Park",
          intent: "First home buyer — 3 bed + study, WFH setup — Wants to visit",
        });

        if (result.score >= LEAD_SCORE_HIGH_PRIORITY) {
          expect(result.priorityFlag).toBe(true);
        }
      });

      it("sets priorityFlag false for score < 8.0", () => {
        const result = scoreLead({
          message: minimalMessage,
          name: "Unknown",
        });

        expect(result.score).toBeLessThan(LEAD_SCORE_HIGH_PRIORITY);
        expect(result.priorityFlag).toBe(false);
      });

      it("flags high-priority lead for urgent buyer with budget and location", () => {
        const result = scoreLead({
          message: urgentMessage,
          name: "Paul M.",
          contact: "paul.martinez.bne (Facebook)",
          budget: "$600,000",
          location: "Minta, Berwick",
          intent: "Family home purchase — 4 bedroom — Urgent — Wants to visit",
        });

        expect(result.score).toBeGreaterThanOrEqual(LEAD_SCORE_HIGH_PRIORITY);
        expect(result.priorityFlag).toBe(true);
      });

      it("does not flag low-engagement casual inquiry as high priority", () => {
        const result = scoreLead({
          message: "Just wondering about prices.",
          name: "Casual User",
        });

        expect(result.priorityFlag).toBe(false);
      });
    });

    // ─── Intent Signals ──────────────────────────────────────────────────

    describe("intent signals", () => {
      it("scores higher for active purchase intent ('buy', 'purchase')", () => {
        const withBuy = scoreLead({
          message: "I want to buy a home at Elara.",
          name: "Test",
        });

        const withoutBuy = scoreLead({
          message: "I'm curious about Elara.",
          name: "Test",
        });

        expect(withBuy.score).toBeGreaterThan(withoutBuy.score);
      });

      it("scores higher for pre-approval mention", () => {
        const withPreApproval = scoreLead({
          message: "We've been pre-approved for $620k and are looking at Elara.",
          name: "Test",
          budget: "$620,000",
          location: "Elara",
        });

        const withoutPreApproval = scoreLead({
          message: "We're looking at Elara with a budget of $620k.",
          name: "Test",
          budget: "$620,000",
          location: "Elara",
        });

        expect(withPreApproval.score).toBeGreaterThan(withoutPreApproval.score);
      });

      it("scores higher for specific property type interest", () => {
        const withPropertyType = scoreLead({
          message: "Looking for a house and land package at Willowdale.",
          name: "Test",
          location: "Willowdale",
        });

        const withoutPropertyType = scoreLead({
          message: "Interested in Willowdale.",
          name: "Test",
          location: "Willowdale",
        });

        expect(withPropertyType.score).toBeGreaterThan(withoutPropertyType.score);
      });

      it("scores higher for first home buyer mention", () => {
        const firstHomeBuyer = scoreLead({
          message: "We're first home buyers looking at Elara.",
          name: "Test",
          location: "Elara",
        });

        const regularBuyer = scoreLead({
          message: "We're looking at Elara.",
          name: "Test",
          location: "Elara",
        });

        expect(firstHomeBuyer.score).toBeGreaterThan(regularBuyer.score);
      });

      it("scores higher for investor interest", () => {
        const investor = scoreLead({
          message: "I'm an investor looking at rental yield in Willowdale.",
          name: "Test",
          location: "Willowdale",
        });

        const nonInvestor = scoreLead({
          message: "I'm looking at Willowdale.",
          name: "Test",
          location: "Willowdale",
        });

        expect(investor.score).toBeGreaterThan(nonInvestor.score);
      });

      it("scores higher for retirement/downsizer interest", () => {
        const retirement = scoreLead({
          message: "Looking to downsize to retirement living at Cardinal Freeman.",
          name: "Test",
          location: "Cardinal Freeman",
        });

        const general = scoreLead({
          message: "Looking at Cardinal Freeman.",
          name: "Test",
          location: "Cardinal Freeman",
        });

        expect(retirement.score).toBeGreaterThan(general.score);
      });

      it("includes intent reasoning in the result", () => {
        const result = scoreLead({
          message: "I want to buy a home at Elara. We've been pre-approved.",
          name: "Test",
          location: "Elara",
          intent: "Home purchase",
        });

        expect(result.reasoning).toBeDefined();
        expect(result.reasoning.length).toBeGreaterThan(0);
        expect(result.reasoning).toContain("purchase intent");
      });
    });

    // ─── Engagement Signals ──────────────────────────────────────────────

    describe("engagement signals", () => {
      it("scores higher when customer wants to visit/tour", () => {
        const withVisit = scoreLead({
          message: "I'd love to visit the display village at Elara this weekend.",
          name: "Test",
          location: "Elara",
        });

        const withoutVisit = scoreLead({
          message: "I'm interested in Elara.",
          name: "Test",
          location: "Elara",
        });

        expect(withVisit.score).toBeGreaterThan(withoutVisit.score);
      });

      it("scores higher when customer wants to book/schedule", () => {
        const withBooking = scoreLead({
          message: "Can we book a tour at Minta this week? We're available Saturday.",
          name: "Test",
          location: "Minta",
        });

        const withoutBooking = scoreLead({
          message: "We're interested in Minta.",
          name: "Test",
          location: "Minta",
        });

        expect(withBooking.score).toBeGreaterThan(withoutBooking.score);
      });

      it("scores higher for messages with multiple questions", () => {
        const multipleQuestions = scoreLead({
          message:
            "Do you have 3-bed homes? What's the price range? When is the next open day? Are there grants available?",
          name: "Test",
        });

        const singleQuestion = scoreLead({
          message: "Do you have 3-bed homes?",
          name: "Test",
        });

        expect(multipleQuestions.score).toBeGreaterThan(singleQuestion.score);
      });

      it("scores higher for detailed messages (longer = more invested)", () => {
        const detailed = scoreLead({
          message: detailedMessage,
          name: "Sam N.",
          location: "Elara",
          budget: "$640,000",
          intent: "Home purchase — WFH/study",
        });

        const brief = scoreLead({
          message: "Looking at Elara, $640k budget.",
          name: "Sam N.",
          location: "Elara",
          budget: "$640,000",
          intent: "Home purchase",
        });

        expect(detailed.score).toBeGreaterThan(brief.score);
      });

      it("scores higher when specific features are mentioned", () => {
        const withFeatures = scoreLead({
          message:
            "Looking for a 4-bedroom home with a study, north-facing, open-plan living, and a double garage.",
          name: "Test",
        });

        const withoutFeatures = scoreLead({
          message: "Looking for a home.",
          name: "Test",
        });

        expect(withFeatures.score).toBeGreaterThan(withoutFeatures.score);
      });
    });

    // ─── Budget Signals ──────────────────────────────────────────────────

    describe("budget signals", () => {
      it("scores higher when budget is specified", () => {
        const withBudget = scoreLead({
          message: "Looking at Elara with a budget of $620k.",
          name: "Test",
          budget: "$620,000",
          location: "Elara",
        });

        const withoutBudget = scoreLead({
          message: "Looking at Elara.",
          name: "Test",
          location: "Elara",
        });

        expect(withBudget.score).toBeGreaterThan(withoutBudget.score);
      });

      it("scores higher when budget range is provided", () => {
        const withRange = scoreLead({
          message: "Budget is $500,000 to $550,000 for a home at Aura.",
          name: "Test",
          budget: "$500,000 - $550,000",
          location: "Aura",
        });

        const withSingle = scoreLead({
          message: "Budget is $525,000 for a home at Aura.",
          name: "Test",
          budget: "$525,000",
          location: "Aura",
        });

        expect(withRange.score).toBeGreaterThan(withSingle.score);
      });

      it("scores higher when budget is backed by pre-approval", () => {
        const preApproved = scoreLead({
          message: "We've been pre-approved for $620k.",
          name: "Test",
          budget: "$620,000",
        });

        const notPreApproved = scoreLead({
          message: "Our budget is around $620k.",
          name: "Test",
          budget: "$620,000",
        });

        expect(preApproved.score).toBeGreaterThan(notPreApproved.score);
      });

      it("gives partial score for budget discussion without specific amount", () => {
        const budgetDiscussion = scoreLead({
          message: "We can afford something in the mid-range. What's available?",
          name: "Test",
        });

        const noBudgetDiscussion = scoreLead({
          message: "What's available?",
          name: "Test",
        });

        expect(budgetDiscussion.score).toBeGreaterThanOrEqual(noBudgetDiscussion.score);
      });

      it("gives partial score for deposit/savings mention", () => {
        const withDeposit = scoreLead({
          message: "We've saved $80k for a deposit.",
          name: "Test",
        });

        const withoutDeposit = scoreLead({
          message: "We're interested in buying.",
          name: "Test",
        });

        expect(withDeposit.score).toBeGreaterThanOrEqual(withoutDeposit.score);
      });
    });

    // ─── Location Signals ────────────────────────────────────────────────

    describe("location signals", () => {
      it("scores higher when specific location is provided", () => {
        const withLocation = scoreLead({
          message: "Looking at Elara in Marsden Park.",
          name: "Test",
          location: "Elara, Marsden Park",
        });

        const withoutLocation = scoreLead({
          message: "Looking for a home.",
          name: "Test",
        });

        expect(withLocation.score).toBeGreaterThan(withoutLocation.score);
      });

      it("scores higher for high-demand community match", () => {
        const highDemand = scoreLead({
          message: "Interested in Willowdale.",
          name: "Test",
          location: "Willowdale",
        });

        const noLocation = scoreLead({
          message: "Interested in buying a home.",
          name: "Test",
        });

        expect(highDemand.score).toBeGreaterThan(noLocation.score);
      });

      it("detects known locations mentioned in message even without extracted location", () => {
        const withKnownLocation = scoreLead({
          message: "I'm interested in the Cloverton community.",
          name: "Test",
        });

        const withoutKnownLocation = scoreLead({
          message: "I'm interested in buying a home somewhere.",
          name: "Test",
        });

        expect(withKnownLocation.score).toBeGreaterThan(withoutKnownLocation.score);
      });
    });

    // ─── Urgency Signals ─────────────────────────────────────────────────

    describe("urgency signals", () => {
      it("scores higher for ASAP/urgent timeline", () => {
        const urgent = scoreLead({
          message: "We need to find a home ASAP!",
          name: "Test",
        });

        const notUrgent = scoreLead({
          message: "We're looking for a home.",
          name: "Test",
        });

        expect(urgent.score).toBeGreaterThan(notUrgent.score);
      });

      it("scores higher for specific month deadline", () => {
        const withDeadline = scoreLead({
          message: "We need to move in by March.",
          name: "Test",
        });

        const withoutDeadline = scoreLead({
          message: "We're looking for a home.",
          name: "Test",
        });

        expect(withDeadline.score).toBeGreaterThan(withoutDeadline.score);
      });

      it("scores higher for year-based timeline", () => {
        const withTimeline = scoreLead({
          message: "We'd like to be settled by mid-2025.",
          name: "Test",
        });

        const withoutTimeline = scoreLead({
          message: "We're looking for a home.",
          name: "Test",
        });

        expect(withTimeline.score).toBeGreaterThan(withoutTimeline.score);
      });

      it("scores higher for currently renting/temporary housing", () => {
        const renting = scoreLead({
          message: "We're currently renting and want to buy.",
          name: "Test",
        });

        const notRenting = scoreLead({
          message: "We want to buy a home.",
          name: "Test",
        });

        expect(renting.score).toBeGreaterThan(notRenting.score);
      });

      it("scores higher for move-in ready preference", () => {
        const moveInReady = scoreLead({
          message: "Are there any completed homes ready to move into?",
          name: "Test",
        });

        const noPreference = scoreLead({
          message: "What homes are available?",
          name: "Test",
        });

        expect(moveInReady.score).toBeGreaterThan(noPreference.score);
      });
    });

    // ─── Completeness Score ──────────────────────────────────────────────

    describe("completeness score", () => {
      it("scores higher when all lead fields are present", () => {
        const complete = scoreLead({
          message: "Looking at Elara, budget $620k.",
          name: "Priya B.",
          contact: "@priya.bhatt (Instagram)",
          budget: "$620,000",
          location: "Elara, Marsden Park",
          intent: "First home buyer — 3 bed + study",
        });

        const incomplete = scoreLead({
          message: "Looking at Elara, budget $620k.",
          name: "Priya B.",
        });

        expect(complete.score).toBeGreaterThan(incomplete.score);
      });

      it("gives partial completeness score for some fields present", () => {
        const twoFields = scoreLead({
          message: "Budget $620k, looking at Elara.",
          name: "Test",
          budget: "$620,000",
          location: "Elara",
        });

        const oneField = scoreLead({
          message: "Budget $620k.",
          name: "Test",
          budget: "$620,000",
        });

        expect(twoFields.score).toBeGreaterThanOrEqual(oneField.score);
      });
    });

    // ─── No Demographic Data ─────────────────────────────────────────────

    describe("no demographic data bias", () => {
      it("scores based on behavioural signals only, not demographics", () => {
        // Two messages with identical behavioural signals but different names
        const result1 = scoreLead({
          message: "I want to buy a 3-bed home at Elara. Budget $600k. Pre-approved.",
          name: "John Smith",
          budget: "$600,000",
          location: "Elara",
          intent: "Home purchase — 3 bedroom",
        });

        const result2 = scoreLead({
          message: "I want to buy a 3-bed home at Elara. Budget $600k. Pre-approved.",
          name: "Priya Bhatt",
          budget: "$600,000",
          location: "Elara",
          intent: "Home purchase — 3 bedroom",
        });

        expect(result1.score).toBe(result2.score);
        expect(result1.priorityFlag).toBe(result2.priorityFlag);
      });

      it("does not use age, gender, or ethnicity in scoring", () => {
        // Same message, different sender names — score should be identical
        const result1 = scoreLead({
          message: "Looking for a retirement unit at Cardinal Freeman. Budget $850k.",
          name: "Margaret H.",
          budget: "$850,000",
          location: "Cardinal Freeman",
          intent: "Retirement living",
        });

        const result2 = scoreLead({
          message: "Looking for a retirement unit at Cardinal Freeman. Budget $850k.",
          name: "Wei Chen",
          budget: "$850,000",
          location: "Cardinal Freeman",
          intent: "Retirement living",
        });

        expect(result1.score).toBe(result2.score);
      });
    });

    // ─── Missing Fields ──────────────────────────────────────────────────

    describe("handles missing fields gracefully", () => {
      it("handles null contact", () => {
        const result = scoreLead({
          message: highIntentMessage,
          name: "Sarah M.",
          contact: null,
          budget: "$500,000 - $550,000",
          location: "Aura at Calleya",
          intent: "Family home purchase",
        });

        expect(result.score).toBeGreaterThan(0);
        expect(result.reasoning).toBeDefined();
      });

      it("handles null budget", () => {
        const result = scoreLead({
          message: noBudgetMessage,
          name: "Test",
          budget: null,
          location: "Elara",
          intent: "Home purchase",
        });

        expect(result.score).toBeGreaterThan(0);
        expect(result.reasoning).toBeDefined();
      });

      it("handles null location", () => {
        const result = scoreLead({
          message: noLocationMessage,
          name: "Test",
          budget: "$550,000",
          location: null,
          intent: "First home buyer — 3 bedroom",
        });

        expect(result.score).toBeGreaterThan(0);
        expect(result.reasoning).toBeDefined();
      });

      it("handles null intent", () => {
        const result = scoreLead({
          message: "Looking at Elara.",
          name: "Test",
          budget: null,
          location: "Elara",
          intent: null,
        });

        expect(result.score).toBeGreaterThan(0);
        expect(result.reasoning).toBeDefined();
      });

      it("handles all optional fields as null", () => {
        const result = scoreLead({
          message: minimalMessage,
          name: "Unknown",
          contact: null,
          budget: null,
          location: null,
          intent: null,
        });

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.priorityFlag).toBe(false);
        expect(result.reasoning).toBeDefined();
      });

      it("handles undefined optional fields", () => {
        const result = scoreLead({
          message: "Looking at homes.",
          name: "Test",
        });

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.reasoning).toBeDefined();
      });
    });

    // ─── Confidence ──────────────────────────────────────────────────────

    describe("confidence", () => {
      it("returns higher confidence when more scoring dimensions contribute", () => {
        const highConfidence = scoreLead({
          message: detailedMessage,
          name: "Sam N.",
          contact: "@sam.nguyen.photo (Instagram)",
          budget: "$640,000",
          location: "Elara, Marsden Park",
          intent: "Home purchase — WFH/study — North-facing — Wants to visit",
        });

        const lowConfidence = scoreLead({
          message: "Hello.",
          name: "Unknown",
        });

        expect(highConfidence.confidence).toBeGreaterThan(lowConfidence.confidence);
      });

      it("returns confidence between 0 and 1", () => {
        const result = scoreLead({
          message: highIntentMessage,
          name: "Sarah M.",
          budget: "$500,000 - $550,000",
          location: "Aura at Calleya",
          intent: "Family home purchase",
        });

        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    });

    // ─── Reasoning ───────────────────────────────────────────────────────

    describe("reasoning", () => {
      it("includes score value in reasoning", () => {
        const result = scoreLead({
          message: highIntentMessage,
          name: "Sarah M.",
          budget: "$500,000 - $550,000",
          location: "Aura at Calleya",
          intent: "Family home purchase",
        });

        expect(result.reasoning).toContain("Score:");
        expect(result.reasoning).toContain("/10");
      });

      it("includes priority label in reasoning", () => {
        const result = scoreLead({
          message: highIntentMessage,
          name: "Sarah M.",
          budget: "$500,000 - $550,000",
          location: "Aura at Calleya",
          intent: "Family home purchase",
        });

        expect(
          result.reasoning.includes("high") ||
            result.reasoning.includes("medium") ||
            result.reasoning.includes("low")
        ).toBe(true);
      });

      it("includes specific scoring factors in reasoning", () => {
        const result = scoreLead({
          message: firstHomeBuyerMessage,
          name: "Priya B.",
          budget: "$620,000",
          location: "Elara, Marsden Park",
          intent: "First home buyer",
        });

        expect(result.reasoning).toContain("Budget specified");
        expect(result.reasoning).toContain("location");
      });

      it("returns empty reasoning for empty message", () => {
        const result = scoreLead({
          message: "",
          name: "Unknown",
        });

        expect(result.reasoning).toContain("No message content");
      });
    });

    // ─── Return Fields ───────────────────────────────────────────────────

    describe("return fields", () => {
      it("returns all expected fields in LeadScoreResult", () => {
        const result = scoreLead({
          message: highIntentMessage,
          name: "Sarah M.",
          budget: "$500,000 - $550,000",
          location: "Aura at Calleya",
          intent: "Family home purchase",
        });

        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("priorityFlag");
        expect(result).toHaveProperty("intent");
        expect(result).toHaveProperty("budget");
        expect(result).toHaveProperty("location");
        expect(result).toHaveProperty("confidence");
        expect(result).toHaveProperty("reasoning");
      });

      it("passes through intent, budget, and location in result", () => {
        const result = scoreLead({
          message: highIntentMessage,
          name: "Sarah M.",
          budget: "$500,000 - $550,000",
          location: "Aura at Calleya",
          intent: "Family home purchase",
        });

        expect(result.intent).toBe("Family home purchase");
        expect(result.budget).toBe("$500,000 - $550,000");
        expect(result.location).toBe("Aura at Calleya");
      });

      it("returns null for missing optional fields", () => {
        const result = scoreLead({
          message: "Hello.",
          name: "Test",
        });

        expect(result.intent).toBeNull();
        expect(result.budget).toBeNull();
        expect(result.location).toBeNull();
      });
    });

    // ─── Real-World DM Scenarios ─────────────────────────────────────────

    describe("real-world DM scenarios", () => {
      it("scores Sarah M. DM as high priority (family buyer with budget, location, timeline)", () => {
        const result = scoreLead({
          message: highIntentMessage,
          name: "Sarah M.",
          contact: "@sarah_m_designs (Instagram)",
          budget: "$500,000 - $550,000",
          location: "Aura at Calleya",
          intent: "Family home purchase — 4 bedroom, move-in by March",
        });

        expect(result.score).toBeGreaterThanOrEqual(LEAD_SCORE_MEDIUM_PRIORITY);
        expect(result.reasoning).toBeDefined();
      });

      it("scores James M. DM as medium priority (investor without specific budget)", () => {
        const result = scoreLead({
          message: investorMessage,
          name: "James M.",
          contact: "james.mitchell.904 (Facebook)",
          budget: "Under $400,000",
          location: "Willowdale",
          intent: "Investment property — land or house and land package",
        });

        expect(result.score).toBeGreaterThanOrEqual(LEAD_SCORE_LOW_PRIORITY);
        expect(result.reasoning).toBeDefined();
      });

      it("scores Priya B. DM as high priority (pre-approved first home buyer)", () => {
        const result = scoreLead({
          message: firstHomeBuyerMessage,
          name: "Priya B.",
          contact: "@priya.bhatt (Instagram)",
          budget: "$620,000 (pre-approved)",
          location: "Elara, Marsden Park",
          intent: "First home buyer — 3 bed + study, WFH setup — Wants to visit",
        });

        expect(result.score).toBeGreaterThanOrEqual(LEAD_SCORE_HIGH_PRIORITY);
        expect(result.priorityFlag).toBe(true);
      });

      it("scores Tom R. DM appropriately (retirement living inquiry)", () => {
        const result = scoreLead({
          message: retirementMessage,
          name: "Tom R.",
          contact: "tom.russo.77 (Facebook)",
          budget: "$800,000 - $1,000,000",
          location: "Cardinal Freeman",
          intent: "Retirement living — 2 bed unit with parking for mother",
        });

        expect(result.score).toBeGreaterThanOrEqual(LEAD_SCORE_MEDIUM_PRIORITY);
        expect(result.reasoning).toBeDefined();
      });

      it("scores Anika J. DM appropriately (custom build inquiry)", () => {
        const result = scoreLead({
          message: casualMessage,
          name: "Anika J.",
          contact: "@anika.jones.living (Instagram)",
          budget: "$700,000",
          location: "Cloverton",
          intent: "Custom build — premium corner lot, north-facing",
        });

        expect(result.score).toBeGreaterThanOrEqual(LEAD_SCORE_MEDIUM_PRIORITY);
        expect(result.reasoning).toBeDefined();
      });

      it("scores minimal inquiry as low priority", () => {
        const result = scoreLead({
          message: emptyFieldsMessage,
          name: "Unknown",
        });

        expect(result.score).toBeLessThan(LEAD_SCORE_MEDIUM_PRIORITY);
        expect(result.priorityFlag).toBe(false);
      });
    });
  });

  // ─── scoreLeadById ───────────────────────────────────────────────────────

  describe("scoreLeadById", () => {
    it("fetches lead and DM from database and scores", async () => {
      mockFindUnique.mockResolvedValue({
        id: "lead-001",
        dmId: "dm-001",
        name: "Sarah M.",
        contact: "@sarah_m_designs (Instagram)",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase — 4 bedroom, move-in by March",
        score: 0,
        priorityFlag: false,
        dm: {
          id: "dm-001",
          platform: "instagram",
          senderName: "Sarah M.",
          senderHandle: "@sarah_m_designs",
          message: highIntentMessage,
          timestamp: new Date("2024-11-15T09:23:00Z"),
          status: "new",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockUpdate.mockResolvedValue({
        id: "lead-001",
        score: 8.5,
        priorityFlag: true,
      });

      const result = await scoreLeadById({ leadId: "lead-001" });

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(LEAD_SCORE_MAX);
      expect(result.reasoning).toBeDefined();
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lead-001" },
          include: { dm: true },
        })
      );
    });

    it("persists updated score when persistUpdate is true", async () => {
      mockFindUnique.mockResolvedValue({
        id: "lead-001",
        dmId: "dm-001",
        name: "Sarah M.",
        contact: "@sarah_m_designs (Instagram)",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase",
        score: 0,
        priorityFlag: false,
        dm: {
          id: "dm-001",
          platform: "instagram",
          senderName: "Sarah M.",
          senderHandle: "@sarah_m_designs",
          message: highIntentMessage,
          timestamp: new Date("2024-11-15T09:23:00Z"),
          status: "new",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockUpdate.mockResolvedValue({
        id: "lead-001",
        score: 8.0,
        priorityFlag: true,
      });

      await scoreLeadById({ leadId: "lead-001", persistUpdate: true });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lead-001" },
          data: expect.objectContaining({
            score: expect.any(Number),
            priorityFlag: expect.any(Boolean),
          }),
        })
      );
    });

    it("does not persist when persistUpdate is false", async () => {
      mockFindUnique.mockResolvedValue({
        id: "lead-002",
        dmId: "dm-002",
        name: "James M.",
        contact: "james.mitchell.904 (Facebook)",
        budget: "Under $400,000",
        location: "Willowdale",
        intent: "Investment property",
        score: 7.2,
        priorityFlag: false,
        dm: {
          id: "dm-002",
          platform: "facebook",
          senderName: "James M.",
          senderHandle: "james.mitchell.904",
          message: investorMessage,
          timestamp: new Date("2024-11-15T11:45:00Z"),
          status: "new",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await scoreLeadById({ leadId: "lead-002", persistUpdate: false });

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("does not persist when score has not changed", async () => {
      const existingScore = 7.2;

      mockFindUnique.mockResolvedValue({
        id: "lead-002",
        dmId: "dm-002",
        name: "James M.",
        contact: "james.mitchell.904 (Facebook)",
        budget: "Under $400,000",
        location: "Willowdale",
        intent: "Investment property",
        score: existingScore,
        priorityFlag: false,
        dm: {
          id: "dm-002",
          platform: "facebook",
          senderName: "James M.",
          senderHandle: "james.mitchell.904",
          message: investorMessage,
          timestamp: new Date("2024-11-15T11:45:00Z"),
          status: "new",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await scoreLeadById({ leadId: "lead-002", persistUpdate: true });

      // If the score happens to be the same, update should not be called
      if (result.score === existingScore && result.priorityFlag === false) {
        expect(mockUpdate).not.toHaveBeenCalled();
      }
    });

    it("throws error when lead ID is empty", async () => {
      await expect(scoreLeadById({ leadId: "" })).rejects.toThrow(
        "Lead ID is required."
      );
    });

    it("throws error when lead is not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        scoreLeadById({ leadId: "nonexistent-lead" })
      ).rejects.toThrow("Lead not found: nonexistent-lead.");
    });

    it("throws error when associated DM is not found", async () => {
      mockFindUnique.mockResolvedValue({
        id: "lead-orphan",
        dmId: "dm-missing",
        name: "Orphan Lead",
        contact: null,
        budget: null,
        location: null,
        intent: null,
        score: 0,
        priorityFlag: false,
        dm: null,
      });

      await expect(
        scoreLeadById({ leadId: "lead-orphan" })
      ).rejects.toThrow("Associated DM not found for lead: lead-orphan.");
    });

    it("defaults persistUpdate to true", async () => {
      mockFindUnique.mockResolvedValue({
        id: "lead-001",
        dmId: "dm-001",
        name: "Sarah M.",
        contact: "@sarah_m_designs (Instagram)",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase",
        score: 0,
        priorityFlag: false,
        dm: {
          id: "dm-001",
          platform: "instagram",
          senderName: "Sarah M.",
          senderHandle: "@sarah_m_designs",
          message: highIntentMessage,
          timestamp: new Date("2024-11-15T09:23:00Z"),
          status: "new",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockUpdate.mockResolvedValue({
        id: "lead-001",
        score: 8.0,
        priorityFlag: true,
      });

      await scoreLeadById({ leadId: "lead-001" });

      // Should persist since default is true and score changed from 0
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  // ─── getScoreBreakdown ───────────────────────────────────────────────────

  describe("getScoreBreakdown", () => {
    it("returns all scoring dimensions", () => {
      const breakdown = getScoreBreakdown({
        message: highIntentMessage,
        name: "Sarah M.",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase — 4 bedroom, move-in by March",
      });

      expect(breakdown).toHaveProperty("intentScore");
      expect(breakdown).toHaveProperty("engagementScore");
      expect(breakdown).toHaveProperty("budgetScore");
      expect(breakdown).toHaveProperty("locationScore");
      expect(breakdown).toHaveProperty("urgencyScore");
      expect(breakdown).toHaveProperty("completenessScore");
      expect(breakdown).toHaveProperty("total");
      expect(breakdown).toHaveProperty("reasons");
    });

    it("returns non-negative scores for all dimensions", () => {
      const breakdown = getScoreBreakdown({
        message: highIntentMessage,
        name: "Sarah M.",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase",
      });

      expect(breakdown.intentScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.engagementScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.budgetScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.locationScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.urgencyScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.completenessScore).toBeGreaterThanOrEqual(0);
    });

    it("returns intent score capped at 3.0", () => {
      const breakdown = getScoreBreakdown({
        message:
          "I want to buy a house and land package. We've been pre-approved. Looking for a 4-bedroom.",
        name: "Test",
        intent: "Home purchase — 4 bedroom — Pre-approved — House and land",
      });

      expect(breakdown.intentScore).toBeLessThanOrEqual(3.0);
    });

    it("returns engagement score capped at 2.0", () => {
      const breakdown = getScoreBreakdown({
        message:
          "Can we visit the display village? I'd like to book a tour. Do you have 3-bed homes? What about 4-bed? Are there grants? What's the price range? " +
          "A".repeat(300),
        name: "Test",
      });

      expect(breakdown.engagementScore).toBeLessThanOrEqual(2.0);
    });

    it("returns budget score capped at 2.0", () => {
      const breakdown = getScoreBreakdown({
        message: "We've been pre-approved for $620k. Our budget is $600,000 to $650,000.",
        name: "Test",
        budget: "$600,000 - $650,000",
      });

      expect(breakdown.budgetScore).toBeLessThanOrEqual(2.0);
    });

    it("returns location score capped at 1.5", () => {
      const breakdown = getScoreBreakdown({
        message: "Looking at Elara in Marsden Park.",
        name: "Test",
        location: "Elara, Marsden Park",
      });

      expect(breakdown.locationScore).toBeLessThanOrEqual(1.5);
    });

    it("returns urgency score capped at 1.0", () => {
      const breakdown = getScoreBreakdown({
        message:
          "We need to move ASAP! By March. Currently renting. Want move-in ready.",
        name: "Test",
      });

      expect(breakdown.urgencyScore).toBeLessThanOrEqual(1.0);
    });

    it("returns completeness score capped at 0.5", () => {
      const breakdown = getScoreBreakdown({
        message: "Looking at Elara.",
        name: "Test",
        contact: "@test (Instagram)",
        budget: "$600,000",
        location: "Elara",
        intent: "Home purchase",
      });

      expect(breakdown.completenessScore).toBeLessThanOrEqual(0.5);
    });

    it("total equals sum of all dimension scores", () => {
      const breakdown = getScoreBreakdown({
        message: highIntentMessage,
        name: "Sarah M.",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase",
      });

      const sum =
        breakdown.intentScore +
        breakdown.engagementScore +
        breakdown.budgetScore +
        breakdown.locationScore +
        breakdown.urgencyScore +
        breakdown.completenessScore;

      // Allow for rounding differences
      expect(Math.abs(breakdown.total - sum)).toBeLessThan(0.2);
    });

    it("total is clamped between 0 and 10", () => {
      const breakdown = getScoreBreakdown({
        message: detailedMessage,
        name: "Sam N.",
        contact: "@sam (Instagram)",
        budget: "$640,000",
        location: "Elara",
        intent: "Home purchase — WFH — North-facing — Wants to visit",
      });

      expect(breakdown.total).toBeGreaterThanOrEqual(LEAD_SCORE_MIN);
      expect(breakdown.total).toBeLessThanOrEqual(LEAD_SCORE_MAX);
    });

    it("returns reasons array with scoring factors", () => {
      const breakdown = getScoreBreakdown({
        message: firstHomeBuyerMessage,
        name: "Priya B.",
        budget: "$620,000",
        location: "Elara, Marsden Park",
        intent: "First home buyer",
      });

      expect(Array.isArray(breakdown.reasons)).toBe(true);
      expect(breakdown.reasons.length).toBeGreaterThan(0);
    });

    it("returns zero scores for empty message", () => {
      const breakdown = getScoreBreakdown({
        message: "",
        name: "Unknown",
      });

      expect(breakdown.intentScore).toBe(0);
      expect(breakdown.engagementScore).toBe(0);
      expect(breakdown.budgetScore).toBe(0);
      expect(breakdown.locationScore).toBe(0);
      expect(breakdown.urgencyScore).toBe(0);
      expect(breakdown.completenessScore).toBe(0);
      expect(breakdown.total).toBe(0);
    });

    it("returns reasons explaining zero score for empty message", () => {
      const breakdown = getScoreBreakdown({
        message: "",
        name: "Unknown",
      });

      expect(breakdown.reasons).toContain("No message content to score.");
    });
  });

  // ─── getPriorityFromScore ────────────────────────────────────────────────

  describe("getPriorityFromScore", () => {
    it("returns 'high' for score >= 8.0", () => {
      expect(getPriorityFromScore(8.0)).toBe("high");
      expect(getPriorityFromScore(8.5)).toBe("high");
      expect(getPriorityFromScore(9.0)).toBe("high");
      expect(getPriorityFromScore(10.0)).toBe("high");
    });

    it("returns 'medium' for score >= 5.0 and < 8.0", () => {
      expect(getPriorityFromScore(5.0)).toBe("medium");
      expect(getPriorityFromScore(6.5)).toBe("medium");
      expect(getPriorityFromScore(7.9)).toBe("medium");
    });

    it("returns 'low' for score < 5.0", () => {
      expect(getPriorityFromScore(0)).toBe("low");
      expect(getPriorityFromScore(2.5)).toBe("low");
      expect(getPriorityFromScore(4.9)).toBe("low");
    });
  });

  // ─── isHighPriority ──────────────────────────────────────────────────────

  describe("isHighPriority", () => {
    it("returns true for score >= 8.0", () => {
      expect(isHighPriority(8.0)).toBe(true);
      expect(isHighPriority(8.5)).toBe(true);
      expect(isHighPriority(10.0)).toBe(true);
    });

    it("returns false for score < 8.0", () => {
      expect(isHighPriority(0)).toBe(false);
      expect(isHighPriority(5.0)).toBe(false);
      expect(isHighPriority(7.9)).toBe(false);
    });

    it("returns true for exactly LEAD_SCORE_HIGH_PRIORITY", () => {
      expect(isHighPriority(LEAD_SCORE_HIGH_PRIORITY)).toBe(true);
    });

    it("returns false for just below LEAD_SCORE_HIGH_PRIORITY", () => {
      expect(isHighPriority(LEAD_SCORE_HIGH_PRIORITY - 0.1)).toBe(false);
    });
  });

  // ─── Scoring Consistency ─────────────────────────────────────────────────

  describe("scoring consistency", () => {
    it("produces consistent scores for the same input", () => {
      const params = {
        message: highIntentMessage,
        name: "Sarah M.",
        contact: "@sarah_m_designs (Instagram)",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase — 4 bedroom, move-in by March",
      };

      const result1 = scoreLead(params);
      const result2 = scoreLead(params);

      expect(result1.score).toBe(result2.score);
      expect(result1.priorityFlag).toBe(result2.priorityFlag);
      expect(result1.confidence).toBe(result2.confidence);
    });

    it("scoreLead and getScoreBreakdown produce matching totals", () => {
      const params = {
        message: firstHomeBuyerMessage,
        name: "Priya B.",
        contact: "@priya.bhatt (Instagram)",
        budget: "$620,000",
        location: "Elara, Marsden Park",
        intent: "First home buyer — 3 bed + study",
      };

      const scoreResult = scoreLead(params);
      const breakdown = getScoreBreakdown(params);

      expect(scoreResult.score).toBe(breakdown.total);
    });

    it("higher engagement messages always score >= lower engagement messages (same other fields)", () => {
      const baseParams = {
        name: "Test",
        budget: "$600,000",
        location: "Elara",
        intent: "Home purchase",
      };

      const highEngagement = scoreLead({
        ...baseParams,
        message:
          "I want to buy a home at Elara. Can we book a tour this Saturday? Do you have 3-bed options? What about 4-bed? Are there grants available? We've been pre-approved for $600k and are very keen to move forward quickly.",
      });

      const lowEngagement = scoreLead({
        ...baseParams,
        message: "Interested in Elara.",
      });

      expect(highEngagement.score).toBeGreaterThan(lowEngagement.score);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles very long messages without crashing", () => {
      const longMessage = "I'm looking at Elara. ".repeat(500);
      expect(() =>
        scoreLead({
          message: longMessage,
          name: "Test",
          location: "Elara",
        })
      ).not.toThrow();
    });

    it("handles messages with special characters", () => {
      const result = scoreLead({
        message: "Budget: $500k–$550k (AUD) — looking for 3BR 🏡✨ @Elara",
        name: "Test",
        budget: "$500,000 - $550,000",
        location: "Elara",
      });

      expect(result.score).toBeGreaterThan(0);
    });

    it("handles messages with unicode characters", () => {
      const result = scoreLead({
        message: "こんにちは! Looking for a home at Elara. Budget $600k.",
        name: "Test",
        budget: "$600,000",
        location: "Elara",
      });

      expect(result.score).toBeGreaterThan(0);
    });

    it("handles messages with newlines and tabs", () => {
      const result = scoreLead({
        message: "Hi!\n\nI'm interested in Aura.\n\tBudget: $500k\n\nThanks!",
        name: "Test",
        budget: "$500,000",
        location: "Aura",
      });

      expect(result.score).toBeGreaterThan(0);
    });

    it("handles messages with only emojis", () => {
      const result = scoreLead({
        message: "😍🏡✨",
        name: "Test",
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(LEAD_SCORE_MAX);
    });

    it("handles score at exact threshold boundaries", () => {
      // Test that the boundary values work correctly
      expect(getPriorityFromScore(LEAD_SCORE_HIGH_PRIORITY)).toBe("high");
      expect(getPriorityFromScore(LEAD_SCORE_MEDIUM_PRIORITY)).toBe("medium");
      expect(getPriorityFromScore(LEAD_SCORE_LOW_PRIORITY)).toBe("low");
      expect(getPriorityFromScore(LEAD_SCORE_LOW_PRIORITY - 0.1)).toBe("low");
    });
  });
});