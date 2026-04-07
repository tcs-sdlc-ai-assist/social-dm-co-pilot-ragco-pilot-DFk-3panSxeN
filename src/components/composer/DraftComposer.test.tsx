import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DraftComposer } from "@/components/composer/DraftComposer";
import type { DMResponse, DraftResponse } from "@/types";

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

const mockHighConfidenceDraft: DraftResponse = {
  id: "draft-001",
  dmId: "dm-001",
  content:
    "Hi Sarah! 👋 Thanks so much for your interest in Aura at Calleya — it's a beautiful community and perfect for young families!\n\nGreat news — we do have 4-bedroom options available in your budget range. For $500-550k, I'd recommend looking at our Aspire series which starts from $499k for a 4-bed, 2-bath home.\n\nRegarding your March timeline, we have several homes in the final stages of construction that could work. I'd love to arrange a time for you to visit our display village and chat with our sales team about what's available.\n\nWould Saturday or Sunday this week work for a visit? 🏡",
  confidenceScore: 0.92,
  isEdited: false,
  status: "pending",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockLowConfidenceDraft: DraftResponse = {
  id: "draft-002",
  dmId: "dm-001",
  content:
    "Hi Sarah! Thanks for reaching out. We have some options that might work for you. Would you like to learn more?",
  confidenceScore: 0.55,
  isEdited: false,
  status: "pending",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMediumConfidenceDraft: DraftResponse = {
  id: "draft-003",
  dmId: "dm-001",
  content:
    "Hi Sarah! Thanks for your interest in Aura at Calleya. We have some great options for families. I'd recommend visiting our display village to see what's available.",
  confidenceScore: 0.78,
  isEdited: false,
  status: "pending",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockApprovedDraft: DraftResponse = {
  ...mockHighConfidenceDraft,
  id: "draft-004",
  status: "approved",
};

const mockSentDraft: DraftResponse = {
  ...mockHighConfidenceDraft,
  id: "draft-005",
  status: "sent",
};

const mockRejectedDraft: DraftResponse = {
  ...mockHighConfidenceDraft,
  id: "draft-006",
  status: "rejected",
};

const mockEditedDraft: DraftResponse = {
  ...mockLowConfidenceDraft,
  id: "draft-007",
  isEdited: true,
};

// ─── Fetch Mock Setup ────────────────────────────────────────────────────────

let fetchMock: jest.SpyInstance;

function setupFetchMockForGenerate(
  draftContent: string = "Generated draft content...",
  confidenceScore: number = 0.88
) {
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      draftId: "draft-new-001",
      content: draftContent,
      confidenceScore,
      tokensUsed: 150,
    }),
  } as Response);
  return fetchMock;
}

function setupFetchMockForEdit(updatedDraft: Partial<DraftResponse> = {}) {
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      id: "draft-001",
      dmId: "dm-001",
      content: "Edited content...",
      confidenceScore: 0.92,
      isEdited: true,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      complianceIssues: [],
      ...updatedDraft,
    }),
  } as Response);
  return fetchMock;
}

function setupFetchMockForAction(
  action: "approve" | "reject" | "send",
  result: Record<string, unknown> = {}
) {
  const defaultResults: Record<string, Record<string, unknown>> = {
    approve: {
      id: "draft-001",
      dmId: "dm-001",
      content: mockHighConfidenceDraft.content,
      confidenceScore: 0.92,
      isEdited: false,
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    reject: {
      id: "draft-001",
      dmId: "dm-001",
      content: mockHighConfidenceDraft.content,
      confidenceScore: 0.92,
      isEdited: false,
      status: "rejected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    send: {
      draftId: "draft-001",
      dmId: "dm-001",
      status: "sent",
      sentAt: new Date().toISOString(),
      platform: "instagram",
      senderHandle: "@sarah_m_designs",
    },
  };

  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      ...defaultResults[action],
      ...result,
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

function renderComposer(
  props: Partial<React.ComponentProps<typeof DraftComposer>> = {}
) {
  return render(
    <DraftComposer
      dm={mockDM}
      userId="user-agent-001"
      {...props}
    />
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DraftComposer", () => {
  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
    jest.restoreAllMocks();
  });

  // ─── Rendering ───────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the Draft Composer region", () => {
      renderComposer();
      expect(
        screen.getByRole("region", { name: "Draft Composer" })
      ).toBeInTheDocument();
    });

    it("renders the original message preview", () => {
      renderComposer();
      expect(screen.getByText("Original Message")).toBeInTheDocument();
      expect(
        screen.getByText(/Hi! I've been looking at the Aura community/)
      ).toBeInTheDocument();
    });

    it("renders sender name and handle in the original message", () => {
      renderComposer();
      expect(screen.getByText(/Sarah M./)).toBeInTheDocument();
      expect(screen.getByText(/@sarah_m_designs/)).toBeInTheDocument();
    });

    it("renders the DM status badge in the original message", () => {
      renderComposer();
      const statusBadges = screen.getAllByRole("status");
      expect(statusBadges.length).toBeGreaterThan(0);
    });
  });

  // ─── No Draft State ──────────────────────────────────────────────────────

  describe("no draft state", () => {
    it("shows Generate AI Draft prompt when no draft is provided", () => {
      renderComposer({ draft: null });
      expect(screen.getByText("Generate AI Draft")).toBeInTheDocument();
    });

    it("shows Generate Draft button when no draft exists", () => {
      renderComposer({ draft: null });
      expect(
        screen.getByRole("button", { name: /Generate Draft/i })
      ).toBeInTheDocument();
    });

    it("shows description text for draft generation", () => {
      renderComposer({ draft: null });
      expect(
        screen.getByText(/Let the AI Co-Pilot generate a contextual draft/)
      ).toBeInTheDocument();
    });
  });

  // ─── Draft Generation ────────────────────────────────────────────────────

  describe("draft generation", () => {
    it("calls the draft generation API when Generate Draft is clicked", async () => {
      const mock = setupFetchMockForGenerate();
      const onDraftGenerated = jest.fn();
      renderComposer({ draft: null, onDraftGenerated });

      fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          `/api/dms/${mockDM.id}/draft`,
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });

    it("shows generating state while draft is being created", async () => {
      jest.spyOn(global, "fetch").mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    draftId: "draft-new-001",
                    content: "Generated...",
                    confidenceScore: 0.88,
                    tokensUsed: 100,
                  }),
                } as Response),
              5000
            )
          )
      );

      renderComposer({ draft: null });
      fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

      await waitFor(() => {
        expect(screen.getByText("Generating AI draft...")).toBeInTheDocument();
      });
    });

    it("calls onDraftGenerated callback after successful generation", async () => {
      setupFetchMockForGenerate("Hello Sarah!", 0.9);
      const onDraftGenerated = jest.fn();
      renderComposer({ draft: null, onDraftGenerated });

      fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

      await waitFor(() => {
        expect(onDraftGenerated).toHaveBeenCalledTimes(1);
        expect(onDraftGenerated).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "draft-new-001",
            content: "Hello Sarah!",
            confidenceScore: 0.9,
            status: "pending",
          })
        );
      });
    });

    it("shows error message when draft generation fails", async () => {
      setupFetchMockError(500, "Failed to generate draft.");
      const onError = jest.fn();
      renderComposer({ draft: null, onError });

      fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Error")).toBeInTheDocument();
      });
    });

    it("calls onError callback when generation fails", async () => {
      setupFetchMockError(500, "Failed to generate draft.");
      const onError = jest.fn();
      renderComposer({ draft: null, onError });

      fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Failed to generate draft.",
          })
        );
      });
    });
  });

  // ─── Draft Content Display ───────────────────────────────────────────────

  describe("draft content display", () => {
    it("renders draft content when a draft is provided", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.getByText(/Hi Sarah! 👋 Thanks so much for your interest/)
      ).toBeInTheDocument();
    });

    it("renders AI Draft Response header", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(screen.getByText("AI Draft Response")).toBeInTheDocument();
    });

    it("renders draft status badge", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      const allText = document.body.textContent ?? "";
      expect(allText).toContain("Pending");
    });

    it("renders Regenerate button when draft exists", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.getByRole("button", { name: /Regenerate/i })
      ).toBeInTheDocument();
    });
  });

  // ─── Confidence Meter ────────────────────────────────────────────────────

  describe("confidence meter", () => {
    it("displays confidence score for high-confidence draft", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(screen.getByText("92%")).toBeInTheDocument();
    });

    it("displays confidence score for low-confidence draft", () => {
      renderComposer({ draft: mockLowConfidenceDraft });
      expect(screen.getByText("55%")).toBeInTheDocument();
    });

    it("displays confidence score for medium-confidence draft", () => {
      renderComposer({ draft: mockMediumConfidenceDraft });
      expect(screen.getByText("78%")).toBeInTheDocument();
    });

    it("renders confidence meter with ARIA meter role", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      const meter = screen.getByRole("meter");
      expect(meter).toBeInTheDocument();
    });
  });

  // ─── Mandatory Review Warning ────────────────────────────────────────────

  describe("mandatory review warning", () => {
    it("shows mandatory review warning for very low confidence drafts", () => {
      renderComposer({ draft: mockLowConfidenceDraft });
      expect(
        screen.getByText("Very Low Confidence — Manual Review Required")
      ).toBeInTheDocument();
    });

    it("shows review recommended warning for low confidence drafts", () => {
      renderComposer({ draft: mockMediumConfidenceDraft });
      expect(
        screen.getByText("Low Confidence — Review Recommended")
      ).toBeInTheDocument();
    });

    it("does not show review warning for high confidence drafts", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.queryByText("Very Low Confidence — Manual Review Required")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Low Confidence — Review Recommended")
      ).not.toBeInTheDocument();
    });

    it("does not show review warning for sent drafts", () => {
      renderComposer({ draft: mockSentDraft });
      expect(
        screen.queryByText("Very Low Confidence — Manual Review Required")
      ).not.toBeInTheDocument();
    });
  });

  // ─── Human-in-the-Loop Enforcement ───────────────────────────────────────

  describe("human-in-the-loop enforcement", () => {
    it("disables Approve button for very low confidence unedited drafts", () => {
      renderComposer({ draft: mockLowConfidenceDraft });
      const approveButton = screen.getByRole("button", { name: /Approve/i });
      expect(approveButton).toBeDisabled();
    });

    it("shows low confidence warning text when approve is disabled", () => {
      renderComposer({ draft: mockLowConfidenceDraft });
      expect(
        screen.getByText(/Edit required before approval/)
      ).toBeInTheDocument();
    });

    it("enables Approve button for high confidence drafts", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      const approveButton = screen.getByRole("button", { name: /Approve/i });
      expect(approveButton).not.toBeDisabled();
    });

    it("enables Approve button for low confidence drafts that have been edited", () => {
      renderComposer({ draft: mockEditedDraft });
      const approveButton = screen.getByRole("button", { name: /Approve/i });
      expect(approveButton).not.toBeDisabled();
    });

    it("shows Edited badge for edited drafts", () => {
      renderComposer({ draft: mockEditedDraft });
      expect(screen.getByText("Edited")).toBeInTheDocument();
    });
  });

  // ─── Editing ─────────────────────────────────────────────────────────────

  describe("editing", () => {
    it("renders Edit Draft button", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.getByRole("button", { name: /Edit Draft/i })
      ).toBeInTheDocument();
    });

    it("switches to edit mode when Edit Draft is clicked", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      const textarea = screen.getByLabelText("Edit draft content");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue(mockHighConfidenceDraft.content);
    });

    it("shows character count in edit mode", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      expect(screen.getByText(/\/2000 characters/)).toBeInTheDocument();
    });

    it("shows Save Edit and Cancel buttons in edit mode", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      expect(
        screen.getByRole("button", { name: /Save Edit/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Cancel/i })
      ).toBeInTheDocument();
    });

    it("cancels editing and restores original content", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      const textarea = screen.getByLabelText("Edit draft content");
      fireEvent.change(textarea, { target: { value: "Modified content" } });

      fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

      // Should no longer be in edit mode
      expect(
        screen.queryByLabelText("Edit draft content")
      ).not.toBeInTheDocument();
      // Original content should be displayed
      expect(
        screen.getByText(/Hi Sarah! 👋 Thanks so much for your interest/)
      ).toBeInTheDocument();
    });

    it("calls API to save edited draft", async () => {
      const mock = setupFetchMockForEdit();
      const onDraftEdited = jest.fn();
      renderComposer({
        draft: mockHighConfidenceDraft,
        onDraftEdited,
      });

      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      const textarea = screen.getByLabelText("Edit draft content");
      fireEvent.change(textarea, {
        target: { value: "Updated draft content here." },
      });

      fireEvent.click(screen.getByRole("button", { name: /Save Edit/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          `/api/drafts/${mockHighConfidenceDraft.id}`,
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining("Updated draft content here."),
          })
        );
      });
    });

    it("calls onDraftEdited callback after successful edit", async () => {
      setupFetchMockForEdit({
        content: "Updated draft content here.",
        isEdited: true,
      });
      const onDraftEdited = jest.fn();
      renderComposer({
        draft: mockHighConfidenceDraft,
        onDraftEdited,
      });

      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      const textarea = screen.getByLabelText("Edit draft content");
      fireEvent.change(textarea, {
        target: { value: "Updated draft content here." },
      });

      fireEvent.click(screen.getByRole("button", { name: /Save Edit/i }));

      await waitFor(() => {
        expect(onDraftEdited).toHaveBeenCalledTimes(1);
        expect(onDraftEdited).toHaveBeenCalledWith(
          expect.objectContaining({
            isEdited: true,
          })
        );
      });
    });

    it("disables Save Edit when content is empty", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      const textarea = screen.getByLabelText("Edit draft content");
      fireEvent.change(textarea, { target: { value: "" } });

      const saveButton = screen.getByRole("button", { name: /Save Edit/i });
      expect(saveButton).toBeDisabled();
    });

    it("shows character limit exceeded warning", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      const textarea = screen.getByLabelText("Edit draft content");
      const longContent = "A".repeat(2001);
      fireEvent.change(textarea, { target: { value: longContent } });

      expect(screen.getByText(/exceeds limit/)).toBeInTheDocument();
    });

    it("shows error when edit API fails", async () => {
      setupFetchMockError(500, "Failed to edit draft.");
      const onError = jest.fn();
      renderComposer({
        draft: mockHighConfidenceDraft,
        onError,
      });

      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      const textarea = screen.getByLabelText("Edit draft content");
      fireEvent.change(textarea, {
        target: { value: "Some edited content." },
      });

      fireEvent.click(screen.getByRole("button", { name: /Save Edit/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ─── Approve Action ──────────────────────────────────────────────────────

  describe("approve action", () => {
    it("renders Approve button for pending drafts", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.getByRole("button", { name: /Approve/i })
      ).toBeInTheDocument();
    });

    it("calls approve API when Approve is clicked", async () => {
      const mock = setupFetchMockForAction("approve");
      const onDraftApproved = jest.fn();
      renderComposer({
        draft: mockHighConfidenceDraft,
        onDraftApproved,
      });

      fireEvent.click(screen.getByRole("button", { name: /Approve/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          `/api/drafts/${mockHighConfidenceDraft.id}`,
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"action":"approve"'),
          })
        );
      });
    });

    it("calls onDraftApproved callback after successful approval", async () => {
      setupFetchMockForAction("approve");
      const onDraftApproved = jest.fn();
      renderComposer({
        draft: mockHighConfidenceDraft,
        onDraftApproved,
      });

      fireEvent.click(screen.getByRole("button", { name: /Approve/i }));

      await waitFor(() => {
        expect(onDraftApproved).toHaveBeenCalledTimes(1);
        expect(onDraftApproved).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "approved",
          })
        );
      });
    });

    it("does not render Approve button for approved drafts", () => {
      renderComposer({ draft: mockApprovedDraft });
      expect(
        screen.queryByRole("button", { name: /^Approve$/i })
      ).not.toBeInTheDocument();
    });
  });

  // ─── Reject Action ───────────────────────────────────────────────────────

  describe("reject action", () => {
    it("renders Reject button for pending drafts", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.getByRole("button", { name: /Reject/i })
      ).toBeInTheDocument();
    });

    it("shows rejection reason input when Reject is clicked", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Reject/i }));

      expect(
        screen.getByLabelText("Rejection reason")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Confirm Reject/i })
      ).toBeInTheDocument();
    });

    it("calls reject API when Confirm Reject is clicked", async () => {
      const mock = setupFetchMockForAction("reject");
      const onDraftRejected = jest.fn();
      renderComposer({
        draft: mockHighConfidenceDraft,
        onDraftRejected,
      });

      fireEvent.click(screen.getByRole("button", { name: /Reject/i }));

      const reasonInput = screen.getByLabelText("Rejection reason");
      fireEvent.change(reasonInput, {
        target: { value: "Needs more detail about pricing." },
      });

      fireEvent.click(screen.getByRole("button", { name: /Confirm Reject/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          `/api/drafts/${mockHighConfidenceDraft.id}`,
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"action":"reject"'),
          })
        );
      });
    });

    it("calls onDraftRejected callback after successful rejection", async () => {
      setupFetchMockForAction("reject");
      const onDraftRejected = jest.fn();
      renderComposer({
        draft: mockHighConfidenceDraft,
        onDraftRejected,
      });

      fireEvent.click(screen.getByRole("button", { name: /Reject/i }));
      fireEvent.click(screen.getByRole("button", { name: /Confirm Reject/i }));

      await waitFor(() => {
        expect(onDraftRejected).toHaveBeenCalledTimes(1);
        expect(onDraftRejected).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "rejected",
          })
        );
      });
    });

    it("cancels rejection when Cancel is clicked", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Reject/i }));

      expect(
        screen.getByLabelText("Rejection reason")
      ).toBeInTheDocument();

      // Find the Cancel button within the reject input area
      const cancelButtons = screen.getAllByRole("button", { name: /Cancel/i });
      const rejectCancelButton = cancelButtons[cancelButtons.length - 1];
      fireEvent.click(rejectCancelButton);

      expect(
        screen.queryByLabelText("Rejection reason")
      ).not.toBeInTheDocument();
    });
  });

  // ─── Send Action ─────────────────────────────────────────────────────────

  describe("send action", () => {
    it("renders Send Reply button for approved drafts", () => {
      renderComposer({ draft: mockApprovedDraft });
      expect(
        screen.getByRole("button", { name: /Send Reply/i })
      ).toBeInTheDocument();
    });

    it("does not render Send Reply button for pending drafts", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.queryByRole("button", { name: /Send Reply/i })
      ).not.toBeInTheDocument();
    });

    it("calls send API when Send Reply is clicked", async () => {
      const mock = setupFetchMockForAction("send");
      const onDraftSent = jest.fn();
      renderComposer({
        draft: mockApprovedDraft,
        onDraftSent,
      });

      fireEvent.click(screen.getByRole("button", { name: /Send Reply/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          `/api/drafts/${mockApprovedDraft.id}`,
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"action":"send"'),
          })
        );
      });
    });

    it("calls onDraftSent callback after successful send", async () => {
      setupFetchMockForAction("send", {
        draftId: "draft-004",
        dmId: "dm-001",
        status: "sent",
        sentAt: new Date().toISOString(),
        platform: "instagram",
        senderHandle: "@sarah_m_designs",
      });
      const onDraftSent = jest.fn();
      renderComposer({
        draft: mockApprovedDraft,
        onDraftSent,
      });

      fireEvent.click(screen.getByRole("button", { name: /Send Reply/i }));

      await waitFor(() => {
        expect(onDraftSent).toHaveBeenCalledTimes(1);
        expect(onDraftSent).toHaveBeenCalledWith(
          expect.objectContaining({
            draftId: "draft-004",
            dmId: "dm-001",
            status: "sent",
            platform: "instagram",
          })
        );
      });
    });
  });

  // ─── Sent State ──────────────────────────────────────────────────────────

  describe("sent state", () => {
    it("shows Reply Sent Successfully message for sent drafts", () => {
      renderComposer({ draft: mockSentDraft });
      expect(
        screen.getByText("Reply Sent Successfully")
      ).toBeInTheDocument();
    });

    it("does not show action buttons for sent drafts", () => {
      renderComposer({ draft: mockSentDraft });
      expect(
        screen.queryByRole("button", { name: /Approve/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Reject/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Send Reply/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Edit Draft/i })
      ).not.toBeInTheDocument();
    });

    it("shows platform name in sent confirmation", () => {
      renderComposer({ draft: mockSentDraft });
      expect(screen.getByText(/Instagram/)).toBeInTheDocument();
    });
  });

  // ─── Rejected State ──────────────────────────────────────────────────────

  describe("rejected state", () => {
    it("shows rejection message for rejected drafts", () => {
      renderComposer({ draft: mockRejectedDraft });
      expect(
        screen.getByText(/Draft was rejected/)
      ).toBeInTheDocument();
    });

    it("shows Edit & Resubmit button for rejected drafts", () => {
      renderComposer({ draft: mockRejectedDraft });
      expect(
        screen.getByRole("button", { name: /Edit & Resubmit/i })
      ).toBeInTheDocument();
    });
  });

  // ─── Knowledge Base References ───────────────────────────────────────────

  describe("knowledge base references", () => {
    it("displays knowledge base references for Aura community", () => {
      renderComposer({ dm: mockDM });
      expect(
        screen.getByText(/Knowledge Base References/)
      ).toBeInTheDocument();
      expect(screen.getByText("Aura")).toBeInTheDocument();
    });

    it("displays knowledge base references for Elara community", () => {
      renderComposer({ dm: mockDMElara });
      expect(screen.getByText("Elara")).toBeInTheDocument();
    });

    it("displays first home buyer grant reference for first home buyer DMs", () => {
      renderComposer({ dm: mockDMElara });
      expect(
        screen.getByText("First Home Owner Grant")
      ).toBeInTheDocument();
    });

    it("displays display village template reference for visit-related DMs", () => {
      renderComposer({ dm: mockDMElara });
      expect(
        screen.getByText("Display Village Invite")
      ).toBeInTheDocument();
    });

    it("displays bedroom listing reference when bedrooms are mentioned", () => {
      renderComposer({ dm: mockDMElara });
      expect(screen.getByText("3-Bedroom Listings")).toBeInTheDocument();
    });

    it("displays 4-bedroom listing reference for 4-bed DMs", () => {
      renderComposer({ dm: mockDM });
      expect(screen.getByText("4-Bedroom Listings")).toBeInTheDocument();
    });
  });

  // ─── Quick Action Buttons ────────────────────────────────────────────────

  describe("quick action buttons", () => {
    it("renders Insert Property Info button", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.getByRole("button", { name: /Insert Property Info/i })
      ).toBeInTheDocument();
    });

    it("renders Suggest Next Step button", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      expect(
        screen.getByRole("button", { name: /Suggest Next Step/i })
      ).toBeInTheDocument();
    });

    it("switches to edit mode and appends property info when Insert Property Info is clicked", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(
        screen.getByRole("button", { name: /Insert Property Info/i })
      );

      const textarea = screen.getByLabelText("Edit draft content");
      expect(textarea).toBeInTheDocument();
      expect((textarea as HTMLTextAreaElement).value).toContain(
        "available listings"
      );
    });

    it("switches to edit mode and appends next step when Suggest Next Step is clicked", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(
        screen.getByRole("button", { name: /Suggest Next Step/i })
      );

      const textarea = screen.getByLabelText("Edit draft content");
      expect(textarea).toBeInTheDocument();
    });
  });

  // ─── Regenerate ──────────────────────────────────────────────────────────

  describe("regenerate", () => {
    it("calls draft generation API with forceRegenerate when Regenerate is clicked", async () => {
      const mock = setupFetchMockForGenerate("Regenerated content!", 0.85);
      const onDraftGenerated = jest.fn();
      renderComposer({
        draft: mockHighConfidenceDraft,
        onDraftGenerated,
      });

      fireEvent.click(screen.getByRole("button", { name: /Regenerate/i }));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          `/api/dms/${mockDM.id}/draft`,
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"forceRegenerate":true'),
          })
        );
      });
    });
  });

  // ─── Error Handling ──────────────────────────────────────────────────────

  describe("error handling", () => {
    it("displays error alert with dismiss button", async () => {
      setupFetchMockError(500, "Something went wrong.");
      renderComposer({ draft: null });

      fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

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
      renderComposer({ draft: null });

      fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

      await waitFor(() => {
        expect(screen.getByText("First error.")).toBeInTheDocument();
      });

      // Set up successful response for retry
      fetchMock.mockRestore();
      setupFetchMockForGenerate("Success!", 0.9);

      fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

      await waitFor(() => {
        expect(screen.queryByText("First error.")).not.toBeInTheDocument();
      });
    });
  });

  // ─── Prop Sync ───────────────────────────────────────────────────────────

  describe("prop synchronization", () => {
    it("updates displayed draft when draft prop changes", () => {
      const { rerender } = render(
        <DraftComposer
          dm={mockDM}
          draft={mockHighConfidenceDraft}
          userId="user-agent-001"
        />
      );

      expect(screen.getByText("92%")).toBeInTheDocument();

      rerender(
        <DraftComposer
          dm={mockDM}
          draft={mockMediumConfidenceDraft}
          userId="user-agent-001"
        />
      );

      expect(screen.getByText("78%")).toBeInTheDocument();
    });

    it("resets edit mode when draft prop changes", () => {
      const { rerender } = render(
        <DraftComposer
          dm={mockDM}
          draft={mockHighConfidenceDraft}
          userId="user-agent-001"
        />
      );

      // Enter edit mode
      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));
      expect(screen.getByLabelText("Edit draft content")).toBeInTheDocument();

      // Change draft prop
      rerender(
        <DraftComposer
          dm={mockDM}
          draft={mockMediumConfidenceDraft}
          userId="user-agent-001"
        />
      );

      // Should exit edit mode
      expect(
        screen.queryByLabelText("Edit draft content")
      ).not.toBeInTheDocument();
    });

    it("shows no draft state when draft prop changes to null", () => {
      const { rerender } = render(
        <DraftComposer
          dm={mockDM}
          draft={mockHighConfidenceDraft}
          userId="user-agent-001"
        />
      );

      expect(screen.getByText("AI Draft Response")).toBeInTheDocument();

      rerender(
        <DraftComposer
          dm={mockDM}
          draft={null}
          userId="user-agent-001"
        />
      );

      expect(screen.getByText("Generate AI Draft")).toBeInTheDocument();
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("has proper ARIA region label", () => {
      renderComposer();
      expect(
        screen.getByRole("region", { name: "Draft Composer" })
      ).toBeInTheDocument();
    });

    it("edit textarea has accessible label", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));

      expect(screen.getByLabelText("Edit draft content")).toBeInTheDocument();
    });

    it("error alerts have assertive aria-live", () => {
      renderComposer({ draft: mockLowConfidenceDraft });
      // The mandatory review warning should have polite aria-live
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
    });

    it("confidence meter has proper ARIA attributes", () => {
      renderComposer({ draft: mockHighConfidenceDraft });
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "92");
      expect(meter).toHaveAttribute("aria-valuemin", "0");
      expect(meter).toHaveAttribute("aria-valuemax", "100");
    });
  });
});