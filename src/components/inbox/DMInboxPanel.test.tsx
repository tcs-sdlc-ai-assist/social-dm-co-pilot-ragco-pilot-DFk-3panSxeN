import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DMInboxPanel } from "@/components/inbox/DMInboxPanel";
import type { DMResponse, PaginatedResponse } from "@/types";

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

const mockDMs: DMResponse[] = [
  {
    id: "dm-001",
    platform: "instagram",
    senderName: "Sarah M.",
    senderHandle: "@sarah_m_designs",
    message:
      "Hi! I've been looking at the Aura community in Calleya. We're a young family with a budget around $500-550k.",
    timestamp: new Date(Date.now() - 300000).toISOString(), // 5 min ago
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    drafts: [
      {
        id: "draft-001",
        dmId: "dm-001",
        content: "Hi Sarah! Thanks for reaching out...",
        confidenceScore: 0.92,
        isEdited: false,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    leads: [
      {
        id: "lead-001",
        dmId: "dm-001",
        name: "Sarah M.",
        contact: "@sarah_m_designs (Instagram)",
        budget: "$500,000 - $550,000",
        location: "Aura at Calleya",
        intent: "Family home purchase",
        score: 8.5,
        priorityFlag: true,
        salesforceId: null,
        status: "new",
        assignedTo: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "dm-002",
    platform: "facebook",
    senderName: "James M.",
    senderHandle: "james.mitchell.904",
    message:
      "Hey there, I saw your ad about the new land release at Willowdale.",
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    status: "drafted",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    drafts: [],
    leads: [],
  },
  {
    id: "dm-003",
    platform: "instagram",
    senderName: "Priya B.",
    senderHandle: "@priya.bhatt",
    message:
      "Hello! My husband and I are first home buyers. We've been pre-approved for $620k.",
    timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    status: "sent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    drafts: [],
    leads: [],
  },
  {
    id: "dm-004",
    platform: "facebook",
    senderName: "Tom R.",
    senderHandle: "tom.russo.77",
    message:
      "Just wondering about the retirement living options at Cardinal Freeman.",
    timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    status: "escalated",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    drafts: [],
    leads: [],
  },
];

function buildMockResponse(
  dms: DMResponse[],
  page: number = 1,
  limit: number = 20
): PaginatedResponse<DMResponse> {
  return {
    data: dms,
    total: dms.length,
    page,
    limit,
    totalPages: Math.ceil(dms.length / limit),
  };
}

// ─── Fetch Mock Setup ────────────────────────────────────────────────────────

let fetchMock: jest.SpyInstance;

function setupFetchMock(
  dms: DMResponse[] = mockDMs,
  page: number = 1,
  limit: number = 20
) {
  const response = buildMockResponse(dms, page, limit);
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => response,
  } as Response);
  return fetchMock;
}

function setupFetchMockError(statusCode: number = 500, message: string = "Internal Server Error") {
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

function renderPanel(props: Partial<React.ComponentProps<typeof DMInboxPanel>> = {}) {
  return render(
    <DMInboxPanel
      enablePolling={false}
      {...props}
    />
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DMInboxPanel", () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (fetchMock) {
      fetchMock.mockRestore();
    }
    jest.restoreAllMocks();
  });

  // ─── Rendering ───────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the inbox header with title", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Inbox")).toBeInTheDocument();
      });
    });

    it("renders DM list items after loading", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      expect(screen.getByText("James M.")).toBeInTheDocument();
      expect(screen.getByText("Priya B.")).toBeInTheDocument();
      expect(screen.getByText("Tom R.")).toBeInTheDocument();
    });

    it("displays sender handles for each DM", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("@sarah_m_designs")).toBeInTheDocument();
      });

      expect(screen.getByText("james.mitchell.904")).toBeInTheDocument();
      expect(screen.getByText("@priya.bhatt")).toBeInTheDocument();
      expect(screen.getByText("tom.russo.77")).toBeInTheDocument();
    });

    it("displays truncated message previews", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(
          screen.getByText(/Hi! I've been looking at the Aura community/)
        ).toBeInTheDocument();
      });
    });

    it("displays the total DM count badge", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText(String(mockDMs.length))).toBeInTheDocument();
      });
    });
  });

  // ─── Status Badges ──────────────────────────────────────────────────────

  describe("status badges", () => {
    it("displays correct status badges for each DM", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Check for status badges — there should be at least one "New" badge
      const statusBadges = screen.getAllByRole("status");
      expect(statusBadges.length).toBeGreaterThan(0);

      // Check specific status labels exist
      const allText = document.body.textContent ?? "";
      expect(allText).toContain("New");
      expect(allText).toContain("Drafted");
      expect(allText).toContain("Sent");
      expect(allText).toContain("Escalated");
    });
  });

  // ─── Platform Icons ─────────────────────────────────────────────────────

  describe("platform icons", () => {
    it("renders platform icon containers for each DM", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Instagram DMs should have Instagram-colored backgrounds
      const instagramIcons = document.querySelectorAll(".bg-pink-100");
      expect(instagramIcons.length).toBeGreaterThanOrEqual(2); // Sarah M. and Priya B.

      // Facebook DMs should have Facebook-colored backgrounds
      const facebookIcons = document.querySelectorAll(".bg-blue-100");
      expect(facebookIcons.length).toBeGreaterThanOrEqual(2); // James M. and Tom R.
    });
  });

  // ─── DM Selection ──────────────────────────────────────────────────────

  describe("DM selection", () => {
    it("calls onSelectDM when a DM is clicked", async () => {
      setupFetchMock();
      const onSelectDM = jest.fn();
      renderPanel({ onSelectDM });

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Find the DM item and click it
      const sarahItem = screen.getByText("Sarah M.").closest("[role='option']");
      expect(sarahItem).not.toBeNull();
      fireEvent.click(sarahItem!);

      expect(onSelectDM).toHaveBeenCalledTimes(1);
      expect(onSelectDM).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "dm-001",
          senderName: "Sarah M.",
          platform: "instagram",
        })
      );
    });

    it("highlights the selected DM", async () => {
      setupFetchMock();
      renderPanel({ selectedDMId: "dm-001" });

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const selectedItem = screen.getByText("Sarah M.").closest("[role='option']");
      expect(selectedItem).not.toBeNull();
      expect(selectedItem!.getAttribute("aria-selected")).toBe("true");
    });

    it("does not highlight unselected DMs", async () => {
      setupFetchMock();
      renderPanel({ selectedDMId: "dm-001" });

      await waitFor(() => {
        expect(screen.getByText("James M.")).toBeInTheDocument();
      });

      const unselectedItem = screen.getByText("James M.").closest("[role='option']");
      expect(unselectedItem).not.toBeNull();
      expect(unselectedItem!.getAttribute("aria-selected")).toBe("false");
    });

    it("supports keyboard selection with Enter key", async () => {
      setupFetchMock();
      const onSelectDM = jest.fn();
      renderPanel({ onSelectDM });

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const sarahItem = screen.getByText("Sarah M.").closest("[role='option']");
      expect(sarahItem).not.toBeNull();
      fireEvent.keyDown(sarahItem!, { key: "Enter" });

      expect(onSelectDM).toHaveBeenCalledTimes(1);
    });

    it("supports keyboard selection with Space key", async () => {
      setupFetchMock();
      const onSelectDM = jest.fn();
      renderPanel({ onSelectDM });

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const sarahItem = screen.getByText("Sarah M.").closest("[role='option']");
      expect(sarahItem).not.toBeNull();
      fireEvent.keyDown(sarahItem!, { key: " " });

      expect(onSelectDM).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Filtering ─────────────────────────────────────────────────────────

  describe("filtering", () => {
    it("renders status filter dropdown", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText("Filter by status");
      expect(statusFilter).toBeInTheDocument();
      expect(statusFilter.tagName).toBe("SELECT");
    });

    it("renders platform filter dropdown", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const platformFilter = screen.getByLabelText("Filter by platform");
      expect(platformFilter).toBeInTheDocument();
      expect(platformFilter.tagName).toBe("SELECT");
    });

    it("calls fetch with status filter when status is changed", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Clear the initial fetch calls
      fetchMock.mockClear();

      // Set up a new mock for the filtered request
      setupFetchMock([mockDMs[0]]); // Only "new" DMs

      const statusFilter = screen.getByLabelText("Filter by status");
      fireEvent.change(statusFilter, { target: { value: "new" } });

      // Advance timers to trigger the refetch
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const lastCall = calls[calls.length - 1];
        if (lastCall && lastCall[0]) {
          expect(String(lastCall[0])).toContain("status=new");
        }
      });
    });

    it("calls fetch with platform filter when platform is changed", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      fetchMock.mockClear();
      setupFetchMock([mockDMs[0], mockDMs[2]]); // Only Instagram DMs

      const platformFilter = screen.getByLabelText("Filter by platform");
      fireEvent.change(platformFilter, { target: { value: "instagram" } });

      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const lastCall = calls[calls.length - 1];
        if (lastCall && lastCall[0]) {
          expect(String(lastCall[0])).toContain("platform=instagram");
        }
      });
    });

    it("renders search input", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText("Search DMs by message or sender");
      expect(searchInput).toBeInTheDocument();
    });

    it("debounces search input and calls fetch with search param", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      fetchMock.mockClear();
      setupFetchMock([mockDMs[0]]);

      const searchInput = screen.getByLabelText("Search DMs by message or sender");
      fireEvent.change(searchInput, { target: { value: "Sarah" } });

      // Advance past debounce delay (300ms) and polling
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const hasSearchParam = calls.some(
          (call: unknown[]) => call[0] && String(call[0]).includes("search=Sarah")
        );
        expect(hasSearchParam).toBe(true);
      });
    });

    it("shows Clear button when filters are active", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Initially no Clear button
      expect(screen.queryByLabelText("Clear all filters")).not.toBeInTheDocument();

      // Apply a filter
      const statusFilter = screen.getByLabelText("Filter by status");
      fireEvent.change(statusFilter, { target: { value: "new" } });

      // Clear button should appear
      await waitFor(() => {
        expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
      });
    });

    it("resets filters when Clear button is clicked", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Apply a filter
      const statusFilter = screen.getByLabelText("Filter by status") as HTMLSelectElement;
      fireEvent.change(statusFilter, { target: { value: "new" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
      });

      // Click Clear
      fireEvent.click(screen.getByLabelText("Clear all filters"));

      // Filter should be reset
      await waitFor(() => {
        expect(statusFilter.value).toBe("");
      });
    });
  });

  // ─── Empty State ───────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows empty state when no DMs are returned", async () => {
      setupFetchMock([]);
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("No DMs yet")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Incoming social media DMs will appear here.")
      ).toBeInTheDocument();
    });

    it("shows filtered empty state when filters return no results", async () => {
      setupFetchMock(mockDMs);
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Apply a filter that returns no results
      fetchMock.mockRestore();
      setupFetchMock([]);

      const statusFilter = screen.getByLabelText("Filter by status");
      fireEvent.change(statusFilter, { target: { value: "escalated" } });

      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(
          screen.getByText("No DMs match your filters")
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Loading State ─────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading skeleton while fetching", () => {
      // Set up a fetch that never resolves immediately
      fetchMock = jest.spyOn(global, "fetch").mockImplementation(
        () => new Promise(() => {})
      );

      renderPanel();

      // Should show loading skeleton (aria-label)
      expect(screen.getByLabelText("Loading DMs")).toBeInTheDocument();
    });
  });

  // ─── Error State ───────────────────────────────────────────────────────

  describe("error state", () => {
    it("shows error state when fetch fails", async () => {
      setupFetchMockError(500, "Failed to retrieve DMs.");
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Failed to load DMs")).toBeInTheDocument();
      });
    });

    it("shows retry button on error", async () => {
      setupFetchMockError(500, "Server error");
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeInTheDocument();
      });
    });

    it("retries fetch when retry button is clicked", async () => {
      setupFetchMockError(500, "Server error");
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeInTheDocument();
      });

      // Set up successful response for retry
      fetchMock.mockRestore();
      setupFetchMock();

      fireEvent.click(screen.getByText("Retry"));

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });
    });
  });

  // ─── Unread Indicator ──────────────────────────────────────────────────

  describe("unread indicator", () => {
    it("shows unread dot for DMs with 'new' status", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // The "new" DM should have an unread indicator
      const unreadIndicators = screen.getAllByLabelText("Unread");
      expect(unreadIndicators.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Draft & Lead Counts ──────────────────────────────────────────────

  describe("draft and lead counts", () => {
    it("displays draft count for DMs with drafts", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Sarah M. has 1 draft
      expect(screen.getByText("1 draft")).toBeInTheDocument();
    });

    it("displays lead count for DMs with leads", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // Sarah M. has 1 lead
      expect(screen.getByText("1 lead")).toBeInTheDocument();
    });
  });

  // ─── Refresh ───────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("renders refresh button", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const refreshButton = screen.getByLabelText("Refresh inbox");
      expect(refreshButton).toBeInTheDocument();
    });

    it("triggers refetch when refresh button is clicked", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const callCountBefore = fetchMock.mock.calls.length;

      fireEvent.click(screen.getByLabelText("Refresh inbox"));

      await waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("has proper ARIA region label", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      expect(screen.getByRole("region", { name: "DM Inbox" })).toBeInTheDocument();
    });

    it("has proper ARIA listbox for DM list", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      expect(screen.getByRole("listbox", { name: "DM messages" })).toBeInTheDocument();
    });

    it("DM items have role='option'", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      const options = screen.getAllByRole("option");
      expect(options.length).toBe(mockDMs.length);
    });

    it("filter dropdowns have accessible labels", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
      expect(screen.getByLabelText("Filter by platform")).toBeInTheDocument();
      expect(screen.getByLabelText("Search DMs by message or sender")).toBeInTheDocument();
    });
  });

  // ─── New DM Count Badge ────────────────────────────────────────────────

  describe("new DM count badge", () => {
    it("displays new DM count when there are new DMs", async () => {
      setupFetchMock();
      renderPanel();

      await waitFor(() => {
        expect(screen.getByText("Sarah M.")).toBeInTheDocument();
      });

      // There is 1 DM with status "new" in our mock data
      const newBadge = screen.getByText("1 new");
      expect(newBadge).toBeInTheDocument();
    });
  });

  // ─── Initial Filters ──────────────────────────────────────────────────

  describe("initial filters", () => {
    it("applies initial status filter from props", async () => {
      setupFetchMock([mockDMs[0]]);
      renderPanel({ initialStatus: "new" });

      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const hasStatusParam = calls.some(
          (call: unknown[]) => call[0] && String(call[0]).includes("status=new")
        );
        expect(hasStatusParam).toBe(true);
      });
    });

    it("applies initial platform filter from props", async () => {
      setupFetchMock([mockDMs[0], mockDMs[2]]);
      renderPanel({ initialPlatform: "instagram" });

      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const hasPlatformParam = calls.some(
          (call: unknown[]) => call[0] && String(call[0]).includes("platform=instagram")
        );
        expect(hasPlatformParam).toBe(true);
      });
    });
  });
});