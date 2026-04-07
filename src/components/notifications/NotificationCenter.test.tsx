import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import type { NotificationResponse, PaginatedResponse } from "@/types";

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

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockNotifications: NotificationResponse[] = [
  {
    id: "notif-001",
    leadId: "lead-001",
    dmId: "dm-001",
    type: "high_priority_lead",
    status: "unread",
    recipient: "alex.thompson@stockland.com.au",
    details:
      "New high-priority lead from Sarah M. — family home buyer with $500-550k budget, looking for 4-bed at Aura Calleya.",
    createdAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
    lead: {
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
    },
    dm: {
      id: "dm-001",
      platform: "instagram",
      senderName: "Sarah M.",
      senderHandle: "@sarah_m_designs",
      message: "Hi! I've been looking at the Aura community in Calleya.",
      timestamp: new Date().toISOString(),
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "notif-002",
    leadId: "lead-003",
    dmId: "dm-003",
    type: "high_priority_lead",
    status: "read",
    recipient: "alex.thompson@stockland.com.au",
    details:
      "High-priority lead from Priya B. — pre-approved first home buyer at $620k for Elara, Marsden Park.",
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    lead: {
      id: "lead-003",
      dmId: "dm-003",
      name: "Priya B.",
      contact: "@priya.bhatt (Instagram)",
      budget: "$620,000 (pre-approved)",
      location: "Elara, Marsden Park",
      intent: "First home buyer — 3 bed + study, WFH setup",
      score: 9.1,
      priorityFlag: true,
      salesforceId: null,
      status: "contacted",
      assignedTo: "user-agent-001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    dm: {
      id: "dm-003",
      platform: "instagram",
      senderName: "Priya B.",
      senderHandle: "@priya.bhatt",
      message: "Hello! My husband and I are first home buyers.",
      timestamp: new Date().toISOString(),
      status: "replied",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "notif-003",
    leadId: "lead-004",
    dmId: "dm-004",
    type: "unassigned_lead",
    status: "unread",
    recipient: "alex.thompson@stockland.com.au",
    details:
      "New lead from Tom R. for Cardinal Freeman retirement living ($800k-1M) is unassigned. Please assign an agent.",
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    lead: {
      id: "lead-004",
      dmId: "dm-004",
      name: "Tom R.",
      contact: "tom.russo.77 (Facebook)",
      budget: "$800,000 - $1,000,000",
      location: "Cardinal Freeman",
      intent: "Retirement living — 2 bed unit with parking for mother",
      score: 8.0,
      priorityFlag: true,
      salesforceId: null,
      status: "new",
      assignedTo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    dm: {
      id: "dm-004",
      platform: "facebook",
      senderName: "Tom R.",
      senderHandle: "tom.russo.77",
      message: "Just wondering about the retirement living options at Cardinal Freeman.",
      timestamp: new Date().toISOString(),
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "notif-004",
    leadId: null,
    dmId: "dm-005",
    type: "sla_breach",
    status: "unread",
    recipient: "alex.thompson@stockland.com.au",
    details:
      "SLA breach: DM from Anika J. (@anika.jones.living) on instagram has been unanswered for 75 minutes. Received at 2024-11-15T14:05:00Z.",
    createdAt: new Date(Date.now() - 600000).toISOString(), // 10 min ago
    lead: null,
    dm: {
      id: "dm-005",
      platform: "instagram",
      senderName: "Anika J.",
      senderHandle: "@anika.jones.living",
      message: "Love what you're doing at Cloverton!",
      timestamp: new Date(Date.now() - 4500000).toISOString(), // 75 min ago
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "notif-005",
    leadId: "lead-001",
    dmId: null,
    type: "salesforce_sync_success",
    status: "read",
    recipient: "alex.thompson@stockland.com.au",
    details:
      'Lead "Sarah M." successfully synced to Salesforce. Salesforce ID: 00Q1234567890ABCDE.',
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    lead: {
      id: "lead-001",
      dmId: "dm-001",
      name: "Sarah M.",
      contact: "@sarah_m_designs (Instagram)",
      budget: "$500,000 - $550,000",
      location: "Aura at Calleya",
      intent: "Family home purchase",
      score: 8.5,
      priorityFlag: true,
      salesforceId: "00Q1234567890ABCDE",
      status: "new",
      assignedTo: "user-agent-001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    dm: null,
  },
  {
    id: "notif-006",
    leadId: "lead-002",
    dmId: null,
    type: "salesforce_sync_failed",
    status: "unread",
    recipient: "alex.thompson@stockland.com.au",
    details:
      'Salesforce sync failed for lead "James M.". Error: UNABLE_TO_LOCK_ROW.',
    createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    lead: {
      id: "lead-002",
      dmId: "dm-002",
      name: "James M.",
      contact: "james.mitchell.904 (Facebook)",
      budget: "Under $400,000",
      location: "Willowdale",
      intent: "Investment property",
      score: 7.2,
      priorityFlag: false,
      salesforceId: null,
      status: "new",
      assignedTo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    dm: null,
  },
  {
    id: "notif-007",
    leadId: null,
    dmId: "dm-006",
    type: "new_dm",
    status: "unread",
    recipient: "alex.thompson@stockland.com.au",
    details: "New DM from Michael T. on Facebook regarding Minta community.",
    createdAt: new Date(Date.now() - 120000).toISOString(), // 2 min ago
    lead: null,
    dm: {
      id: "dm-006",
      platform: "facebook",
      senderName: "Michael T.",
      senderHandle: "michael.tran.528",
      message: "Hi, I'm looking at buying my first home.",
      timestamp: new Date().toISOString(),
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "notif-008",
    leadId: null,
    dmId: "dm-007",
    type: "escalation",
    status: "unread",
    recipient: "alex.thompson@stockland.com.au",
    details:
      "DM from Emma L. (@emma.l.property) on instagram has been escalated by user-agent-001. Reason: Complex land inquiry requiring manager input.",
    createdAt: new Date(Date.now() - 900000).toISOString(), // 15 min ago
    lead: null,
    dm: {
      id: "dm-007",
      platform: "instagram",
      senderName: "Emma L.",
      senderHandle: "@emma.l.property",
      message: "Hey! Quick question — do you have any land-only lots available at Elara?",
      timestamp: new Date().toISOString(),
      status: "escalated",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
];

function buildMockResponse(
  notifications: NotificationResponse[],
  page: number = 1,
  limit: number = 50
): PaginatedResponse<NotificationResponse> {
  return {
    data: notifications,
    total: notifications.length,
    page,
    limit,
    totalPages: Math.ceil(notifications.length / limit),
  };
}

// ─── Fetch Mock Setup ────────────────────────────────────────────────────────

let fetchMock: jest.SpyInstance;

function setupFetchMock(
  notifications: NotificationResponse[] = mockNotifications,
  page: number = 1,
  limit: number = 50
) {
  const response = buildMockResponse(notifications, page, limit);
  fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

    // Handle unread count requests
    if (url.includes("countOnly=true")) {
      const unreadCount = notifications.filter((n) => n.status === "unread").length;
      return {
        ok: true,
        json: async () => ({
          recipient: "alex.thompson@stockland.com.au",
          unreadCount,
        }),
      } as Response;
    }

    // Handle PATCH requests (mark as read / dismissed)
    if (url.includes("/api/notifications") && typeof input !== "string" && !(input instanceof URL)) {
      const req = input as Request;
      if (req.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({
            id: "notif-001",
            type: "high_priority_lead",
            status: "read",
            recipient: "alex.thompson@stockland.com.au",
            details: "Updated notification.",
            createdAt: new Date().toISOString(),
          }),
        } as Response;
      }
      if (req.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            recipient: "alex.thompson@stockland.com.au",
            updatedCount: notifications.filter((n) => n.status === "unread").length,
          }),
        } as Response;
      }
    }

    // Default: return notification list
    return {
      ok: true,
      json: async () => response,
    } as Response;
  });
  return fetchMock;
}

function setupFetchMockWithFilter(
  allNotifications: NotificationResponse[],
  filterFn: (n: NotificationResponse) => boolean
) {
  fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

    if (url.includes("countOnly=true")) {
      const unreadCount = allNotifications.filter((n) => n.status === "unread").length;
      return {
        ok: true,
        json: async () => ({
          recipient: "alex.thompson@stockland.com.au",
          unreadCount,
        }),
      } as Response;
    }

    const filtered = allNotifications.filter(filterFn);
    return {
      ok: true,
      json: async () => buildMockResponse(filtered),
    } as Response;
  });
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

function renderCenter(
  props: Partial<React.ComponentProps<typeof NotificationCenter>> = {}
) {
  return render(
    <NotificationCenter
      recipient="alex.thompson@stockland.com.au"
      enablePolling={false}
      {...props}
    />
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("NotificationCenter", () => {
  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
    jest.restoreAllMocks();
  });

  // ─── Rendering ───────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the Notification Center region", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByRole("region", { name: "Notification Center" })
        ).toBeInTheDocument();
      });
    });

    it("renders the Notifications header", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });
    });

    it("renders notification items after loading", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("High Priority Lead")).toBeInTheDocument();
      });

      expect(screen.getByText("SLA Breach")).toBeInTheDocument();
      expect(screen.getByText("Unassigned Lead")).toBeInTheDocument();
    });

    it("displays total notification count badge", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(String(mockNotifications.length))
        ).toBeInTheDocument();
      });
    });

    it("displays unread count badge", async () => {
      setupFetchMock();
      renderCenter();

      const unreadCount = mockNotifications.filter(
        (n) => n.status === "unread"
      ).length;

      await waitFor(() => {
        expect(screen.getByText(`${unreadCount} new`)).toBeInTheDocument();
      });
    });
  });

  // ─── Notification Types ──────────────────────────────────────────────────

  describe("notification types", () => {
    it("displays high priority lead notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/New high-priority lead from Sarah M./)
        ).toBeInTheDocument();
      });
    });

    it("displays SLA breach notifications with elapsed time", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/SLA breach: DM from Anika J./)
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(/unanswered for 75 minutes/)
      ).toBeInTheDocument();
    });

    it("displays unassigned lead notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/New lead from Tom R. for Cardinal Freeman/)
        ).toBeInTheDocument();
      });
    });

    it("displays Salesforce sync success notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/successfully synced to Salesforce/)
        ).toBeInTheDocument();
      });
    });

    it("displays Salesforce sync failed notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/Salesforce sync failed for lead/)
        ).toBeInTheDocument();
      });
    });

    it("displays new DM notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/New DM from Michael T./)
        ).toBeInTheDocument();
      });
    });

    it("displays escalation notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/has been escalated/)
        ).toBeInTheDocument();
      });
    });

    it("shows URGENT badge for SLA breach notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const urgentBadges = screen.getAllByText("URGENT");
        expect(urgentBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("shows URGENT badge for escalation notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const urgentBadges = screen.getAllByText("URGENT");
        // SLA breach, escalation, high priority lead, salesforce sync failed — all urgent
        expect(urgentBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("shows urgent count badge in header", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        // Count urgent unread notifications
        const urgentTypes = [
          "sla_breach",
          "escalation",
          "high_priority_lead",
          "salesforce_sync_failed",
        ];
        const urgentCount = mockNotifications.filter(
          (n) => n.status === "unread" && urgentTypes.includes(n.type)
        ).length;

        if (urgentCount > 0) {
          expect(
            screen.getByText(`${urgentCount} urgent`)
          ).toBeInTheDocument();
        }
      });
    });
  });

  // ─── Notification Details ────────────────────────────────────────────────

  describe("notification details", () => {
    it("displays lead name and score for lead-related notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText(/Lead: Sarah M./)).toBeInTheDocument();
      });

      expect(screen.getByText(/8.5\/10/)).toBeInTheDocument();
    });

    it("displays DM sender info for DM-related notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText(/Anika J./)).toBeInTheDocument();
      });
    });

    it("displays platform info for DM-related notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        // The DM sender info includes platform
        const allText = document.body.textContent ?? "";
        expect(allText).toContain("instagram");
      });
    });

    it("displays relative timestamps for notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        // At least one notification should show a relative time
        const allText = document.body.textContent ?? "";
        expect(
          allText.includes("ago") || allText.includes("Just now")
        ).toBe(true);
      });
    });
  });

  // ─── Status Badges ──────────────────────────────────────────────────────

  describe("status badges", () => {
    it("displays status badges for each notification", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const statusBadges = screen.getAllByRole("status");
        expect(statusBadges.length).toBeGreaterThan(0);
      });
    });

    it("displays Unread status for unread notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const allText = document.body.textContent ?? "";
        expect(allText).toContain("Unread");
      });
    });

    it("displays Read status for read notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const allText = document.body.textContent ?? "";
        expect(allText).toContain("Read");
      });
    });
  });

  // ─── Unread Indicators ─────────────────────────────────────────────────

  describe("unread indicators", () => {
    it("shows unread dot for unread notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const unreadIndicators = screen.getAllByLabelText("Unread");
        expect(unreadIndicators.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ─── Mark as Read ──────────────────────────────────────────────────────

  describe("mark as read", () => {
    it("renders mark all as read button when there are unread notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Mark all as read/i })
        ).toBeInTheDocument();
      });
    });

    it("calls mark all as read API when button is clicked", async () => {
      const mock = setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Mark all as read/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /Mark all as read/i })
      );

      await waitFor(() => {
        // Should have called fetch with POST method for markAllRead
        const postCalls = mock.mock.calls.filter((call: unknown[]) => {
          if (call.length >= 2 && call[1] && typeof call[1] === "object") {
            const opts = call[1] as Record<string, unknown>;
            return opts.method === "POST";
          }
          return false;
        });
        expect(postCalls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("does not render mark all as read button when no unread notifications", async () => {
      const allRead = mockNotifications.map((n) => ({
        ...n,
        status: "read",
      }));
      setupFetchMock(allRead);
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: /Mark all as read/i })
      ).not.toBeInTheDocument();
    });
  });

  // ─── Notification Click ────────────────────────────────────────────────

  describe("notification click", () => {
    it("calls onNotificationClick when a notification is clicked", async () => {
      setupFetchMock();
      const onNotificationClick = jest.fn();
      renderCenter({ onNotificationClick });

      await waitFor(() => {
        expect(
          screen.getByText(/New high-priority lead from Sarah M./)
        ).toBeInTheDocument();
      });

      // Find the notification item and click it
      const notifItem = screen
        .getByText(/New high-priority lead from Sarah M./)
        .closest("[role='listitem']");
      expect(notifItem).not.toBeNull();
      fireEvent.click(notifItem!);

      expect(onNotificationClick).toHaveBeenCalledTimes(1);
      expect(onNotificationClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "notif-001",
          type: "high_priority_lead",
        })
      );
    });

    it("supports keyboard navigation with Enter key", async () => {
      setupFetchMock();
      const onNotificationClick = jest.fn();
      renderCenter({ onNotificationClick });

      await waitFor(() => {
        expect(
          screen.getByText(/New high-priority lead from Sarah M./)
        ).toBeInTheDocument();
      });

      const notifItem = screen
        .getByText(/New high-priority lead from Sarah M./)
        .closest("[role='listitem']");
      expect(notifItem).not.toBeNull();
      fireEvent.keyDown(notifItem!, { key: "Enter" });

      expect(onNotificationClick).toHaveBeenCalledTimes(1);
    });

    it("supports keyboard navigation with Space key", async () => {
      setupFetchMock();
      const onNotificationClick = jest.fn();
      renderCenter({ onNotificationClick });

      await waitFor(() => {
        expect(
          screen.getByText(/New high-priority lead from Sarah M./)
        ).toBeInTheDocument();
      });

      const notifItem = screen
        .getByText(/New high-priority lead from Sarah M./)
        .closest("[role='listitem']");
      expect(notifItem).not.toBeNull();
      fireEvent.keyDown(notifItem!, { key: " " });

      expect(onNotificationClick).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Filtering ─────────────────────────────────────────────────────────

  describe("filtering", () => {
    it("renders type filter dropdown", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByLabelText("Filter by notification type")
        ).toBeInTheDocument();
      });
    });

    it("renders status filter dropdown", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByLabelText("Filter by notification status")
        ).toBeInTheDocument();
      });
    });

    it("calls fetch with type filter when type is changed", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      const typeFilter = screen.getByLabelText("Filter by notification type");
      fireEvent.change(typeFilter, { target: { value: "sla_breach" } });

      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const hasTypeParam = calls.some(
          (call: unknown[]) =>
            call[0] && String(call[0]).includes("type=sla_breach")
        );
        expect(hasTypeParam).toBe(true);
      });
    });

    it("calls fetch with status filter when status is changed", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText(
        "Filter by notification status"
      );
      fireEvent.change(statusFilter, { target: { value: "unread" } });

      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const hasStatusParam = calls.some(
          (call: unknown[]) =>
            call[0] && String(call[0]).includes("status=unread")
        );
        expect(hasStatusParam).toBe(true);
      });
    });

    it("shows Clear button when filters are active", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      // Initially no Clear button
      expect(
        screen.queryByLabelText("Clear all filters")
      ).not.toBeInTheDocument();

      // Apply a filter
      const typeFilter = screen.getByLabelText("Filter by notification type");
      fireEvent.change(typeFilter, { target: { value: "sla_breach" } });

      // Clear button should appear
      await waitFor(() => {
        expect(
          screen.getByLabelText("Clear all filters")
        ).toBeInTheDocument();
      });
    });

    it("resets filters when Clear button is clicked", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      // Apply a filter
      const typeFilter = screen.getByLabelText(
        "Filter by notification type"
      ) as HTMLSelectElement;
      fireEvent.change(typeFilter, { target: { value: "sla_breach" } });

      await waitFor(() => {
        expect(
          screen.getByLabelText("Clear all filters")
        ).toBeInTheDocument();
      });

      // Click Clear
      fireEvent.click(screen.getByLabelText("Clear all filters"));

      // Filter should be reset
      await waitFor(() => {
        expect(typeFilter.value).toBe("");
      });
    });

    it("filters by high_priority_lead type", async () => {
      const highPriorityOnly = mockNotifications.filter(
        (n) => n.type === "high_priority_lead"
      );
      setupFetchMockWithFilter(
        mockNotifications,
        (n) => n.type === "high_priority_lead"
      );
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      const typeFilter = screen.getByLabelText("Filter by notification type");
      fireEvent.change(typeFilter, {
        target: { value: "high_priority_lead" },
      });

      await waitFor(() => {
        // Should show high priority lead notifications
        expect(
          screen.getByText(/New high-priority lead from Sarah M./)
        ).toBeInTheDocument();
      });
    });
  });

  // ─── SLA Breach Warnings ──────────────────────────────────────────────

  describe("SLA breach warnings", () => {
    it("displays SLA breach notification with elapsed time details", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText(/SLA breach/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/unanswered for 75 minutes/)
      ).toBeInTheDocument();
    });

    it("shows SLA breach as urgent type", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        // SLA breach notifications should have URGENT badge
        const slaBreachItem = screen
          .getByText(/SLA breach: DM from Anika J./)
          .closest("[role='listitem']");
        expect(slaBreachItem).not.toBeNull();

        const urgentBadge = slaBreachItem!.querySelector(
          "[class*='bg-red-100']"
        );
        expect(urgentBadge).not.toBeNull();
      });
    });

    it("displays DM sender info in SLA breach notification", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText(/Anika J./)).toBeInTheDocument();
      });
    });

    it("displays platform in SLA breach notification details", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/on instagram has been unanswered/)
        ).toBeInTheDocument();
      });
    });

    it("displays received timestamp in SLA breach notification", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/Received at 2024-11-15T14:05:00Z/)
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Empty State ───────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows empty state when no notifications are returned", async () => {
      setupFetchMock([]);
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("All caught up!")).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "You have no notifications at the moment. New alerts will appear here."
        )
      ).toBeInTheDocument();
    });

    it("shows filtered empty state when filters return no results", async () => {
      setupFetchMock(mockNotifications);
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      // Apply a filter that returns no results
      fetchMock.mockRestore();
      setupFetchMock([]);

      const typeFilter = screen.getByLabelText("Filter by notification type");
      fireEvent.change(typeFilter, { target: { value: "draft_ready" } });

      await waitFor(() => {
        expect(
          screen.getByText("No notifications match your filters")
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Loading State ─────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading skeleton while fetching", () => {
      // Set up a fetch that never resolves
      fetchMock = jest
        .spyOn(global, "fetch")
        .mockImplementation(() => new Promise(() => {}));

      renderCenter();

      // Should show loading skeleton
      expect(
        screen.getByLabelText("Loading notifications")
      ).toBeInTheDocument();
    });
  });

  // ─── Error State ───────────────────────────────────────────────────────

  describe("error state", () => {
    it("shows error state when fetch fails", async () => {
      setupFetchMockError(500, "Failed to retrieve notifications.");
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load notifications")
        ).toBeInTheDocument();
      });
    });

    it("shows retry button on error", async () => {
      setupFetchMockError(500, "Server error");
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeInTheDocument();
      });
    });

    it("retries fetch when retry button is clicked", async () => {
      setupFetchMockError(500, "Server error");
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeInTheDocument();
      });

      // Set up successful response for retry
      fetchMock.mockRestore();
      setupFetchMock();

      fireEvent.click(screen.getByText("Retry"));

      await waitFor(() => {
        expect(
          screen.getByText(/New high-priority lead from Sarah M./)
        ).toBeInTheDocument();
      });
    });

    it("calls onError callback when fetch fails", async () => {
      setupFetchMockError(500, "Server error");
      const onError = jest.fn();
      renderCenter({ onError });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("Failed to fetch notifications"),
          })
        );
      });
    });
  });

  // ─── Refresh ───────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("renders refresh button", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByLabelText("Refresh notifications")
        ).toBeInTheDocument();
      });
    });

    it("triggers refetch when refresh button is clicked", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      const callCountBefore = fetchMock.mock.calls.length;

      fireEvent.click(screen.getByLabelText("Refresh notifications"));

      await waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });
  });

  // ─── Dismiss Notification ──────────────────────────────────────────────

  describe("dismiss notification", () => {
    it("calls PATCH API when dismiss button is clicked", async () => {
      const mock = setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(/New high-priority lead from Sarah M./)
        ).toBeInTheDocument();
      });

      // Hover over the notification to reveal action buttons
      const notifItem = screen
        .getByText(/New high-priority lead from Sarah M./)
        .closest("[role='listitem']");
      expect(notifItem).not.toBeNull();

      // Find dismiss buttons within the notification item
      const dismissButtons = notifItem!.querySelectorAll(
        "[aria-label='Dismiss notification']"
      );
      expect(dismissButtons.length).toBeGreaterThanOrEqual(1);

      fireEvent.click(dismissButtons[0]);

      await waitFor(() => {
        const patchCalls = mock.mock.calls.filter((call: unknown[]) => {
          if (call.length >= 2 && call[1] && typeof call[1] === "object") {
            const opts = call[1] as Record<string, unknown>;
            return opts.method === "PATCH";
          }
          return false;
        });
        expect(patchCalls.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ─── Notification List ─────────────────────────────────────────────────

  describe("notification list", () => {
    it("has proper ARIA list role", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByRole("list", { name: "Notification list" })
        ).toBeInTheDocument();
      });
    });

    it("notification items have role='listitem'", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const items = screen.getAllByRole("listitem");
        expect(items.length).toBe(mockNotifications.length);
      });
    });

    it("renders notifications in order (most recent first)", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const items = screen.getAllByRole("listitem");
        expect(items.length).toBe(mockNotifications.length);
      });

      // The first notification in the list should be the most recent
      // (mockNotifications are already ordered by createdAt desc from the API)
      const items = screen.getAllByRole("listitem");
      const firstItemText = items[0].textContent ?? "";
      expect(firstItemText).toContain("High Priority Lead");
    });
  });

  // ─── Footer ────────────────────────────────────────────────────────────

  describe("footer", () => {
    it("displays last updated timestamp", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });

    it("displays notification count in footer", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByText(
            `${mockNotifications.length} of ${mockNotifications.length} notifications`
          )
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("has proper ARIA region label", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByRole("region", { name: "Notification Center" })
        ).toBeInTheDocument();
      });
    });

    it("filter dropdowns have accessible labels", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByLabelText("Filter by notification type")
        ).toBeInTheDocument();
        expect(
          screen.getByLabelText("Filter by notification status")
        ).toBeInTheDocument();
      });
    });

    it("refresh button has accessible label", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(
          screen.getByLabelText("Refresh notifications")
        ).toBeInTheDocument();
      });
    });

    it("unread count badge has accessible label", async () => {
      setupFetchMock();
      renderCenter();

      const unreadCount = mockNotifications.filter(
        (n) => n.status === "unread"
      ).length;

      await waitFor(() => {
        const badge = screen.getByLabelText(
          `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
        );
        expect(badge).toBeInTheDocument();
      });
    });
  });

  // ─── Multiple Notification Types Together ──────────────────────────────

  describe("multiple notification types together", () => {
    it("renders all notification type labels correctly", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      // Check for various type labels
      const allText = document.body.textContent ?? "";
      expect(allText).toContain("High Priority Lead");
      expect(allText).toContain("SLA Breach");
      expect(allText).toContain("Unassigned Lead");
      expect(allText).toContain("New DM");
      expect(allText).toContain("Escalation");
    });

    it("renders mixed read and unread notifications", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        const allText = document.body.textContent ?? "";
        expect(allText).toContain("Unread");
        expect(allText).toContain("Read");
      });
    });

    it("renders notifications with and without lead data", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        // Notification with lead data
        expect(screen.getByText(/Lead: Sarah M./)).toBeInTheDocument();

        // Notification without lead data (SLA breach)
        expect(
          screen.getByText(/SLA breach: DM from Anika J./)
        ).toBeInTheDocument();
      });
    });

    it("renders notifications with and without DM data", async () => {
      setupFetchMock();
      renderCenter();

      await waitFor(() => {
        // Notification with DM data
        expect(screen.getByText(/Anika J./)).toBeInTheDocument();

        // Notification without DM data (Salesforce sync)
        expect(
          screen.getByText(/successfully synced to Salesforce/)
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Live Updates Indicator ────────────────────────────────────────────

  describe("live updates indicator", () => {
    it("does not show live indicator when polling is disabled", async () => {
      setupFetchMock();
      renderCenter({ enablePolling: false });

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      expect(
        screen.queryByLabelText("Live updates active")
      ).not.toBeInTheDocument();
    });
  });
});