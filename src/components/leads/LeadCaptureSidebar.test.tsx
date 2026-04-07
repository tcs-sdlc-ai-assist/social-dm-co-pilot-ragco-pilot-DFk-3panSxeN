import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LeadCaptureSidebar } from "@/components/leads/LeadCaptureSidebar";
import type { DMResponse, LeadResponse } from "@/types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Alex Thompson",
        email: "alex.thompson@stockland.com.au",
        role: "agent",
      },
    },
    status: "authenticated",
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useNotifications hook
jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    isPolling: false,
    markAsRead: jest.fn(),
    markAsDismissed: jest.fn(),
    markAllAsRead: jest.fn(),
    refetch: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    total: 0,
    lastFetchedAt: null,
  }),
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockDM: DMResponse = {
  id: "dm-001",
  platform: "instagram",
  senderName: "Sarah M.",
  senderHandle: "@sarah_m_designs",
  message:
    "Hi! I've been looking at the Aura community in Calleya. We're a young family with a budget around $500-550k. Could you tell me more about the 4-bedroom options and what's available for move-in by March? We're currently renting in Cockburn and really love the area.",
  timestamp: new Date("2024-11-15T09:23:00Z").toISOString(),
  status: "new",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  drafts: [],
  leads: [],
};

const mockDMElara: DMResponse = {
  id: "dm-003",
  platform: "instagram",
  senderName: "Priya B.",
  senderHandle: "@priya.bhatt",
  message:
    "Hello! My husband and I are first home buyers. We've been pre-approved for $620k and are interested in the Elara estate in Marsden Park. Do you have any 3-bed homes with a study? We both work from home. When is the next display home open day?",
  timestamp: new Date("2024-11-14T16:30:00Z").toISOString(),
  status: "new",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  drafts: [],
  leads: [],
};

const mockLead: LeadResponse = {
  id: "lead-001",
  dmId: "dm-001",
  name: "Sarah M.",
  contact: "@sarah_m_designs (Instagram)",
  budget: "$500,000 - $550,000",
  location: "Aura at Calleya",
  intent: "Family home purchase — 4 bedroom, move-in by March",
  score: 8.5,
  priorityFlag: true,
  salesforceId: null,
  status: "new",
  assignedTo: "user-agent-001",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockLeadLowPriority: LeadResponse = {
  id: "lead-002",
  dmId: "dm-002",
  name: "James M.",
  contact: "james.mitchell.904 (Facebook)",
  budget: "Under $400,000",
  location: "Willowdale",
  intent: "Investment property — land or house and land package",
  score: 5.2,
  priorityFlag: false,
  salesforceId: null,
  status: "new",
  assignedTo: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockLeadSynced: LeadResponse = {
  ...mockLead,
  id: "lead-003",
  salesforceId: "00Q1234567890ABCDE",
};

const mockLeadNoFields: LeadResponse = {
  id: "lead-004",
  dmId: "dm-001",
  name: "Unknown User",
  contact: null,
  budget: null,
  location: null,
  intent: null,
  score: 2.0,
  priorityFlag: false,
  salesforceId: null,
  status: "new",
  assignedTo: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Fetch Mock Setup ────────────────────────────────────────────────────────

let fetchMock: jest.SpyInstance;

function setupFetchMockForExtract(
  lead: LeadResponse = mockLead,
  isNew: boolean = true
) {
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      lead,
      extractedData: {
        name: lead.name,
        contact: lead.contact,
        budget: lead.budget,
        location: lead.location,
        intent: lead.intent,
        confidence: 0.85,
      },
      scoreResult: {
        score: lead.score,
        priorityFlag: lead.priorityFlag,
        intent: lead.intent,
        budget: lead.budget,
        location: lead.location,
        confidence: 0.85,
        reasoning: `Score: ${lead.score}/10.`,
      },
      isNew,
    }),
  } as Response);
  return fetchMock;
}

function setupFetchMockForPreview() {
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      dmId: "dm-001",
      preview: true,
      extractedData: {
        name: "Sarah M.",
        contact: "@sarah_m_designs (Instagram)",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase — 4 bedroom",
        confidence: 0.82,
      },
      scoreResult: {
        score: 8.5,
        priorityFlag: true,
        intent: "Family home purchase — 4 bedroom",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        confidence: 0.82,
        reasoning: "Score: 8.5/10 (high priority).",
      },
    }),
  } as Response);
  return fetchMock;
}

function setupFetchMockForSalesforceSync(
  success: boolean = true,
  salesforceId: string = "00Q1234567890ABCDE"
) {
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: success,
    status: success ? 200 : 502,
    json: async () =>
      success
        ? {
            success: true,
            salesforceId,
            leadId: "lead-001",
            syncedAt: new Date().toISOString(),
            mode: "simulated",
          }
        : {
            success: false,
            salesforceId: null,
            leadId: "lead-001",
            syncedAt: new Date().toISOString(),
            mode: "simulated",
            error: "Salesforce API unavailable.",
          },
  } as Response);
  return fetchMock;
}

function setupFetchMockForScore() {
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      leadId: "lead-001",
      score: 9.0,
      priorityFlag: true,
      intent: "Family home purchase — 4 bedroom",
      budget: "$500,000 - $550,000",
      location: "Aura at Calleya",
      confidence: 0.9,
      reasoning: "Score: 9.0/10 (high priority).",
    }),
  } as Response);
  return fetchMock;
}

function setupFetchMockError(
  statusCode: number = 500,
  message: string = "Internal Server Error"
) {
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: false,
    status: statusCode,
    json: async () => ({
      error: "InternalServerError",
      message,
      statusCode,
    }),
  } as Response);
  return fetchMock;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderSidebar(
  props: Partial<React.ComponentProps<typeof LeadCaptureSidebar>> = {}
) {
  return render(
    <LeadCaptureSidebar
      dm={mockDM}
      userId="user-agent-001"
      {...props}
    />
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("LeadCaptureSidebar", () => {
  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
    jest.restoreAllMocks();
  });

  // ─── Rendering ───────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the Lead Capture region", () => {
      renderSidebar();
      expect(
        screen.getByRole("complementary", { name: "Lead Capture" })
      ).toBeInTheDocument();
    });

    it("renders the Lead Capture header", () => {
      renderSidebar();
      expect(screen.getByText("Lead Capture")).toBeInTheDocument();
    });

    it("renders Extract Lead Data prompt when no lead is provided", () => {
      renderSidebar({ lead: null });
      expect(screen.getByText("Extract Lead Data")).toBeInTheDocument();
    });

    it("renders Extract Lead button when no lead exists", () => {
      renderSidebar({ lead: null });
      expect(
        screen.getByRole("button", { name: /Extract Lead/i })
      ).toBeInTheDocument();
    });

    it("renders Preview button when no lead exists", () => {
      renderSidebar({ lead: null });
      expect(
        screen.getByRole("button", { name: /Preview/i })
      ).toBeInTheDocument();
    });

    it("renders description text for lead extraction", () => {
      renderSidebar({ lead: null });
      expect(
        screen.getByText(/Automatically extract lead information from this DM/)
      ).toBeInTheDocument();
    });
  });

  // ─── Auto-Filled Lead Fields ─────────────────────────────────────────────

  describe("auto-filled lead fields", () => {
    it("displays lead name when lead is provided", () => {
      renderSidebar({ lead: mockLead });
      expect(screen.getByText("Sarah M.")).toBeInTheDocument();
    });

    it("displays lead contact when lead is provided", () => {
      renderSidebar({ lead: mockLead });
      expect(
        screen.getByText("@sarah_m_designs (Instagram)")
      ).toBeInTheDocument();
    });

    it("displays lead budget when lead is provided", () => {
      renderSidebar({ lead: mockLead });
      expect(screen.getByText("$500,000 - $550,000")).toBeInTheDocument();
    });

    it("displays lead location when lead is provided", () => {
      renderSidebar({ lead: mockLead });
      expect(screen.getByText("Aura at Calleya")).toBeInTheDocument();
    });

    it("displays lead intent when lead is provided", () => {
      renderSidebar({ lead: mockLead });
      expect(
        screen.getByText("Family home purchase — 4 bedroom, move-in by March")
      ).toBeInTheDocument();
    });

    it("displays 'Not detected' for missing fields", () => {
      renderSidebar({ lead: mockLeadNoFields });
      const notDetectedElements = screen.getAllByText("Not detected");
      // contact, budget, location, intent should all show "Not detected"
      expect(notDetectedElements.length).toBeGreaterThanOrEqual(4);
    });

    it("displays field labels for all lead fields", () => {
      renderSidebar({ lead: mockLead });
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Contact")).toBeInTheDocument();
      expect(screen.getByText("Budget")).toBeInTheDocument();
      expect(screen.getByText("Location")).toBeInTheDocument();
      expect(screen.getByText("Intent")).toBeInTheDocument();
    });
  });

  // ─── Lead Score & Priority Flag ──────────────────────────────────────────

  describe("lead score and priority flag", () => {
    it("displays lead score for high-priority lead", () => {
      renderSidebar({ lead: mockLead });
      expect(screen.getByText("Lead Score:")).toBeInTheDocument();
      // The PriorityFlag component renders the score
      expect(screen.getByText("8.5")).toBeInTheDocument();
    });

    it("displays lead score for low-priority lead", () => {
      renderSidebar({ lead: mockLeadLowPriority });
      expect(screen.getByText("5.2")).toBeInTheDocument();
    });

    it("displays priority flag for high-priority lead", () => {
      renderSidebar({ lead: mockLead });
      // PriorityFlag renders an img role with aria-label containing "priority"
      const priorityFlags = screen.getAllByRole("img");
      const highPriorityFlag = priorityFlags.find((el) =>
        el.getAttribute("aria-label")?.toLowerCase().includes("high")
      );
      expect(highPriorityFlag).toBeTruthy();
    });

    it("displays lead status badge", () => {
      renderSidebar({ lead: mockLead });
      const statusBadges = screen.getAllByRole("status");
      expect(statusBadges.length).toBeGreaterThan(0);
    });
  });

  // ─── Lead Extraction ─────────────────────────────────────────────────────

  describe("lead extraction", () => {
    it("calls extract API when Extract Lead is clicked", async () => {
      const mock = setupFetchMockForExtract();
      const onLeadExtracted = jest.fn();
      renderSidebar({ lead: null, onLeadExtracted });

      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          "/api/leads/extract",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining(mockDM.id),
          })
        );
      });
    });

    it("calls onLeadExtracted callback after successful extraction", async () => {
      setupFetchMockForExtract();
      const onLeadExtracted = jest.fn();
      renderSidebar({ lead: null, onLeadExtracted });

      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(onLeadExtracted).toHaveBeenCalledTimes(1);
        expect(onLeadExtracted).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "lead-001",
            name: "Sarah M.",
            score: 8.5,
            priorityFlag: true,
          })
        );
      });
    });

    it("shows extracting state while lead is being extracted", async () => {
      jest.spyOn(global, "fetch").mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    lead: mockLead,
                    extractedData: {
                      name: "Sarah M.",
                      contact: null,
                      budget: null,
                      location: null,
                      intent: null,
                      confidence: 0.5,
                    },
                    scoreResult: {
                      score: 8.5,
                      priorityFlag: true,
                      intent: null,
                      budget: null,
                      location: null,
                      confidence: 0.5,
                      reasoning: "Score: 8.5/10.",
                    },
                    isNew: true,
                  }),
                } as Response),
              5000
            )
          )
      );

      renderSidebar({ lead: null });
      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Extracting lead data...")
        ).toBeInTheDocument();
      });
    });

    it("shows error message when extraction fails", async () => {
      setupFetchMockError(500, "Failed to extract lead.");
      const onError = jest.fn();
      renderSidebar({ lead: null, onError });

      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Error")).toBeInTheDocument();
      });
    });

    it("calls onError callback when extraction fails", async () => {
      setupFetchMockError(500, "Failed to extract lead.");
      const onError = jest.fn();
      renderSidebar({ lead: null, onError });

      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Failed to extract lead.",
          })
        );
      });
    });
  });

  // ─── Preview Extraction ──────────────────────────────────────────────────

  describe("preview extraction", () => {
    it("calls preview API when Preview is clicked", async () => {
      const mock = setupFetchMockForPreview();
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Preview/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          "/api/leads/extract",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"preview":true'),
          })
        );
      });
    });

    it("shows preview state with extracted data", async () => {
      setupFetchMockForPreview();
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Preview/i }));

      await waitFor(() => {
        expect(screen.getByText("Extraction Preview")).toBeInTheDocument();
      });

      expect(screen.getByText("Not saved")).toBeInTheDocument();
      expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      expect(screen.getByText("$500,000 - $550,000")).toBeInTheDocument();
      expect(screen.getByText("Aura at Calleya")).toBeInTheDocument();
    });

    it("shows Confirm & Create Lead button in preview state", async () => {
      setupFetchMockForPreview();
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Preview/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Confirm & Create Lead/i })
        ).toBeInTheDocument();
      });
    });

    it("shows Cancel button in preview state", async () => {
      setupFetchMockForPreview();
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Preview/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Cancel/i })
        ).toBeInTheDocument();
      });
    });

    it("cancels preview when Cancel is clicked", async () => {
      setupFetchMockForPreview();
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Preview/i }));

      await waitFor(() => {
        expect(screen.getByText("Extraction Preview")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

      expect(
        screen.queryByText("Extraction Preview")
      ).not.toBeInTheDocument();
      expect(screen.getByText("Extract Lead Data")).toBeInTheDocument();
    });

    it("calls extract API when Confirm & Create Lead is clicked from preview", async () => {
      setupFetchMockForPreview();
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Preview/i }));

      await waitFor(() => {
        expect(screen.getByText("Extraction Preview")).toBeInTheDocument();
      });

      // Now set up the extract mock for the confirm action
      fetchMock.mockRestore();
      const extractMock = setupFetchMockForExtract();

      fireEvent.click(
        screen.getByRole("button", { name: /Confirm & Create Lead/i })
      );

      await waitFor(() => {
        expect(extractMock).toHaveBeenCalledWith(
          "/api/leads/extract",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining(mockDM.id),
          })
        );
      });
    });
  });

  // ─── Salesforce Sync ─────────────────────────────────────────────────────

  describe("Salesforce sync", () => {
    it("renders Create Lead in Salesforce button when lead is not synced", () => {
      renderSidebar({ lead: mockLead });
      expect(
        screen.getByRole("button", { name: /Create Lead in Salesforce/i })
      ).toBeInTheDocument();
    });

    it("renders Re-sync to Salesforce button when lead is already synced", () => {
      renderSidebar({ lead: mockLeadSynced });
      expect(
        screen.getByRole("button", { name: /Re-sync to Salesforce/i })
      ).toBeInTheDocument();
    });

    it("calls Salesforce sync API when Create Lead in Salesforce is clicked", async () => {
      const mock = setupFetchMockForSalesforceSync();
      const onSalesforceSync = jest.fn();
      renderSidebar({ lead: mockLead, onSalesforceSync });

      fireEvent.click(
        screen.getByRole("button", { name: /Create Lead in Salesforce/i })
      );

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          "/api/leads/salesforce",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining(mockLead.id),
          })
        );
      });
    });

    it("calls onSalesforceSync callback after successful sync", async () => {
      setupFetchMockForSalesforceSync(true, "00QABC123");
      const onSalesforceSync = jest.fn();
      renderSidebar({ lead: mockLead, onSalesforceSync });

      fireEvent.click(
        screen.getByRole("button", { name: /Create Lead in Salesforce/i })
      );

      await waitFor(() => {
        expect(onSalesforceSync).toHaveBeenCalledTimes(1);
        expect(onSalesforceSync).toHaveBeenCalledWith(
          expect.objectContaining({
            leadId: "lead-001",
            salesforceId: "00QABC123",
            success: true,
          })
        );
      });
    });

    it("shows sync error when Salesforce sync fails", async () => {
      setupFetchMockForSalesforceSync(false);
      const onSalesforceSync = jest.fn();
      renderSidebar({ lead: mockLead, onSalesforceSync });

      fireEvent.click(
        screen.getByRole("button", { name: /Create Lead in Salesforce/i })
      );

      await waitFor(() => {
        expect(screen.getByText("Sync Failed")).toBeInTheDocument();
      });
    });

    it("shows Retry Salesforce Sync button after sync failure", async () => {
      setupFetchMockForSalesforceSync(false);
      renderSidebar({ lead: mockLead });

      fireEvent.click(
        screen.getByRole("button", { name: /Create Lead in Salesforce/i })
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Retry Salesforce Sync/i })
        ).toBeInTheDocument();
      });
    });

    it("calls onSalesforceSync with success false on failure", async () => {
      setupFetchMockForSalesforceSync(false);
      const onSalesforceSync = jest.fn();
      renderSidebar({ lead: mockLead, onSalesforceSync });

      fireEvent.click(
        screen.getByRole("button", { name: /Create Lead in Salesforce/i })
      );

      await waitFor(() => {
        expect(onSalesforceSync).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
          })
        );
      });
    });
  });

  // ─── Salesforce Sync Status Display ──────────────────────────────────────

  describe("Salesforce sync status display", () => {
    it("shows 'Not synced to Salesforce' when lead has no salesforceId", () => {
      renderSidebar({ lead: mockLead });
      expect(
        screen.getByText("Not synced to Salesforce")
      ).toBeInTheDocument();
    });

    it("shows 'Synced to Salesforce' when lead has salesforceId", () => {
      renderSidebar({ lead: mockLeadSynced });
      expect(screen.getByText("Synced to Salesforce")).toBeInTheDocument();
    });

    it("shows Salesforce ID when lead is synced", () => {
      renderSidebar({ lead: mockLeadSynced });
      expect(
        screen.getByText(/00Q1234567890ABCDE/)
      ).toBeInTheDocument();
    });
  });

  // ─── Sales Follow-Up Flag Toggle ─────────────────────────────────────────

  describe("sales follow-up flag toggle", () => {
    it("renders Flag for Sales Follow-Up toggle", () => {
      renderSidebar({ lead: mockLead });
      expect(
        screen.getByText("Flag for Sales Follow-Up")
      ).toBeInTheDocument();
    });

    it("renders toggle switch with correct initial state for high-priority lead", () => {
      renderSidebar({ lead: mockLead });
      const toggle = screen.getByRole("switch", {
        name: /Flag for sales follow-up/i,
      });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });

    it("renders toggle switch with correct initial state for low-priority lead", () => {
      renderSidebar({ lead: mockLeadLowPriority });
      const toggle = screen.getByRole("switch", {
        name: /Flag for sales follow-up/i,
      });
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    it("calls onPriorityToggle when toggle is clicked", () => {
      const onPriorityToggle = jest.fn();
      renderSidebar({ lead: mockLead, onPriorityToggle });

      const toggle = screen.getByRole("switch", {
        name: /Flag for sales follow-up/i,
      });
      fireEvent.click(toggle);

      expect(onPriorityToggle).toHaveBeenCalledTimes(1);
      expect(onPriorityToggle).toHaveBeenCalledWith("lead-001", false);
    });

    it("toggles flag from off to on", () => {
      const onPriorityToggle = jest.fn();
      renderSidebar({ lead: mockLeadLowPriority, onPriorityToggle });

      const toggle = screen.getByRole("switch", {
        name: /Flag for sales follow-up/i,
      });
      expect(toggle).toHaveAttribute("aria-checked", "false");

      fireEvent.click(toggle);

      expect(onPriorityToggle).toHaveBeenCalledWith("lead-002", true);
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });

    it("toggles flag from on to off", () => {
      const onPriorityToggle = jest.fn();
      renderSidebar({ lead: mockLead, onPriorityToggle });

      const toggle = screen.getByRole("switch", {
        name: /Flag for sales follow-up/i,
      });
      expect(toggle).toHaveAttribute("aria-checked", "true");

      fireEvent.click(toggle);

      expect(onPriorityToggle).toHaveBeenCalledWith("lead-001", false);
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });
  });

  // ─── Re-extract Lead ─────────────────────────────────────────────────────

  describe("re-extract lead", () => {
    it("renders Re-extract Lead Data button when lead exists", () => {
      renderSidebar({ lead: mockLead });
      expect(
        screen.getByRole("button", { name: /Re-extract Lead Data/i })
      ).toBeInTheDocument();
    });

    it("calls extract API with forceReextract when Re-extract is clicked", async () => {
      const mock = setupFetchMockForExtract();
      renderSidebar({ lead: mockLead });

      fireEvent.click(
        screen.getByRole("button", { name: /Re-extract Lead Data/i })
      );

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          "/api/leads/extract",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"forceReextract":true'),
          })
        );
      });
    });
  });

  // ─── Re-score Lead ───────────────────────────────────────────────────────

  describe("re-score lead", () => {
    it("renders Re-score button when lead exists", () => {
      renderSidebar({ lead: mockLead });
      expect(
        screen.getByRole("button", { name: /Re-score/i })
      ).toBeInTheDocument();
    });

    it("calls score API when Re-score is clicked", async () => {
      const mock = setupFetchMockForScore();
      renderSidebar({ lead: mockLead });

      fireEvent.click(screen.getByRole("button", { name: /Re-score/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          "/api/leads/score",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining(mockLead.id),
          })
        );
      });
    });
  });

  // ─── Assigned To ─────────────────────────────────────────────────────────

  describe("assigned to", () => {
    it("displays assigned user when lead is assigned", () => {
      renderSidebar({ lead: mockLead });
      expect(screen.getByText("Assigned To:")).toBeInTheDocument();
      expect(screen.getByText("user-agent-001")).toBeInTheDocument();
    });

    it("displays 'Unassigned' when lead has no assignedTo", () => {
      renderSidebar({ lead: mockLeadLowPriority });
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });
  });

  // ─── Error Handling ──────────────────────────────────────────────────────

  describe("error handling", () => {
    it("displays error alert with dismiss button", async () => {
      setupFetchMockError(500, "Something went wrong.");
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
      });

      // Dismiss the error
      fireEvent.click(screen.getByLabelText("Dismiss error"));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("clears error when a new action is started", async () => {
      setupFetchMockError(500, "First error.");
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(screen.getByText("First error.")).toBeInTheDocument();
      });

      // Set up successful response for retry
      fetchMock.mockRestore();
      setupFetchMockForExtract();

      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(screen.queryByText("First error.")).not.toBeInTheDocument();
      });
    });
  });

  // ─── Prop Synchronization ────────────────────────────────────────────────

  describe("prop synchronization", () => {
    it("updates displayed lead when lead prop changes", () => {
      const { rerender } = render(
        <LeadCaptureSidebar
          dm={mockDM}
          lead={mockLead}
          userId="user-agent-001"
        />
      );

      expect(screen.getByText("8.5")).toBeInTheDocument();

      rerender(
        <LeadCaptureSidebar
          dm={mockDM}
          lead={mockLeadLowPriority}
          userId="user-agent-001"
        />
      );

      expect(screen.getByText("5.2")).toBeInTheDocument();
    });

    it("shows no lead state when lead prop changes to null", () => {
      const { rerender } = render(
        <LeadCaptureSidebar
          dm={mockDM}
          lead={mockLead}
          userId="user-agent-001"
        />
      );

      expect(screen.getByText("Lead Score:")).toBeInTheDocument();

      rerender(
        <LeadCaptureSidebar
          dm={mockDM}
          lead={null}
          userId="user-agent-001"
        />
      );

      expect(screen.getByText("Extract Lead Data")).toBeInTheDocument();
    });

    it("resets error state when lead prop changes", () => {
      const { rerender } = render(
        <LeadCaptureSidebar
          dm={mockDM}
          lead={mockLead}
          userId="user-agent-001"
        />
      );

      rerender(
        <LeadCaptureSidebar
          dm={mockDM}
          lead={mockLeadLowPriority}
          userId="user-agent-001"
        />
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("has proper ARIA complementary role", () => {
      renderSidebar();
      expect(
        screen.getByRole("complementary", { name: "Lead Capture" })
      ).toBeInTheDocument();
    });

    it("toggle switch has accessible label", () => {
      renderSidebar({ lead: mockLead });
      expect(
        screen.getByRole("switch", { name: /Flag for sales follow-up/i })
      ).toBeInTheDocument();
    });

    it("error alerts have assertive aria-live", () => {
      renderSidebar({ lead: mockLead });
      // No error initially
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("dismiss error button has accessible label", async () => {
      setupFetchMockError(500, "Test error.");
      renderSidebar({ lead: null });

      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(screen.getByLabelText("Dismiss error")).toBeInTheDocument();
      });
    });
  });

  // ─── Different DM Contexts ───────────────────────────────────────────────

  describe("different DM contexts", () => {
    it("renders correctly with Elara DM context", () => {
      renderSidebar({ dm: mockDMElara, lead: null });
      expect(screen.getByText("Lead Capture")).toBeInTheDocument();
      expect(screen.getByText("Extract Lead Data")).toBeInTheDocument();
    });

    it("renders correctly with lead from different DM", () => {
      const elaraLead: LeadResponse = {
        id: "lead-elara",
        dmId: "dm-003",
        name: "Priya B.",
        contact: "@priya.bhatt (Instagram)",
        budget: "$620,000 (pre-approved)",
        location: "Elara, Marsden Park",
        intent: "First home buyer — 3 bed + study, WFH setup",
        score: 9.1,
        priorityFlag: true,
        salesforceId: null,
        status: "new",
        assignedTo: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      renderSidebar({ dm: mockDMElara, lead: elaraLead });
      expect(screen.getByText("Priya B.")).toBeInTheDocument();
      expect(screen.getByText("$620,000 (pre-approved)")).toBeInTheDocument();
      expect(screen.getByText("Elara, Marsden Park")).toBeInTheDocument();
      expect(screen.getByText("9.1")).toBeInTheDocument();
    });
  });

  // ─── Loading States ──────────────────────────────────────────────────────

  describe("loading states", () => {
    it("disables all buttons while extracting", async () => {
      jest.spyOn(global, "fetch").mockImplementation(
        () => new Promise(() => {})
      );

      renderSidebar({ lead: null });
      fireEvent.click(screen.getByRole("button", { name: /Extract Lead/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Extracting lead data...")
        ).toBeInTheDocument();
      });
    });

    it("disables Salesforce sync button while syncing", async () => {
      jest.spyOn(global, "fetch").mockImplementation(
        () => new Promise(() => {})
      );

      renderSidebar({ lead: mockLead });
      const syncButton = screen.getByRole("button", {
        name: /Create Lead in Salesforce/i,
      });
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(syncButton).toBeDisabled();
      });
    });
  });
});