"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { DMInboxPanel } from "@/components/inbox/DMInboxPanel";
import { DraftComposer } from "@/components/composer/DraftComposer";
import { LeadCaptureSidebar } from "@/components/leads/LeadCaptureSidebar";
import { ToastProvider, ToastContainer, useToast } from "@/components/ui/Toast";
import Providers from "@/app/providers";
import type { DMResponse, DraftResponse, LeadResponse } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DraftForDM {
  dmId: string;
  draft: DraftResponse | null;
}

interface LeadForDM {
  dmId: string;
  lead: LeadResponse | null;
}

// ─── Fetch Helpers ───────────────────────────────────────────────────────────

async function fetchDraftsForDM(dmId: string): Promise<DraftResponse | null> {
  try {
    const response = await fetch(`/api/dms/${dmId}/draft`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      dmId: string;
      drafts: DraftResponse[];
      total: number;
    };

    if (data.drafts && data.drafts.length > 0) {
      return data.drafts[0];
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchLeadForDM(dmId: string): Promise<LeadResponse | null> {
  try {
    const response = await fetch("/api/leads/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dmId, preview: true }),
    });

    if (!response.ok) {
      return null;
    }

    // Preview mode doesn't return a persisted lead, so we check if one exists
    // by looking at the DM's leads via the DM list data
    return null;
  } catch {
    return null;
  }
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptySelectionState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stockland-green/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-stockland-green"
          aria-hidden="true"
        >
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-stockland-charcoal">
        Select a DM to get started
      </h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Choose a message from the inbox to view the AI-generated draft response,
        extract lead data, and manage the conversation workflow.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
            1
          </span>
          <span>Select a DM from the inbox</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
            2
          </span>
          <span>Review and edit the AI draft</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
            3
          </span>
          <span>Extract lead data and sync to Salesforce</span>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Content ───────────────────────────────────────────────────────

function DashboardContent() {
  const toast = useToast();

  // ─── State ─────────────────────────────────────────────────────────────

  const [selectedDM, setSelectedDM] = useState<DMResponse | null>(null);
  const [currentDraft, setCurrentDraft] = useState<DraftResponse | null>(null);
  const [currentLead, setCurrentLead] = useState<LeadResponse | null>(null);
  const [isDraftLoading, setIsDraftLoading] = useState<boolean>(false);
  const [isLeadLoading, setIsLeadLoading] = useState<boolean>(false);

  // ─── Load Draft & Lead when DM is selected ────────────────────────────

  useEffect(() => {
    if (!selectedDM) {
      setCurrentDraft(null);
      setCurrentLead(null);
      return;
    }

    // Load existing draft for the selected DM
    setIsDraftLoading(true);
    fetchDraftsForDM(selectedDM.id)
      .then((draft) => {
        setCurrentDraft(draft);
      })
      .catch(() => {
        setCurrentDraft(null);
      })
      .finally(() => {
        setIsDraftLoading(false);
      });

    // Check if the DM already has leads from the list data
    if (selectedDM.leads && selectedDM.leads.length > 0) {
      const latestLead = selectedDM.leads[0];
      setCurrentLead({
        id: latestLead.id,
        dmId: latestLead.dmId,
        name: latestLead.name,
        contact: latestLead.contact ?? null,
        budget: latestLead.budget ?? null,
        location: latestLead.location ?? null,
        intent: latestLead.intent ?? null,
        score: latestLead.score,
        priorityFlag: latestLead.priorityFlag,
        salesforceId: latestLead.salesforceId ?? null,
        status: latestLead.status,
        assignedTo: latestLead.assignedTo ?? null,
        createdAt: latestLead.createdAt,
        updatedAt: latestLead.updatedAt,
      });
    } else {
      setCurrentLead(null);
    }

    // Also check drafts from the DM list data
    if (selectedDM.drafts && selectedDM.drafts.length > 0) {
      const latestDraft = selectedDM.drafts[0];
      setCurrentDraft({
        id: latestDraft.id,
        dmId: latestDraft.dmId,
        content: latestDraft.content,
        confidenceScore: latestDraft.confidenceScore,
        isEdited: latestDraft.isEdited,
        status: latestDraft.status,
        createdAt: latestDraft.createdAt,
        updatedAt: latestDraft.updatedAt,
      });
      setIsDraftLoading(false);
    }
  }, [selectedDM]);

  // ─── DM Selection Handler ─────────────────────────────────────────────

  const handleSelectDM = useCallback((dm: DMResponse) => {
    setSelectedDM(dm);
  }, []);

  // ─── Draft Handlers ───────────────────────────────────────────────────

  const handleDraftGenerated = useCallback(
    (draft: DraftResponse) => {
      setCurrentDraft(draft);
      toast.info(
        `AI draft generated with ${Math.round(draft.confidenceScore * 100)}% confidence.`,
        "Draft Ready"
      );
    },
    [toast]
  );

  const handleDraftEdited = useCallback(
    (draft: DraftResponse) => {
      setCurrentDraft(draft);
      toast.success("Draft updated successfully.", "Draft Edited");
    },
    [toast]
  );

  const handleDraftApproved = useCallback(
    (draft: DraftResponse) => {
      setCurrentDraft(draft);
      toast.success("Draft approved and ready to send.", "Draft Approved");
    },
    [toast]
  );

  const handleDraftRejected = useCallback(
    (draft: DraftResponse) => {
      setCurrentDraft(draft);
      toast.warning("Draft rejected. Edit and resubmit, or regenerate.", "Draft Rejected");
    },
    [toast]
  );

  const handleDraftSent = useCallback(
    (result: {
      draftId: string;
      dmId: string;
      status: string;
      sentAt: string;
      platform: string;
    }) => {
      setCurrentDraft((prev) =>
        prev ? { ...prev, status: "sent" } : null
      );

      // Update the selected DM status locally
      setSelectedDM((prev) =>
        prev ? { ...prev, status: "sent" } : null
      );

      toast.success(
        `Reply sent successfully on ${result.platform.charAt(0).toUpperCase() + result.platform.slice(1)}.`,
        "Reply Sent"
      );
    },
    [toast]
  );

  // ─── Lead Handlers ────────────────────────────────────────────────────

  const handleLeadExtracted = useCallback(
    (lead: LeadResponse) => {
      setCurrentLead(lead);

      if (lead.priorityFlag) {
        toast.warning(
          `High-priority lead detected: ${lead.name} (Score: ${lead.score}/10).`,
          "High Priority Lead"
        );
      } else {
        toast.success(
          `Lead extracted: ${lead.name} (Score: ${lead.score}/10).`,
          "Lead Captured"
        );
      }
    },
    [toast]
  );

  const handleSalesforceSync = useCallback(
    (result: { leadId: string; salesforceId: string; success: boolean }) => {
      if (result.success) {
        setCurrentLead((prev) =>
          prev ? { ...prev, salesforceId: result.salesforceId } : null
        );
        toast.success(
          `Lead synced to Salesforce (ID: ${result.salesforceId}).`,
          "Salesforce Sync"
        );
      } else {
        toast.error(
          "Failed to sync lead to Salesforce. Please retry.",
          "Sync Failed"
        );
      }
    },
    [toast]
  );

  const handlePriorityToggle = useCallback(
    (leadId: string, priorityFlag: boolean) => {
      setCurrentLead((prev) =>
        prev && prev.id === leadId ? { ...prev, priorityFlag } : prev
      );

      if (priorityFlag) {
        toast.info("Lead flagged for sales follow-up.", "Priority Updated");
      } else {
        toast.info("Priority flag removed.", "Priority Updated");
      }
    },
    [toast]
  );

  // ─── Error Handler ────────────────────────────────────────────────────

  const handleError = useCallback(
    (error: Error) => {
      toast.error(error.message, "Error");
    },
    [toast]
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar activePath="/" />

        {/* Three-Panel Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: DM Inbox */}
          <div className="w-80 flex-shrink-0 overflow-hidden lg:w-96">
            <DMInboxPanel
              onSelectDM={handleSelectDM}
              selectedDMId={selectedDM?.id ?? null}
              enablePolling
            />
          </div>

          {/* Center Panel: Draft Composer */}
          <div className="flex flex-1 flex-col overflow-hidden border-r border-gray-200 bg-white">
            {selectedDM ? (
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin lg:p-6">
                {isDraftLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-10 w-10 items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-8 w-8 animate-pulse text-stockland-green"
                        aria-hidden="true"
                      >
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                        <path d="M5 3v4" />
                        <path d="M19 17v4" />
                        <path d="M3 5h4" />
                        <path d="M17 19h4" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm text-gray-500">
                      Loading draft...
                    </p>
                  </div>
                ) : (
                  <DraftComposer
                    dm={selectedDM}
                    draft={currentDraft}
                    userId="user-agent-001"
                    onDraftGenerated={handleDraftGenerated}
                    onDraftEdited={handleDraftEdited}
                    onDraftApproved={handleDraftApproved}
                    onDraftRejected={handleDraftRejected}
                    onDraftSent={handleDraftSent}
                    onError={handleError}
                  />
                )}
              </div>
            ) : (
              <EmptySelectionState />
            )}
          </div>

          {/* Right Panel: Lead Capture Sidebar */}
          <div className="hidden w-80 flex-shrink-0 overflow-y-auto bg-gray-50 p-4 scrollbar-thin lg:block xl:w-96">
            {selectedDM ? (
              <LeadCaptureSidebar
                dm={selectedDM}
                lead={currentLead}
                userId="user-agent-001"
                onLeadExtracted={handleLeadExtracted}
                onSalesforceSync={handleSalesforceSync}
                onPriorityToggle={handlePriorityToggle}
                onError={handleError}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-12 text-center shadow-card">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-gray-300"
                  aria-hidden="true"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <h3 className="mt-3 text-sm font-semibold text-gray-500">
                  Lead Capture
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  Select a DM to extract lead data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer position="top-right" maxToasts={5} />
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Providers>
      <ToastProvider>
        <DashboardContent />
      </ToastProvider>
    </Providers>
  );
}