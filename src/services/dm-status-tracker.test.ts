import {
  updateDMStatus,
  getDMStatusHistory,
  getValidTransitions,
  canTransition,
  bulkUpdateDMStatus,
} from "@/services/dm-status-tracker";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockFindMany = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    dM: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    auditLog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
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

function buildMockDM(overrides: Record<string, unknown> = {}) {
  return {
    id: "dm-001",
    platform: "instagram",
    senderName: "Sarah M.",
    senderHandle: "@sarah_m_designs",
    message:
      "Hi! I've been looking at the Aura community in Calleya. We're a young family with a budget around $500-550k.",
    timestamp: new Date("2024-11-15T09:23:00Z"),
    status: "new",
    createdAt: new Date("2024-11-15T09:23:00Z"),
    updatedAt: new Date("2024-11-15T09:23:00Z"),
    ...overrides,
  };
}

function buildMockAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "audit-001",
    action: "dm_status_updated",
    entityType: "dm",
    entityId: "dm-001",
    userId: "user-agent-001",
    details: 'DM status changed from "new" to "drafted" by user-agent-001.',
    createdAt: new Date("2024-11-15T10:00:00Z"),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DMStatusTracker", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── updateDMStatus ──────────────────────────────────────────────────────

  describe("updateDMStatus", () => {
    // ─── Valid Transitions ─────────────────────────────────────────────────

    describe("valid transitions", () => {
      it("transitions from 'new' to 'drafted'", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("drafted");
        expect(result.previousStatus).toBe("new");
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: "dm-001" },
            data: { status: "drafted" },
          })
        );
      });

      it("transitions from 'new' to 'escalated'", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "escalated", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "escalated",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("escalated");
        expect(result.previousStatus).toBe("new");
      });

      it("transitions from 'drafted' to 'sent'", async () => {
        const dm = buildMockDM({ status: "drafted" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "sent", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "sent",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("sent");
        expect(result.previousStatus).toBe("drafted");
      });

      it("transitions from 'drafted' to 'replied'", async () => {
        const dm = buildMockDM({ status: "drafted" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "replied", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "replied",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("replied");
        expect(result.previousStatus).toBe("drafted");
      });

      it("transitions from 'drafted' to 'escalated'", async () => {
        const dm = buildMockDM({ status: "drafted" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "escalated", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "escalated",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("escalated");
        expect(result.previousStatus).toBe("drafted");
      });

      it("transitions from 'drafted' to 'new' (reset)", async () => {
        const dm = buildMockDM({ status: "drafted" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "new", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "new",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("new");
        expect(result.previousStatus).toBe("drafted");
      });

      it("transitions from 'replied' to 'escalated'", async () => {
        const dm = buildMockDM({ status: "replied" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "escalated", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "escalated",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("escalated");
        expect(result.previousStatus).toBe("replied");
      });

      it("transitions from 'sent' to 'escalated'", async () => {
        const dm = buildMockDM({ status: "sent" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "escalated", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "escalated",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("escalated");
        expect(result.previousStatus).toBe("sent");
      });

      it("transitions from 'escalated' to 'new'", async () => {
        const dm = buildMockDM({ status: "escalated" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "new", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "new",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("new");
        expect(result.previousStatus).toBe("escalated");
      });

      it("transitions from 'escalated' to 'drafted'", async () => {
        const dm = buildMockDM({ status: "escalated" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("drafted");
        expect(result.previousStatus).toBe("escalated");
      });
    });

    // ─── Invalid Transitions ───────────────────────────────────────────────

    describe("invalid transitions", () => {
      it("rejects transition from 'new' to 'sent'", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "sent",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'new' to 'replied'", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "replied",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'sent' to 'new'", async () => {
        const dm = buildMockDM({ status: "sent" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "new",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'sent' to 'drafted'", async () => {
        const dm = buildMockDM({ status: "sent" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "drafted",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'sent' to 'replied'", async () => {
        const dm = buildMockDM({ status: "sent" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "replied",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'replied' to 'new'", async () => {
        const dm = buildMockDM({ status: "replied" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "new",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'replied' to 'drafted'", async () => {
        const dm = buildMockDM({ status: "replied" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "drafted",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'replied' to 'sent'", async () => {
        const dm = buildMockDM({ status: "replied" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "sent",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'escalated' to 'sent'", async () => {
        const dm = buildMockDM({ status: "escalated" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "sent",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects transition from 'escalated' to 'replied'", async () => {
        const dm = buildMockDM({ status: "escalated" });
        mockFindUnique.mockResolvedValue(dm);

        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "replied",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status transition");

        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    // ─── No-Op Transition ──────────────────────────────────────────────────

    describe("no-op transition", () => {
      it("returns current DM without update when status is already the target", async () => {
        const dm = buildMockDM({ status: "drafted" });
        mockFindUnique.mockResolvedValue(dm);

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("drafted");
        expect(result.previousStatus).toBe("drafted");
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockLogAction).not.toHaveBeenCalled();
      });
    });

    // ─── Persistence ───────────────────────────────────────────────────────

    describe("persistence", () => {
      it("persists the status change to the database", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        await updateDMStatus({
          dmId: "dm-001",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: "dm-001" },
            data: { status: "drafted" },
          })
        );
      });

      it("logs the status change in the audit log", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        await updateDMStatus({
          dmId: "dm-001",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(mockLogAction).toHaveBeenCalledTimes(1);
        expect(mockLogAction).toHaveBeenCalledWith(
          expect.objectContaining({
            action: "dm_status_updated",
            entityType: "dm",
            entityId: "dm-001",
            userId: "user-agent-001",
          })
        );
      });

      it("includes custom details in the audit log when provided", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "escalated", updatedAt: new Date() });

        await updateDMStatus({
          dmId: "dm-001",
          newStatus: "escalated",
          changedBy: "user-agent-001",
          details: "Customer requested manager callback.",
        });

        expect(mockLogAction).toHaveBeenCalledWith(
          expect.objectContaining({
            details: "Customer requested manager callback.",
          })
        );
      });

      it("generates default details when none provided", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        await updateDMStatus({
          dmId: "dm-001",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(mockLogAction).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.stringContaining('from "new" to "drafted"'),
          })
        );
      });
    });

    // ─── Return Value ──────────────────────────────────────────────────────

    describe("return value", () => {
      it("returns all expected fields in the result", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("platform");
        expect(result).toHaveProperty("senderName");
        expect(result).toHaveProperty("senderHandle");
        expect(result).toHaveProperty("message");
        expect(result).toHaveProperty("timestamp");
        expect(result).toHaveProperty("status");
        expect(result).toHaveProperty("previousStatus");
        expect(result).toHaveProperty("createdAt");
        expect(result).toHaveProperty("updatedAt");
      });

      it("returns the correct DM ID", async () => {
        const dm = buildMockDM({ id: "dm-042", status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-042",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(result.id).toBe("dm-042");
      });

      it("returns timestamps as ISO strings", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "drafted",
          changedBy: "user-agent-001",
        });

        expect(typeof result.timestamp).toBe("string");
        expect(typeof result.createdAt).toBe("string");
        expect(typeof result.updatedAt).toBe("string");
        // Verify they are valid ISO date strings
        expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
        expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
      });
    });

    // ─── Validation Errors ─────────────────────────────────────────────────

    describe("validation errors", () => {
      it("throws error when DM ID is empty", async () => {
        await expect(
          updateDMStatus({
            dmId: "",
            newStatus: "drafted",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("DM ID is required");

        expect(mockFindUnique).not.toHaveBeenCalled();
      });

      it("throws error when DM ID is whitespace only", async () => {
        await expect(
          updateDMStatus({
            dmId: "   ",
            newStatus: "drafted",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("DM ID is required");
      });

      it("throws error when new status is empty", async () => {
        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("status is required");
      });

      it("throws error when changedBy is empty", async () => {
        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "drafted",
            changedBy: "",
          })
        ).rejects.toThrow("Changed by");
      });

      it("throws error for invalid status value", async () => {
        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "invalid_status",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status");
      });

      it("throws error for unknown status value 'pending'", async () => {
        await expect(
          updateDMStatus({
            dmId: "dm-001",
            newStatus: "pending",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("Invalid status");
      });

      it("throws error when DM is not found", async () => {
        mockFindUnique.mockResolvedValue(null);

        await expect(
          updateDMStatus({
            dmId: "dm-nonexistent",
            newStatus: "drafted",
            changedBy: "user-agent-001",
          })
        ).rejects.toThrow("DM not found");
      });
    });

    // ─── Case Insensitivity ────────────────────────────────────────────────

    describe("case insensitivity", () => {
      it("normalizes status to lowercase", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "Drafted",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("drafted");
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { status: "drafted" },
          })
        );
      });

      it("handles uppercase status input", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "escalated", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "ESCALATED",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("escalated");
      });

      it("trims whitespace from status input", async () => {
        const dm = buildMockDM({ status: "new" });
        mockFindUnique.mockResolvedValue(dm);
        mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

        const result = await updateDMStatus({
          dmId: "dm-001",
          newStatus: "  drafted  ",
          changedBy: "user-agent-001",
        });

        expect(result.status).toBe("drafted");
      });
    });
  });

  // ─── getDMStatusHistory ──────────────────────────────────────────────────

  describe("getDMStatusHistory", () => {
    it("returns status history for a DM", async () => {
      mockFindUnique.mockResolvedValue(buildMockDM());
      mockFindMany.mockResolvedValue([
        buildMockAuditLog({
          id: "audit-002",
          details: 'DM status changed from "drafted" to "sent" by user-agent-001.',
          createdAt: new Date("2024-11-15T11:00:00Z"),
        }),
        buildMockAuditLog({
          id: "audit-001",
          details: 'DM status changed from "new" to "drafted" by user-agent-001.',
          createdAt: new Date("2024-11-15T10:00:00Z"),
        }),
      ]);

      const history = await getDMStatusHistory("dm-001");

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe("audit-002");
      expect(history[0].newStatus).toBe("sent");
      expect(history[0].oldStatus).toBe("drafted");
      expect(history[1].id).toBe("audit-001");
      expect(history[1].newStatus).toBe("drafted");
      expect(history[1].oldStatus).toBe("new");
    });

    it("returns empty array when no status changes exist", async () => {
      mockFindUnique.mockResolvedValue(buildMockDM());
      mockFindMany.mockResolvedValue([]);

      const history = await getDMStatusHistory("dm-001");

      expect(history).toHaveLength(0);
    });

    it("throws error when DM ID is empty", async () => {
      await expect(getDMStatusHistory("")).rejects.toThrow("DM ID is required");
    });

    it("throws error when DM is not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(getDMStatusHistory("dm-nonexistent")).rejects.toThrow(
        "DM not found"
      );
    });

    it("queries audit logs with correct filters", async () => {
      mockFindUnique.mockResolvedValue(buildMockDM());
      mockFindMany.mockResolvedValue([]);

      await getDMStatusHistory("dm-001");

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: "dm",
            entityId: "dm-001",
            action: "dm_status_updated",
          }),
          orderBy: expect.objectContaining({
            createdAt: "desc",
          }),
        })
      );
    });

    it("returns history entries with correct fields", async () => {
      mockFindUnique.mockResolvedValue(buildMockDM());
      mockFindMany.mockResolvedValue([
        buildMockAuditLog({
          userId: "user-agent-001",
          details: 'DM status changed from "new" to "drafted" by user-agent-001.',
          createdAt: new Date("2024-11-15T10:00:00Z"),
        }),
      ]);

      const history = await getDMStatusHistory("dm-001");

      expect(history[0]).toHaveProperty("id");
      expect(history[0]).toHaveProperty("dmId");
      expect(history[0]).toHaveProperty("oldStatus");
      expect(history[0]).toHaveProperty("newStatus");
      expect(history[0]).toHaveProperty("changedBy");
      expect(history[0]).toHaveProperty("changedAt");
      expect(history[0]).toHaveProperty("details");
    });

    it("returns changedBy as 'system' when userId is null", async () => {
      mockFindUnique.mockResolvedValue(buildMockDM());
      mockFindMany.mockResolvedValue([
        buildMockAuditLog({
          userId: null,
          details: 'DM status changed from "new" to "drafted" by system.',
        }),
      ]);

      const history = await getDMStatusHistory("dm-001");

      expect(history[0].changedBy).toBe("system");
    });

    it("parses status change details correctly", async () => {
      mockFindUnique.mockResolvedValue(buildMockDM());
      mockFindMany.mockResolvedValue([
        buildMockAuditLog({
          details: 'DM status changed from "escalated" to "new" by user-manager-001.',
        }),
      ]);

      const history = await getDMStatusHistory("dm-001");

      expect(history[0].oldStatus).toBe("escalated");
      expect(history[0].newStatus).toBe("new");
    });

    it("handles unparseable details gracefully", async () => {
      mockFindUnique.mockResolvedValue(buildMockDM());
      mockFindMany.mockResolvedValue([
        buildMockAuditLog({
          details: "Some unexpected format of details.",
        }),
      ]);

      const history = await getDMStatusHistory("dm-001");

      expect(history[0].oldStatus).toBe("unknown");
      expect(history[0].newStatus).toBe("unknown");
    });

    it("handles null details gracefully", async () => {
      mockFindUnique.mockResolvedValue(buildMockDM());
      mockFindMany.mockResolvedValue([
        buildMockAuditLog({
          details: null,
        }),
      ]);

      const history = await getDMStatusHistory("dm-001");

      expect(history[0].oldStatus).toBe("unknown");
      expect(history[0].newStatus).toBe("unknown");
    });
  });

  // ─── getValidTransitions ─────────────────────────────────────────────────

  describe("getValidTransitions", () => {
    it("returns valid transitions from 'new'", () => {
      const transitions = getValidTransitions("new");
      expect(transitions).toContain("drafted");
      expect(transitions).toContain("escalated");
      expect(transitions).not.toContain("sent");
      expect(transitions).not.toContain("replied");
      expect(transitions).not.toContain("new");
    });

    it("returns valid transitions from 'drafted'", () => {
      const transitions = getValidTransitions("drafted");
      expect(transitions).toContain("sent");
      expect(transitions).toContain("replied");
      expect(transitions).toContain("escalated");
      expect(transitions).toContain("new");
    });

    it("returns valid transitions from 'replied'", () => {
      const transitions = getValidTransitions("replied");
      expect(transitions).toContain("escalated");
      expect(transitions).not.toContain("new");
      expect(transitions).not.toContain("drafted");
      expect(transitions).not.toContain("sent");
    });

    it("returns valid transitions from 'sent'", () => {
      const transitions = getValidTransitions("sent");
      expect(transitions).toContain("escalated");
      expect(transitions).not.toContain("new");
      expect(transitions).not.toContain("drafted");
      expect(transitions).not.toContain("replied");
    });

    it("returns valid transitions from 'escalated'", () => {
      const transitions = getValidTransitions("escalated");
      expect(transitions).toContain("new");
      expect(transitions).toContain("drafted");
      expect(transitions).not.toContain("sent");
      expect(transitions).not.toContain("replied");
    });

    it("returns empty array for unknown status", () => {
      const transitions = getValidTransitions("unknown_status");
      expect(transitions).toEqual([]);
    });

    it("handles case-insensitive input", () => {
      const transitions = getValidTransitions("New");
      expect(transitions).toContain("drafted");
      expect(transitions).toContain("escalated");
    });

    it("handles whitespace in input", () => {
      const transitions = getValidTransitions("  new  ");
      expect(transitions).toContain("drafted");
      expect(transitions).toContain("escalated");
    });
  });

  // ─── canTransition ───────────────────────────────────────────────────────

  describe("canTransition", () => {
    it("returns true for valid transition new → drafted", () => {
      expect(canTransition("new", "drafted")).toBe(true);
    });

    it("returns true for valid transition new → escalated", () => {
      expect(canTransition("new", "escalated")).toBe(true);
    });

    it("returns true for valid transition drafted → sent", () => {
      expect(canTransition("drafted", "sent")).toBe(true);
    });

    it("returns true for valid transition drafted → replied", () => {
      expect(canTransition("drafted", "replied")).toBe(true);
    });

    it("returns true for valid transition drafted → escalated", () => {
      expect(canTransition("drafted", "escalated")).toBe(true);
    });

    it("returns true for valid transition drafted → new", () => {
      expect(canTransition("drafted", "new")).toBe(true);
    });

    it("returns true for valid transition replied → escalated", () => {
      expect(canTransition("replied", "escalated")).toBe(true);
    });

    it("returns true for valid transition sent → escalated", () => {
      expect(canTransition("sent", "escalated")).toBe(true);
    });

    it("returns true for valid transition escalated → new", () => {
      expect(canTransition("escalated", "new")).toBe(true);
    });

    it("returns true for valid transition escalated → drafted", () => {
      expect(canTransition("escalated", "drafted")).toBe(true);
    });

    it("returns false for invalid transition new → sent", () => {
      expect(canTransition("new", "sent")).toBe(false);
    });

    it("returns false for invalid transition new → replied", () => {
      expect(canTransition("new", "replied")).toBe(false);
    });

    it("returns false for invalid transition sent → new", () => {
      expect(canTransition("sent", "new")).toBe(false);
    });

    it("returns false for invalid transition sent → drafted", () => {
      expect(canTransition("sent", "drafted")).toBe(false);
    });

    it("returns false for invalid transition replied → new", () => {
      expect(canTransition("replied", "new")).toBe(false);
    });

    it("returns false for invalid transition replied → drafted", () => {
      expect(canTransition("replied", "drafted")).toBe(false);
    });

    it("returns false for invalid transition escalated → sent", () => {
      expect(canTransition("escalated", "sent")).toBe(false);
    });

    it("returns false for invalid transition escalated → replied", () => {
      expect(canTransition("escalated", "replied")).toBe(false);
    });

    it("returns false for unknown from status", () => {
      expect(canTransition("unknown", "drafted")).toBe(false);
    });

    it("returns false for unknown to status", () => {
      expect(canTransition("new", "unknown")).toBe(false);
    });

    it("returns false for both unknown statuses", () => {
      expect(canTransition("foo", "bar")).toBe(false);
    });

    it("handles case-insensitive input", () => {
      expect(canTransition("New", "Drafted")).toBe(true);
      expect(canTransition("NEW", "ESCALATED")).toBe(true);
    });

    it("returns false for same status (self-transition)", () => {
      expect(canTransition("new", "new")).toBe(false);
      expect(canTransition("drafted", "drafted")).toBe(false);
      expect(canTransition("sent", "sent")).toBe(false);
    });
  });

  // ─── bulkUpdateDMStatus ──────────────────────────────────────────────────

  describe("bulkUpdateDMStatus", () => {
    it("processes multiple status updates successfully", async () => {
      const dm1 = buildMockDM({ id: "dm-001", status: "new" });
      const dm2 = buildMockDM({ id: "dm-002", status: "drafted" });

      mockFindUnique
        .mockResolvedValueOnce(dm1)
        .mockResolvedValueOnce(dm2);

      mockUpdate
        .mockResolvedValueOnce({ ...dm1, status: "drafted", updatedAt: new Date() })
        .mockResolvedValueOnce({ ...dm2, status: "sent", updatedAt: new Date() });

      const result = await bulkUpdateDMStatus([
        { dmId: "dm-001", newStatus: "drafted", changedBy: "user-agent-001" },
        { dmId: "dm-002", newStatus: "sent", changedBy: "user-agent-001" },
      ]);

      expect(result.updated).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.updated[0].status).toBe("drafted");
      expect(result.updated[1].status).toBe("sent");
    });

    it("collects errors for failed updates", async () => {
      const dm1 = buildMockDM({ id: "dm-001", status: "new" });

      mockFindUnique
        .mockResolvedValueOnce(dm1)
        .mockResolvedValueOnce(null); // dm-002 not found

      mockUpdate.mockResolvedValueOnce({ ...dm1, status: "drafted", updatedAt: new Date() });

      const result = await bulkUpdateDMStatus([
        { dmId: "dm-001", newStatus: "drafted", changedBy: "user-agent-001" },
        { dmId: "dm-002", newStatus: "drafted", changedBy: "user-agent-001" },
      ]);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].dmId).toBe("dm-002");
      expect(result.errors[0].error).toContain("DM not found");
    });

    it("collects errors for invalid transitions in bulk", async () => {
      const dm1 = buildMockDM({ id: "dm-001", status: "new" });
      const dm2 = buildMockDM({ id: "dm-002", status: "sent" });

      mockFindUnique
        .mockResolvedValueOnce(dm1)
        .mockResolvedValueOnce(dm2);

      mockUpdate.mockResolvedValueOnce({ ...dm1, status: "drafted", updatedAt: new Date() });

      const result = await bulkUpdateDMStatus([
        { dmId: "dm-001", newStatus: "drafted", changedBy: "user-agent-001" },
        { dmId: "dm-002", newStatus: "new", changedBy: "user-agent-001" }, // invalid: sent → new
      ]);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].dmId).toBe("dm-002");
      expect(result.errors[0].error).toContain("Invalid status transition");
    });

    it("handles empty updates array", async () => {
      const result = await bulkUpdateDMStatus([]);

      expect(result.updated).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error details with index for each failure", async () => {
      mockFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await bulkUpdateDMStatus([
        { dmId: "dm-001", newStatus: "drafted", changedBy: "user-agent-001" },
        { dmId: "dm-002", newStatus: "drafted", changedBy: "user-agent-001" },
      ]);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].index).toBe(0);
      expect(result.errors[0].dmId).toBe("dm-001");
      expect(result.errors[1].index).toBe(1);
      expect(result.errors[1].dmId).toBe("dm-002");
    });
  });

  // ─── Full Workflow ───────────────────────────────────────────────────────

  describe("full workflow", () => {
    it("supports complete lifecycle: new → drafted → sent", async () => {
      // Step 1: new → drafted
      const dm = buildMockDM({ id: "dm-lifecycle", status: "new" });
      mockFindUnique.mockResolvedValue(dm);
      mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

      const step1 = await updateDMStatus({
        dmId: "dm-lifecycle",
        newStatus: "drafted",
        changedBy: "system",
      });
      expect(step1.status).toBe("drafted");
      expect(step1.previousStatus).toBe("new");

      // Step 2: drafted → sent
      const draftedDM = { ...dm, status: "drafted" };
      mockFindUnique.mockResolvedValue(draftedDM);
      mockUpdate.mockResolvedValue({ ...draftedDM, status: "sent", updatedAt: new Date() });

      const step2 = await updateDMStatus({
        dmId: "dm-lifecycle",
        newStatus: "sent",
        changedBy: "user-agent-001",
      });
      expect(step2.status).toBe("sent");
      expect(step2.previousStatus).toBe("drafted");
    });

    it("supports escalation workflow: new → escalated → drafted → sent", async () => {
      // Step 1: new → escalated
      const dm = buildMockDM({ id: "dm-escalate", status: "new" });
      mockFindUnique.mockResolvedValue(dm);
      mockUpdate.mockResolvedValue({ ...dm, status: "escalated", updatedAt: new Date() });

      const step1 = await updateDMStatus({
        dmId: "dm-escalate",
        newStatus: "escalated",
        changedBy: "system",
      });
      expect(step1.status).toBe("escalated");

      // Step 2: escalated → drafted
      const escalatedDM = { ...dm, status: "escalated" };
      mockFindUnique.mockResolvedValue(escalatedDM);
      mockUpdate.mockResolvedValue({ ...escalatedDM, status: "drafted", updatedAt: new Date() });

      const step2 = await updateDMStatus({
        dmId: "dm-escalate",
        newStatus: "drafted",
        changedBy: "user-manager-001",
      });
      expect(step2.status).toBe("drafted");

      // Step 3: drafted → sent
      const draftedDM = { ...dm, status: "drafted" };
      mockFindUnique.mockResolvedValue(draftedDM);
      mockUpdate.mockResolvedValue({ ...draftedDM, status: "sent", updatedAt: new Date() });

      const step3 = await updateDMStatus({
        dmId: "dm-escalate",
        newStatus: "sent",
        changedBy: "user-agent-001",
      });
      expect(step3.status).toBe("sent");
    });

    it("supports reset workflow: new → drafted → new → drafted → sent", async () => {
      // Step 1: new → drafted
      const dm = buildMockDM({ id: "dm-reset", status: "new" });
      mockFindUnique.mockResolvedValue(dm);
      mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

      await updateDMStatus({
        dmId: "dm-reset",
        newStatus: "drafted",
        changedBy: "system",
      });

      // Step 2: drafted → new (reset)
      const draftedDM = { ...dm, status: "drafted" };
      mockFindUnique.mockResolvedValue(draftedDM);
      mockUpdate.mockResolvedValue({ ...draftedDM, status: "new", updatedAt: new Date() });

      const step2 = await updateDMStatus({
        dmId: "dm-reset",
        newStatus: "new",
        changedBy: "user-agent-001",
        details: "Resetting DM for re-processing.",
      });
      expect(step2.status).toBe("new");

      // Step 3: new → drafted (again)
      const resetDM = { ...dm, status: "new" };
      mockFindUnique.mockResolvedValue(resetDM);
      mockUpdate.mockResolvedValue({ ...resetDM, status: "drafted", updatedAt: new Date() });

      await updateDMStatus({
        dmId: "dm-reset",
        newStatus: "drafted",
        changedBy: "system",
      });

      // Step 4: drafted → sent
      const reDraftedDM = { ...dm, status: "drafted" };
      mockFindUnique.mockResolvedValue(reDraftedDM);
      mockUpdate.mockResolvedValue({ ...reDraftedDM, status: "sent", updatedAt: new Date() });

      const step4 = await updateDMStatus({
        dmId: "dm-reset",
        newStatus: "sent",
        changedBy: "user-agent-001",
      });
      expect(step4.status).toBe("sent");
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles DM with all fields populated", async () => {
      const dm = buildMockDM({
        id: "dm-full",
        platform: "facebook",
        senderName: "James M.",
        senderHandle: "james.mitchell.904",
        message: "Hey there, I saw your ad about the new land release at Willowdale.",
        status: "new",
      });
      mockFindUnique.mockResolvedValue(dm);
      mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

      const result = await updateDMStatus({
        dmId: "dm-full",
        newStatus: "drafted",
        changedBy: "user-agent-001",
      });

      expect(result.platform).toBe("facebook");
      expect(result.senderName).toBe("James M.");
      expect(result.senderHandle).toBe("james.mitchell.904");
    });

    it("handles concurrent-like updates by always reading fresh state", async () => {
      // First call sees "new"
      const dm = buildMockDM({ status: "new" });
      mockFindUnique.mockResolvedValue(dm);
      mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

      const result = await updateDMStatus({
        dmId: "dm-001",
        newStatus: "drafted",
        changedBy: "user-agent-001",
      });

      expect(result.status).toBe("drafted");
      expect(mockFindUnique).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("preserves DM message content in the result", async () => {
      const longMessage = "A".repeat(500);
      const dm = buildMockDM({ status: "new", message: longMessage });
      mockFindUnique.mockResolvedValue(dm);
      mockUpdate.mockResolvedValue({ ...dm, status: "drafted", updatedAt: new Date() });

      const result = await updateDMStatus({
        dmId: "dm-001",
        newStatus: "drafted",
        changedBy: "user-agent-001",
      });

      expect(result.message).toBe(longMessage);
    });
  });
});