import {
  checkSLABreaches,
  getSLAStatusSummary,
  getBreachedDMs,
  getApproachingSLADMs,
  getTimeToSLABreach,
  getSLAConfig,
} from "@/services/sla-monitor";
import { SLA_BREACH_THRESHOLD_MS } from "@/lib/constants";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockDMFindMany = jest.fn();
const mockDMFindUnique = jest.fn();
const mockUserFindMany = jest.fn();
const mockNotificationFindFirst = jest.fn();
const mockNotificationCreate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    dM: {
      findMany: (...args: unknown[]) => mockDMFindMany(...args),
      findUnique: (...args: unknown[]) => mockDMFindUnique(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    notification: {
      findFirst: (...args: unknown[]) => mockNotificationFindFirst(...args),
      create: (...args: unknown[]) => mockNotificationCreate(...args),
    },
  },
}));

// ─── Mock Notification Manager ───────────────────────────────────────────────

const mockTriggerNotification = jest.fn().mockResolvedValue({
  notificationId: "notif-sla-001",
  type: "sla_breach",
  status: "unread",
  recipient: "rachel.chen@stockland.com.au",
  createdAt: new Date().toISOString(),
});

const mockTriggerEscalationNotification = jest.fn().mockResolvedValue([
  {
    notificationId: "notif-esc-001",
    type: "escalation",
    status: "unread",
    recipient: "rachel.chen@stockland.com.au",
    createdAt: new Date().toISOString(),
  },
]);

jest.mock("@/services/notification-manager", () => ({
  triggerNotification: (...args: unknown[]) => mockTriggerNotification(...args),
  triggerEscalationNotification: (...args: unknown[]) => mockTriggerEscalationNotification(...args),
}));

// ─── Mock DM Status Tracker ─────────────────────────────────────────────────

const mockUpdateDMStatus = jest.fn().mockResolvedValue({
  id: "dm-001",
  platform: "instagram",
  senderName: "Sarah M.",
  senderHandle: "@sarah_m_designs",
  message: "Hi!",
  timestamp: new Date().toISOString(),
  status: "escalated",
  previousStatus: "new",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

jest.mock("@/services/dm-status-tracker", () => ({
  updateDMStatus: (...args: unknown[]) => mockUpdateDMStatus(...args),
}));

// ─── Mock Audit Logger ───────────────────────────────────────────────────────

const mockLogAction = jest.fn().mockResolvedValue(undefined);

jest.mock("@/services/audit-logger", () => ({
  logAction: (...args: unknown[]) => mockLogAction(...args),
  AuditActions: {
    DM_STATUS_UPDATED: "dm_status_updated",
  },
  AuditEntityTypes: {
    DM: "dm",
  },
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const NOW = new Date();

function buildMockDM(overrides: Record<string, unknown> = {}) {
  return {
    id: "dm-001",
    platform: "instagram",
    senderName: "Sarah M.",
    senderHandle: "@sarah_m_designs",
    message:
      "Hi! I've been looking at the Aura community in Calleya. We're a young family with a budget around $500-550k.",
    timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000), // 1h 5min ago
    status: "new",
    createdAt: new Date("2024-11-15T09:23:00Z"),
    updatedAt: new Date("2024-11-15T09:23:00Z"),
    ...overrides,
  };
}

function buildMockManager(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-manager-001",
    name: "Rachel Chen",
    email: "rachel.chen@stockland.com.au",
    role: "manager",
    ...overrides,
  };
}

function buildMockAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-agent-001",
    name: "Alex Thompson",
    email: "alex.thompson@stockland.com.au",
    role: "agent",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SLAMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── checkSLABreaches ────────────────────────────────────────────────────

  describe("checkSLABreaches", () => {
    // ─── No Breaches ─────────────────────────────────────────────────────

    describe("no breaches", () => {
      it("returns empty result when no DMs are in 'new' status past threshold", async () => {
        mockDMFindMany.mockResolvedValue([]);

        const result = await checkSLABreaches();

        expect(result.breachedDMs).toHaveLength(0);
        expect(result.notificationsCreated).toBe(0);
        expect(result.escalationsTriggered).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      it("returns checkedAt timestamp", async () => {
        mockDMFindMany.mockResolvedValue([]);

        const result = await checkSLABreaches();

        expect(result.checkedAt).toBeDefined();
        expect(typeof result.checkedAt).toBe("string");
        // Should be a valid ISO date string
        expect(new Date(result.checkedAt).toISOString()).toBe(result.checkedAt);
      });

      it("returns correct threshold values", async () => {
        mockDMFindMany.mockResolvedValue([]);

        const result = await checkSLABreaches();

        expect(result.thresholdMs).toBe(SLA_BREACH_THRESHOLD_MS);
        expect(result.thresholdMinutes).toBe(
          Math.floor(SLA_BREACH_THRESHOLD_MS / 60000)
        );
      });

      it("does not create any notifications when no breaches", async () => {
        mockDMFindMany.mockResolvedValue([]);

        await checkSLABreaches();

        expect(mockTriggerNotification).not.toHaveBeenCalled();
        expect(mockTriggerEscalationNotification).not.toHaveBeenCalled();
      });

      it("does not query managers when no breaches", async () => {
        mockDMFindMany.mockResolvedValue([]);

        await checkSLABreaches();

        expect(mockUserFindMany).not.toHaveBeenCalled();
      });
    });

    // ─── Single Breach ───────────────────────────────────────────────────

    describe("single breach", () => {
      it("detects a DM that has been in 'new' status past the SLA threshold", async () => {
        const breachedDM = buildMockDM({
          id: "dm-breach-001",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000), // 1h 5min ago
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null); // No existing notification

        const result = await checkSLABreaches();

        expect(result.breachedDMs).toHaveLength(1);
        expect(result.breachedDMs[0].dmId).toBe("dm-breach-001");
      });

      it("correctly calculates elapsed time for breached DM", async () => {
        const elapsedMs = SLA_BREACH_THRESHOLD_MS + 300000; // 1h 5min
        const breachedDM = buildMockDM({
          id: "dm-elapsed-001",
          timestamp: new Date(NOW.getTime() - elapsedMs),
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        const result = await checkSLABreaches();

        expect(result.breachedDMs[0].elapsedMs).toBeGreaterThanOrEqual(elapsedMs - 100);
        expect(result.breachedDMs[0].elapsedMs).toBeLessThanOrEqual(elapsedMs + 100);
        expect(result.breachedDMs[0].elapsedMinutes).toBe(
          Math.floor(elapsedMs / 60000)
        );
      });

      it("creates SLA breach notification for each manager", async () => {
        const breachedDM = buildMockDM({ id: "dm-notify-001" });
        const manager1 = buildMockManager({
          id: "mgr-001",
          email: "manager1@stockland.com.au",
        });
        const manager2 = buildMockManager({
          id: "mgr-002",
          email: "manager2@stockland.com.au",
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([manager1, manager2]);
        mockNotificationFindFirst.mockResolvedValue(null);

        const result = await checkSLABreaches();

        expect(mockTriggerNotification).toHaveBeenCalledTimes(2);
        expect(mockTriggerNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "sla_breach",
            recipient: "manager1@stockland.com.au",
            dmId: "dm-notify-001",
          })
        );
        expect(mockTriggerNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "sla_breach",
            recipient: "manager2@stockland.com.au",
            dmId: "dm-notify-001",
          })
        );
        expect(result.notificationsCreated).toBe(2);
      });

      it("includes sender info in notification details", async () => {
        const breachedDM = buildMockDM({
          id: "dm-details-001",
          senderName: "Priya B.",
          senderHandle: "@priya.bhatt",
          platform: "instagram",
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        await checkSLABreaches();

        expect(mockTriggerNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.stringContaining("Priya B."),
          })
        );
        expect(mockTriggerNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.stringContaining("@priya.bhatt"),
          })
        );
        expect(mockTriggerNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.stringContaining("instagram"),
          })
        );
      });

      it("includes elapsed minutes in notification details", async () => {
        const elapsedMs = SLA_BREACH_THRESHOLD_MS + 900000; // 1h 15min
        const breachedDM = buildMockDM({
          id: "dm-elapsed-details",
          timestamp: new Date(NOW.getTime() - elapsedMs),
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        await checkSLABreaches();

        const expectedMinutes = Math.floor(elapsedMs / 60000);
        expect(mockTriggerNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.stringContaining(`${expectedMinutes} minutes`),
          })
        );
      });

      it("logs SLA breach detection in audit log", async () => {
        const breachedDM = buildMockDM({ id: "dm-audit-001" });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        await checkSLABreaches();

        expect(mockLogAction).toHaveBeenCalledWith(
          expect.objectContaining({
            action: "sla_breach_detected",
            entityType: "dm",
            entityId: "dm-audit-001",
          })
        );
      });
    });

    // ─── Multiple Breaches ───────────────────────────────────────────────

    describe("multiple breaches", () => {
      it("detects multiple DMs breaching SLA", async () => {
        const dm1 = buildMockDM({
          id: "dm-multi-001",
          senderName: "Sarah M.",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 600000), // 1h 10min
        });
        const dm2 = buildMockDM({
          id: "dm-multi-002",
          senderName: "James M.",
          platform: "facebook",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 1200000), // 1h 20min
        });
        const dm3 = buildMockDM({
          id: "dm-multi-003",
          senderName: "Tom R.",
          platform: "facebook",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 1800000), // 1h 30min
        });

        mockDMFindMany.mockResolvedValue([dm3, dm2, dm1]); // Ordered by timestamp asc
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        const result = await checkSLABreaches();

        expect(result.breachedDMs).toHaveLength(3);
        expect(result.breachedDMs[0].dmId).toBe("dm-multi-003"); // Oldest first
        expect(result.breachedDMs[1].dmId).toBe("dm-multi-002");
        expect(result.breachedDMs[2].dmId).toBe("dm-multi-001");
      });

      it("creates notifications for each breached DM", async () => {
        const dm1 = buildMockDM({
          id: "dm-notif-001",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000),
        });
        const dm2 = buildMockDM({
          id: "dm-notif-002",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 600000),
        });

        mockDMFindMany.mockResolvedValue([dm2, dm1]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        const result = await checkSLABreaches();

        // 2 DMs × 1 manager = 2 notifications
        expect(result.notificationsCreated).toBe(2);
      });

      it("returns correct breached DM details for each DM", async () => {
        const dm1 = buildMockDM({
          id: "dm-detail-001",
          platform: "instagram",
          senderName: "Sarah M.",
          senderHandle: "@sarah_m_designs",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000),
        });

        mockDMFindMany.mockResolvedValue([dm1]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        const result = await checkSLABreaches();

        expect(result.breachedDMs[0]).toHaveProperty("dmId", "dm-detail-001");
        expect(result.breachedDMs[0]).toHaveProperty("platform", "instagram");
        expect(result.breachedDMs[0]).toHaveProperty("senderName", "Sarah M.");
        expect(result.breachedDMs[0]).toHaveProperty("senderHandle", "@sarah_m_designs");
        expect(result.breachedDMs[0]).toHaveProperty("elapsedMs");
        expect(result.breachedDMs[0]).toHaveProperty("elapsedMinutes");
        expect(result.breachedDMs[0]).toHaveProperty("elapsedHours");
      });
    });

    // ─── Deduplication ───────────────────────────────────────────────────

    describe("deduplication", () => {
      it("does not create duplicate notification if one already exists for the DM", async () => {
        const breachedDM = buildMockDM({ id: "dm-dedup-001" });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        // Existing notification found
        mockNotificationFindFirst.mockResolvedValue({
          id: "notif-existing-001",
          type: "sla_breach",
          dmId: "dm-dedup-001",
          status: "unread",
        });

        const result = await checkSLABreaches();

        // Should not create new notification since one already exists
        expect(mockTriggerNotification).not.toHaveBeenCalled();
        expect(result.notificationsCreated).toBe(0);
      });

      it("does not create duplicate notification if existing one is read", async () => {
        const breachedDM = buildMockDM({ id: "dm-dedup-read" });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue({
          id: "notif-read-001",
          type: "sla_breach",
          dmId: "dm-dedup-read",
          status: "read",
        });

        const result = await checkSLABreaches();

        expect(mockTriggerNotification).not.toHaveBeenCalled();
        expect(result.notificationsCreated).toBe(0);
      });

      it("checks for existing notification with correct query", async () => {
        const breachedDM = buildMockDM({ id: "dm-query-001" });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        await checkSLABreaches();

        expect(mockNotificationFindFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              dmId: "dm-query-001",
              type: "sla_breach",
              status: { in: ["unread", "read"] },
            }),
          })
        );
      });
    });

    // ─── Escalation ──────────────────────────────────────────────────────

    describe("escalation", () => {
      it("triggers escalation for DMs exceeding 2x SLA threshold", async () => {
        const escalationThresholdMs = SLA_BREACH_THRESHOLD_MS * 2;
        const breachedDM = buildMockDM({
          id: "dm-escalate-001",
          timestamp: new Date(NOW.getTime() - escalationThresholdMs - 300000), // 2h 5min ago
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        // Existing SLA breach notification exists (already notified)
        mockNotificationFindFirst
          .mockResolvedValueOnce({
            id: "notif-sla-existing",
            type: "sla_breach",
            dmId: "dm-escalate-001",
            status: "unread",
          })
          // No existing escalation notification
          .mockResolvedValueOnce(null);

        const result = await checkSLABreaches();

        expect(mockTriggerEscalationNotification).toHaveBeenCalledWith(
          "dm-escalate-001",
          "system",
          expect.stringContaining("SLA breach escalation")
        );
        expect(result.escalationsTriggered).toBeGreaterThanOrEqual(1);
      });

      it("does not trigger escalation for DMs within 2x SLA threshold", async () => {
        // DM is 1h 5min old — past SLA but not past escalation threshold (2h)
        const breachedDM = buildMockDM({
          id: "dm-no-escalate-001",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000),
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        // Existing SLA breach notification
        mockNotificationFindFirst.mockResolvedValue({
          id: "notif-sla-existing",
          type: "sla_breach",
          dmId: "dm-no-escalate-001",
          status: "unread",
        });

        await checkSLABreaches();

        expect(mockTriggerEscalationNotification).not.toHaveBeenCalled();
      });

      it("does not duplicate escalation if one already exists", async () => {
        const escalationThresholdMs = SLA_BREACH_THRESHOLD_MS * 2;
        const breachedDM = buildMockDM({
          id: "dm-esc-dedup-001",
          timestamp: new Date(NOW.getTime() - escalationThresholdMs - 300000),
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        // Existing SLA breach notification
        mockNotificationFindFirst
          .mockResolvedValueOnce({
            id: "notif-sla-existing",
            type: "sla_breach",
            dmId: "dm-esc-dedup-001",
            status: "unread",
          })
          // Existing escalation notification
          .mockResolvedValueOnce({
            id: "notif-esc-existing",
            type: "escalation",
            dmId: "dm-esc-dedup-001",
            status: "unread",
          });

        await checkSLABreaches();

        expect(mockTriggerEscalationNotification).not.toHaveBeenCalled();
      });

      it("updates DM status to escalated when escalation is triggered", async () => {
        const escalationThresholdMs = SLA_BREACH_THRESHOLD_MS * 2;
        const breachedDM = buildMockDM({
          id: "dm-status-escalate",
          timestamp: new Date(NOW.getTime() - escalationThresholdMs - 300000),
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst
          .mockResolvedValueOnce({
            id: "notif-sla-existing",
            type: "sla_breach",
            dmId: "dm-status-escalate",
            status: "unread",
          })
          .mockResolvedValueOnce(null); // No existing escalation

        await checkSLABreaches();

        expect(mockUpdateDMStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            dmId: "dm-status-escalate",
            newStatus: "escalated",
            changedBy: "system",
          })
        );
      });
    });

    // ─── Error Handling ──────────────────────────────────────────────────

    describe("error handling", () => {
      it("collects errors when notification creation fails", async () => {
        const breachedDM = buildMockDM({ id: "dm-error-001" });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);
        mockTriggerNotification.mockRejectedValue(
          new Error("Notification service unavailable")
        );

        const result = await checkSLABreaches();

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].dmId).toBe("dm-error-001");
        expect(result.errors[0].error).toContain("Notification service unavailable");
      });

      it("continues processing other DMs when one fails", async () => {
        const dm1 = buildMockDM({
          id: "dm-fail-001",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000),
        });
        const dm2 = buildMockDM({
          id: "dm-success-002",
          timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 600000),
        });

        mockDMFindMany.mockResolvedValue([dm2, dm1]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        // First DM notification fails, second succeeds
        mockTriggerNotification
          .mockRejectedValueOnce(new Error("Failed for dm1"))
          .mockResolvedValueOnce({
            notificationId: "notif-success",
            type: "sla_breach",
            status: "unread",
            recipient: "rachel.chen@stockland.com.au",
            createdAt: new Date().toISOString(),
          });

        const result = await checkSLABreaches();

        expect(result.errors.length).toBeGreaterThanOrEqual(1);
        expect(result.notificationsCreated).toBeGreaterThanOrEqual(1);
      });

      it("handles escalation failure gracefully", async () => {
        const escalationThresholdMs = SLA_BREACH_THRESHOLD_MS * 2;
        const breachedDM = buildMockDM({
          id: "dm-esc-fail",
          timestamp: new Date(NOW.getTime() - escalationThresholdMs - 300000),
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst
          .mockResolvedValueOnce({
            id: "notif-sla-existing",
            type: "sla_breach",
            dmId: "dm-esc-fail",
            status: "unread",
          })
          .mockResolvedValueOnce(null);

        mockTriggerEscalationNotification.mockRejectedValue(
          new Error("Escalation failed")
        );

        const result = await checkSLABreaches();

        // Should collect the error but not throw
        expect(result.errors.length).toBeGreaterThanOrEqual(1);
        expect(result.errors[0].error).toContain("Escalation failed");
      });

      it("handles DM status update failure gracefully during escalation", async () => {
        const escalationThresholdMs = SLA_BREACH_THRESHOLD_MS * 2;
        const breachedDM = buildMockDM({
          id: "dm-status-fail",
          timestamp: new Date(NOW.getTime() - escalationThresholdMs - 300000),
        });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst
          .mockResolvedValueOnce({
            id: "notif-sla-existing",
            type: "sla_breach",
            dmId: "dm-status-fail",
            status: "unread",
          })
          .mockResolvedValueOnce(null);

        mockUpdateDMStatus.mockRejectedValue(
          new Error("Invalid status transition")
        );

        // Should not throw — status update failure is non-blocking
        const result = await checkSLABreaches();

        expect(result.escalationsTriggered).toBeGreaterThanOrEqual(1);
      });
    });

    // ─── Query Correctness ───────────────────────────────────────────────

    describe("query correctness", () => {
      it("queries DMs with status 'new' and timestamp before threshold", async () => {
        mockDMFindMany.mockResolvedValue([]);

        await checkSLABreaches();

        expect(mockDMFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: "new",
              timestamp: expect.objectContaining({
                lt: expect.any(Date),
              }),
            }),
            orderBy: expect.objectContaining({
              timestamp: "asc",
            }),
          })
        );
      });

      it("queries only managers for notification recipients", async () => {
        const breachedDM = buildMockDM({ id: "dm-mgr-query" });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([buildMockManager()]);
        mockNotificationFindFirst.mockResolvedValue(null);

        await checkSLABreaches();

        expect(mockUserFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              role: "manager",
            }),
          })
        );
      });
    });

    // ─── No Managers ─────────────────────────────────────────────────────

    describe("no managers", () => {
      it("handles case when no managers exist", async () => {
        const breachedDM = buildMockDM({ id: "dm-no-mgr" });

        mockDMFindMany.mockResolvedValue([breachedDM]);
        mockUserFindMany.mockResolvedValue([]); // No managers
        mockNotificationFindFirst.mockResolvedValue(null);

        const result = await checkSLABreaches();

        expect(result.breachedDMs).toHaveLength(1);
        expect(result.notificationsCreated).toBe(0);
        expect(mockTriggerNotification).not.toHaveBeenCalled();
      });
    });
  });

  // ─── getSLAStatusSummary ─────────────────────────────────────────────────

  describe("getSLAStatusSummary", () => {
    it("returns correct counts when no DMs are in 'new' status", async () => {
      mockDMFindMany.mockResolvedValue([]);

      const summary = await getSLAStatusSummary();

      expect(summary.totalNewDMs).toBe(0);
      expect(summary.withinSLA).toBe(0);
      expect(summary.approachingSLA).toBe(0);
      expect(summary.breachedSLA).toBe(0);
      expect(summary.oldestUnrespondedMinutes).toBeNull();
    });

    it("correctly categorizes DMs within SLA", async () => {
      // DM received 10 minutes ago — well within SLA
      const recentDM = {
        id: "dm-recent",
        timestamp: new Date(NOW.getTime() - 600000), // 10 min ago
      };

      mockDMFindMany.mockResolvedValue([recentDM]);

      const summary = await getSLAStatusSummary();

      expect(summary.totalNewDMs).toBe(1);
      expect(summary.withinSLA).toBe(1);
      expect(summary.approachingSLA).toBe(0);
      expect(summary.breachedSLA).toBe(0);
    });

    it("correctly categorizes DMs approaching SLA (75% of threshold)", async () => {
      // DM received at 80% of SLA threshold — approaching
      const approachingMs = Math.floor(SLA_BREACH_THRESHOLD_MS * 0.8);
      const approachingDM = {
        id: "dm-approaching",
        timestamp: new Date(NOW.getTime() - approachingMs),
      };

      mockDMFindMany.mockResolvedValue([approachingDM]);

      const summary = await getSLAStatusSummary();

      expect(summary.totalNewDMs).toBe(1);
      expect(summary.approachingSLA).toBe(1);
      expect(summary.withinSLA).toBe(0);
      expect(summary.breachedSLA).toBe(0);
    });

    it("correctly categorizes DMs that have breached SLA", async () => {
      // DM received 1h 10min ago — breached
      const breachedDM = {
        id: "dm-breached",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 600000),
      };

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const summary = await getSLAStatusSummary();

      expect(summary.totalNewDMs).toBe(1);
      expect(summary.breachedSLA).toBe(1);
      expect(summary.withinSLA).toBe(0);
      expect(summary.approachingSLA).toBe(0);
    });

    it("correctly categorizes mixed DMs", async () => {
      const recentDM = {
        id: "dm-recent",
        timestamp: new Date(NOW.getTime() - 300000), // 5 min ago — within SLA
      };
      const approachingDM = {
        id: "dm-approaching",
        timestamp: new Date(NOW.getTime() - Math.floor(SLA_BREACH_THRESHOLD_MS * 0.8)), // approaching
      };
      const breachedDM = {
        id: "dm-breached",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 600000), // breached
      };

      // Ordered by timestamp asc (oldest first)
      mockDMFindMany.mockResolvedValue([breachedDM, approachingDM, recentDM]);

      const summary = await getSLAStatusSummary();

      expect(summary.totalNewDMs).toBe(3);
      expect(summary.withinSLA).toBe(1);
      expect(summary.approachingSLA).toBe(1);
      expect(summary.breachedSLA).toBe(1);
    });

    it("calculates oldest unresponded DM age correctly", async () => {
      const oldestMs = SLA_BREACH_THRESHOLD_MS + 1800000; // 1h 30min
      const oldestDM = {
        id: "dm-oldest",
        timestamp: new Date(NOW.getTime() - oldestMs),
      };
      const newerDM = {
        id: "dm-newer",
        timestamp: new Date(NOW.getTime() - 300000), // 5 min
      };

      // Ordered by timestamp asc
      mockDMFindMany.mockResolvedValue([oldestDM, newerDM]);

      const summary = await getSLAStatusSummary();

      expect(summary.oldestUnrespondedMinutes).toBe(
        Math.floor(oldestMs / 60000)
      );
    });

    it("returns null for oldestUnrespondedMinutes when no DMs", async () => {
      mockDMFindMany.mockResolvedValue([]);

      const summary = await getSLAStatusSummary();

      expect(summary.oldestUnrespondedMinutes).toBeNull();
    });

    it("queries only DMs with 'new' status", async () => {
      mockDMFindMany.mockResolvedValue([]);

      await getSLAStatusSummary();

      expect(mockDMFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "new",
          }),
        })
      );
    });
  });

  // ─── getBreachedDMs ──────────────────────────────────────────────────────

  describe("getBreachedDMs", () => {
    it("returns empty array when no DMs are breached", async () => {
      mockDMFindMany.mockResolvedValue([]);

      const result = await getBreachedDMs();

      expect(result).toHaveLength(0);
    });

    it("returns breached DMs with correct fields", async () => {
      const breachedDM = buildMockDM({
        id: "dm-breached-001",
        platform: "facebook",
        senderName: "James M.",
        senderHandle: "james.mitchell.904",
        message: "Hey there, I saw your ad.",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 600000),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("dmId", "dm-breached-001");
      expect(result[0]).toHaveProperty("platform", "facebook");
      expect(result[0]).toHaveProperty("senderName", "James M.");
      expect(result[0]).toHaveProperty("senderHandle", "james.mitchell.904");
      expect(result[0]).toHaveProperty("message");
      expect(result[0]).toHaveProperty("timestamp");
      expect(result[0]).toHaveProperty("status", "new");
      expect(result[0]).toHaveProperty("elapsedMs");
      expect(result[0]).toHaveProperty("elapsedMinutes");
      expect(result[0]).toHaveProperty("elapsedHours");
    });

    it("calculates elapsed time correctly for breached DMs", async () => {
      const elapsedMs = SLA_BREACH_THRESHOLD_MS + 1200000; // 1h 20min
      const breachedDM = buildMockDM({
        id: "dm-elapsed-calc",
        timestamp: new Date(NOW.getTime() - elapsedMs),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(result[0].elapsedMs).toBeGreaterThanOrEqual(elapsedMs - 100);
      expect(result[0].elapsedMs).toBeLessThanOrEqual(elapsedMs + 100);
      expect(result[0].elapsedMinutes).toBe(Math.floor(elapsedMs / 60000));
      expect(result[0].elapsedHours).toBe(
        Math.round((elapsedMs / 3600000) * 10) / 10
      );
    });

    it("returns DMs ordered by timestamp ascending (oldest first)", async () => {
      const dm1 = buildMockDM({
        id: "dm-order-001",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 1800000), // oldest
      });
      const dm2 = buildMockDM({
        id: "dm-order-002",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 600000), // newer
      });

      mockDMFindMany.mockResolvedValue([dm1, dm2]); // Already ordered asc

      const result = await getBreachedDMs();

      expect(result[0].dmId).toBe("dm-order-001");
      expect(result[1].dmId).toBe("dm-order-002");
      expect(result[0].elapsedMs).toBeGreaterThan(result[1].elapsedMs);
    });

    it("queries DMs with correct filters", async () => {
      mockDMFindMany.mockResolvedValue([]);

      await getBreachedDMs();

      expect(mockDMFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "new",
            timestamp: expect.objectContaining({
              lt: expect.any(Date),
            }),
          }),
          orderBy: expect.objectContaining({
            timestamp: "asc",
          }),
        })
      );
    });

    it("returns timestamp as ISO string", async () => {
      const breachedDM = buildMockDM({
        id: "dm-iso-001",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(typeof result[0].timestamp).toBe("string");
      expect(new Date(result[0].timestamp).toISOString()).toBe(result[0].timestamp);
    });
  });

  // ─── getApproachingSLADMs ────────────────────────────────────────────────

  describe("getApproachingSLADMs", () => {
    it("returns empty array when no DMs are approaching SLA", async () => {
      mockDMFindMany.mockResolvedValue([]);

      const result = await getApproachingSLADMs();

      expect(result).toHaveLength(0);
    });

    it("returns DMs that are between 75% and 100% of SLA threshold", async () => {
      // DM at 80% of SLA threshold
      const approachingMs = Math.floor(SLA_BREACH_THRESHOLD_MS * 0.8);
      const approachingDM = buildMockDM({
        id: "dm-approaching-001",
        timestamp: new Date(NOW.getTime() - approachingMs),
      });

      mockDMFindMany.mockResolvedValue([approachingDM]);

      const result = await getApproachingSLADMs();

      expect(result).toHaveLength(1);
      expect(result[0].dmId).toBe("dm-approaching-001");
    });

    it("returns correct elapsed time for approaching DMs", async () => {
      const approachingMs = Math.floor(SLA_BREACH_THRESHOLD_MS * 0.85);
      const approachingDM = buildMockDM({
        id: "dm-approaching-elapsed",
        timestamp: new Date(NOW.getTime() - approachingMs),
      });

      mockDMFindMany.mockResolvedValue([approachingDM]);

      const result = await getApproachingSLADMs();

      expect(result[0].elapsedMs).toBeGreaterThanOrEqual(approachingMs - 100);
      expect(result[0].elapsedMs).toBeLessThanOrEqual(approachingMs + 100);
      expect(result[0].elapsedMinutes).toBe(Math.floor(approachingMs / 60000));
    });

    it("queries DMs with correct time range filters", async () => {
      mockDMFindMany.mockResolvedValue([]);

      await getApproachingSLADMs();

      expect(mockDMFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "new",
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
          orderBy: expect.objectContaining({
            timestamp: "asc",
          }),
        })
      );
    });
  });

  // ─── getTimeToSLABreach ──────────────────────────────────────────────────

  describe("getTimeToSLABreach", () => {
    it("returns positive remaining time for DM within SLA", async () => {
      const recentTimestamp = new Date(NOW.getTime() - 600000); // 10 min ago
      mockDMFindUnique.mockResolvedValue({
        id: "dm-time-001",
        timestamp: recentTimestamp,
        status: "new",
      });

      const result = await getTimeToSLABreach("dm-time-001");

      expect(result.remainingMs).toBeGreaterThan(0);
      expect(result.remainingMinutes).toBeGreaterThan(0);
      expect(result.isBreached).toBe(false);
    });

    it("returns negative remaining time for breached DM", async () => {
      const oldTimestamp = new Date(
        NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000
      ); // 1h 5min ago
      mockDMFindUnique.mockResolvedValue({
        id: "dm-time-002",
        timestamp: oldTimestamp,
        status: "new",
      });

      const result = await getTimeToSLABreach("dm-time-002");

      expect(result.remainingMs).toBeLessThan(0);
      expect(result.isBreached).toBe(true);
    });

    it("returns isApproaching true for DMs at 75%+ of threshold", async () => {
      const approachingMs = Math.floor(SLA_BREACH_THRESHOLD_MS * 0.8);
      mockDMFindUnique.mockResolvedValue({
        id: "dm-time-003",
        timestamp: new Date(NOW.getTime() - approachingMs),
        status: "new",
      });

      const result = await getTimeToSLABreach("dm-time-003");

      expect(result.isApproaching).toBe(true);
      expect(result.isBreached).toBe(false);
    });

    it("returns isApproaching false for DMs well within SLA", async () => {
      mockDMFindUnique.mockResolvedValue({
        id: "dm-time-004",
        timestamp: new Date(NOW.getTime() - 300000), // 5 min ago
        status: "new",
      });

      const result = await getTimeToSLABreach("dm-time-004");

      expect(result.isApproaching).toBe(false);
      expect(result.isBreached).toBe(false);
    });

    it("returns full SLA time for DMs not in 'new' status", async () => {
      mockDMFindUnique.mockResolvedValue({
        id: "dm-time-005",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 600000),
        status: "drafted", // Not "new" — SLA not applicable
      });

      const result = await getTimeToSLABreach("dm-time-005");

      expect(result.remainingMs).toBe(SLA_BREACH_THRESHOLD_MS);
      expect(result.isBreached).toBe(false);
      expect(result.isApproaching).toBe(false);
    });

    it("throws error when DM ID is empty", async () => {
      await expect(getTimeToSLABreach("")).rejects.toThrow(
        "DM ID is required"
      );
    });

    it("throws error when DM is not found", async () => {
      mockDMFindUnique.mockResolvedValue(null);

      await expect(getTimeToSLABreach("dm-nonexistent")).rejects.toThrow(
        "DM not found"
      );
    });

    it("returns correct dmId in result", async () => {
      mockDMFindUnique.mockResolvedValue({
        id: "dm-time-006",
        timestamp: new Date(NOW.getTime() - 300000),
        status: "new",
      });

      const result = await getTimeToSLABreach("dm-time-006");

      expect(result.dmId).toBe("dm-time-006");
    });

    it("calculates remaining minutes correctly", async () => {
      const elapsedMs = 1800000; // 30 min
      mockDMFindUnique.mockResolvedValue({
        id: "dm-time-007",
        timestamp: new Date(NOW.getTime() - elapsedMs),
        status: "new",
      });

      const result = await getTimeToSLABreach("dm-time-007");

      const expectedRemainingMs = SLA_BREACH_THRESHOLD_MS - elapsedMs;
      const expectedRemainingMinutes = Math.floor(expectedRemainingMs / 60000);

      expect(result.remainingMs).toBeGreaterThanOrEqual(expectedRemainingMs - 100);
      expect(result.remainingMs).toBeLessThanOrEqual(expectedRemainingMs + 100);
      expect(result.remainingMinutes).toBe(expectedRemainingMinutes);
    });
  });

  // ─── getSLAConfig ────────────────────────────────────────────────────────

  describe("getSLAConfig", () => {
    it("returns correct breach threshold in milliseconds", () => {
      const config = getSLAConfig();

      expect(config.breachThresholdMs).toBe(SLA_BREACH_THRESHOLD_MS);
    });

    it("returns correct breach threshold in minutes", () => {
      const config = getSLAConfig();

      expect(config.breachThresholdMinutes).toBe(
        Math.floor(SLA_BREACH_THRESHOLD_MS / 60000)
      );
    });

    it("returns correct warning threshold (75% of breach)", () => {
      const config = getSLAConfig();

      const expectedWarningMs = Math.floor(SLA_BREACH_THRESHOLD_MS * 0.75);
      expect(config.warningThresholdMs).toBe(expectedWarningMs);
      expect(config.warningThresholdMinutes).toBe(
        Math.floor(expectedWarningMs / 60000)
      );
    });

    it("returns correct escalation threshold (2x breach)", () => {
      const config = getSLAConfig();

      const expectedEscalationMs = SLA_BREACH_THRESHOLD_MS * 2;
      expect(config.escalationThresholdMs).toBe(expectedEscalationMs);
      expect(config.escalationThresholdMinutes).toBe(
        Math.floor(expectedEscalationMs / 60000)
      );
    });

    it("returns all expected fields", () => {
      const config = getSLAConfig();

      expect(config).toHaveProperty("breachThresholdMs");
      expect(config).toHaveProperty("breachThresholdMinutes");
      expect(config).toHaveProperty("warningThresholdMs");
      expect(config).toHaveProperty("warningThresholdMinutes");
      expect(config).toHaveProperty("escalationThresholdMs");
      expect(config).toHaveProperty("escalationThresholdMinutes");
    });

    it("returns consistent values across multiple calls", () => {
      const config1 = getSLAConfig();
      const config2 = getSLAConfig();

      expect(config1.breachThresholdMs).toBe(config2.breachThresholdMs);
      expect(config1.warningThresholdMs).toBe(config2.warningThresholdMs);
      expect(config1.escalationThresholdMs).toBe(config2.escalationThresholdMs);
    });

    it("warning threshold is less than breach threshold", () => {
      const config = getSLAConfig();

      expect(config.warningThresholdMs).toBeLessThan(config.breachThresholdMs);
      expect(config.warningThresholdMinutes).toBeLessThan(
        config.breachThresholdMinutes
      );
    });

    it("escalation threshold is greater than breach threshold", () => {
      const config = getSLAConfig();

      expect(config.escalationThresholdMs).toBeGreaterThan(
        config.breachThresholdMs
      );
      expect(config.escalationThresholdMinutes).toBeGreaterThan(
        config.breachThresholdMinutes
      );
    });
  });

  // ─── Elapsed Time Calculations ───────────────────────────────────────────

  describe("elapsed time calculations", () => {
    it("calculates elapsedMinutes correctly for 65-minute-old DM", async () => {
      const elapsedMs = 65 * 60000; // 65 minutes
      const breachedDM = buildMockDM({
        id: "dm-65min",
        timestamp: new Date(NOW.getTime() - elapsedMs),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(result[0].elapsedMinutes).toBe(65);
    });

    it("calculates elapsedMinutes correctly for 90-minute-old DM", async () => {
      const elapsedMs = 90 * 60000; // 90 minutes
      const breachedDM = buildMockDM({
        id: "dm-90min",
        timestamp: new Date(NOW.getTime() - elapsedMs),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(result[0].elapsedMinutes).toBe(90);
    });

    it("calculates elapsedHours correctly for 2-hour-old DM", async () => {
      const elapsedMs = 2 * 3600000; // 2 hours
      const breachedDM = buildMockDM({
        id: "dm-2h",
        timestamp: new Date(NOW.getTime() - elapsedMs),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(result[0].elapsedHours).toBe(2.0);
    });

    it("calculates elapsedHours with decimal precision for 1.5-hour-old DM", async () => {
      const elapsedMs = 1.5 * 3600000; // 1.5 hours
      const breachedDM = buildMockDM({
        id: "dm-1.5h",
        timestamp: new Date(NOW.getTime() - elapsedMs),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(result[0].elapsedHours).toBe(1.5);
    });

    it("calculates elapsedMs as positive value", async () => {
      const breachedDM = buildMockDM({
        id: "dm-positive-ms",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(result[0].elapsedMs).toBeGreaterThan(0);
      expect(result[0].elapsedMs).toBeGreaterThan(SLA_BREACH_THRESHOLD_MS);
    });
  });

  // ─── Threshold Boundary Tests ────────────────────────────────────────────

  describe("threshold boundary tests", () => {
    it("DM exactly at SLA threshold is not breached (boundary)", async () => {
      // DM received exactly at the threshold — the query uses `lt` (less than)
      // so a DM at exactly the threshold should NOT be included
      const exactThresholdDM = {
        id: "dm-exact-threshold",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS),
        status: "new",
      };

      mockDMFindUnique.mockResolvedValue(exactThresholdDM);

      const result = await getTimeToSLABreach("dm-exact-threshold");

      // Remaining should be 0 or very close to 0
      expect(result.remainingMs).toBeLessThanOrEqual(100);
      expect(result.remainingMs).toBeGreaterThanOrEqual(-100);
    });

    it("DM 1 second past SLA threshold is breached", async () => {
      const justPastDM = {
        id: "dm-just-past",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 1000),
        status: "new",
      };

      mockDMFindUnique.mockResolvedValue(justPastDM);

      const result = await getTimeToSLABreach("dm-just-past");

      expect(result.isBreached).toBe(true);
      expect(result.remainingMs).toBeLessThan(0);
    });

    it("DM 1 second before SLA threshold is not breached", async () => {
      const justBeforeDM = {
        id: "dm-just-before",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS + 1000),
        status: "new",
      };

      mockDMFindUnique.mockResolvedValue(justBeforeDM);

      const result = await getTimeToSLABreach("dm-just-before");

      expect(result.isBreached).toBe(false);
      expect(result.remainingMs).toBeGreaterThan(0);
    });
  });

  // ─── Full Workflow ───────────────────────────────────────────────────────

  describe("full workflow", () => {
    it("detects breach, creates notification, and returns complete result", async () => {
      const breachedDM = buildMockDM({
        id: "dm-workflow-001",
        senderName: "Anika J.",
        senderHandle: "@anika.jones.living",
        platform: "instagram",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 900000), // 1h 15min
      });

      const manager = buildMockManager();

      mockDMFindMany.mockResolvedValue([breachedDM]);
      mockUserFindMany.mockResolvedValue([manager]);
      mockNotificationFindFirst.mockResolvedValue(null);

      const result = await checkSLABreaches();

      // Verify complete result structure
      expect(result.checkedAt).toBeDefined();
      expect(result.thresholdMs).toBe(SLA_BREACH_THRESHOLD_MS);
      expect(result.thresholdMinutes).toBe(60);
      expect(result.breachedDMs).toHaveLength(1);
      expect(result.breachedDMs[0].dmId).toBe("dm-workflow-001");
      expect(result.breachedDMs[0].senderName).toBe("Anika J.");
      expect(result.breachedDMs[0].platform).toBe("instagram");
      expect(result.breachedDMs[0].elapsedMinutes).toBe(75);
      expect(result.notificationsCreated).toBe(1);
      expect(result.escalationsTriggered).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify notification was created with correct details
      expect(mockTriggerNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sla_breach",
          recipient: manager.email,
          dmId: "dm-workflow-001",
          details: expect.stringContaining("75 minutes"),
        })
      );

      // Verify audit log was created
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "sla_breach_detected",
          entityId: "dm-workflow-001",
        })
      );
    });

    it("handles mixed scenario: new breach + existing breach + escalation", async () => {
      const escalationThresholdMs = SLA_BREACH_THRESHOLD_MS * 2;

      // DM 1: New breach (no existing notification)
      const newBreachDM = buildMockDM({
        id: "dm-new-breach",
        senderName: "Sarah M.",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000), // 1h 5min
      });

      // DM 2: Already notified, now needs escalation
      const escalationDM = buildMockDM({
        id: "dm-needs-escalation",
        senderName: "Tom R.",
        timestamp: new Date(NOW.getTime() - escalationThresholdMs - 600000), // 2h 10min
      });

      mockDMFindMany.mockResolvedValue([escalationDM, newBreachDM]);
      mockUserFindMany.mockResolvedValue([buildMockManager()]);

      // DM 2 has existing SLA notification but no escalation
      // DM 1 has no existing notification
      mockNotificationFindFirst
        // Check for dm-needs-escalation SLA breach notification
        .mockResolvedValueOnce({
          id: "notif-existing-sla",
          type: "sla_breach",
          dmId: "dm-needs-escalation",
          status: "unread",
        })
        // Check for dm-needs-escalation escalation notification
        .mockResolvedValueOnce(null)
        // Check for dm-new-breach SLA breach notification
        .mockResolvedValueOnce(null);

      const result = await checkSLABreaches();

      expect(result.breachedDMs).toHaveLength(2);

      // New breach should have notification created
      expect(result.notificationsCreated).toBeGreaterThanOrEqual(1);

      // Escalation should be triggered for the old DM
      expect(result.escalationsTriggered).toBeGreaterThanOrEqual(1);
      expect(mockTriggerEscalationNotification).toHaveBeenCalledWith(
        "dm-needs-escalation",
        "system",
        expect.any(String)
      );
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles DM with very old timestamp (days old)", async () => {
      const veryOldMs = 3 * 24 * 3600000; // 3 days
      const veryOldDM = buildMockDM({
        id: "dm-very-old",
        timestamp: new Date(NOW.getTime() - veryOldMs),
      });

      mockDMFindMany.mockResolvedValue([veryOldDM]);

      const result = await getBreachedDMs();

      expect(result).toHaveLength(1);
      expect(result[0].elapsedMinutes).toBe(Math.floor(veryOldMs / 60000));
      expect(result[0].elapsedHours).toBe(
        Math.round((veryOldMs / 3600000) * 10) / 10
      );
    });

    it("handles multiple managers receiving notifications for same DM", async () => {
      const breachedDM = buildMockDM({ id: "dm-multi-mgr" });
      const managers = [
        buildMockManager({ id: "mgr-1", email: "mgr1@stockland.com.au" }),
        buildMockManager({ id: "mgr-2", email: "mgr2@stockland.com.au" }),
        buildMockManager({ id: "mgr-3", email: "mgr3@stockland.com.au" }),
      ];

      mockDMFindMany.mockResolvedValue([breachedDM]);
      mockUserFindMany.mockResolvedValue(managers);
      mockNotificationFindFirst.mockResolvedValue(null);

      const result = await checkSLABreaches();

      expect(mockTriggerNotification).toHaveBeenCalledTimes(3);
      expect(result.notificationsCreated).toBe(3);
    });

    it("handles DM with different platforms correctly", async () => {
      const facebookDM = buildMockDM({
        id: "dm-fb-001",
        platform: "facebook",
        senderName: "James M.",
        senderHandle: "james.mitchell.904",
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000),
      });

      mockDMFindMany.mockResolvedValue([facebookDM]);

      const result = await getBreachedDMs();

      expect(result[0].platform).toBe("facebook");
      expect(result[0].senderName).toBe("James M.");
      expect(result[0].senderHandle).toBe("james.mitchell.904");
    });

    it("preserves message content in breached DM result", async () => {
      const longMessage = "A".repeat(500);
      const breachedDM = buildMockDM({
        id: "dm-long-msg",
        message: longMessage,
        timestamp: new Date(NOW.getTime() - SLA_BREACH_THRESHOLD_MS - 300000),
      });

      mockDMFindMany.mockResolvedValue([breachedDM]);

      const result = await getBreachedDMs();

      expect(result[0].message).toBe(longMessage);
    });
  });
});