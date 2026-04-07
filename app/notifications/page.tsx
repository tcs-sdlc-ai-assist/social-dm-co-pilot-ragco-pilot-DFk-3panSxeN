"use client";

import { useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ToastProvider, ToastContainer, useToast } from "@/components/ui/Toast";
import Providers from "@/app/providers";
import type { NotificationResponse } from "@/types";

// ─── Notification Page Content ───────────────────────────────────────────────

function NotificationPageContent() {
  const toast = useToast();

  const handleNotificationClick = useCallback(
    (notification: NotificationResponse) => {
      // Navigate to the relevant DM or lead based on notification type
      if (notification.dmId) {
        // In a full implementation, this would use router.push
        // For now, show a toast with the action
        toast.info(
          `Viewing DM from ${notification.dm?.senderName ?? "unknown sender"}.`,
          "Navigate to DM"
        );
      } else if (notification.leadId) {
        toast.info(
          `Viewing lead: ${notification.lead?.name ?? "unknown lead"}.`,
          "Navigate to Lead"
        );
      }
    },
    [toast]
  );

  const handleError = useCallback(
    (error: Error) => {
      toast.error(error.message, "Notification Error");
    },
    [toast]
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar activePath="/notifications" />

        {/* Notification Center */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white">
          <NotificationCenter
            enablePolling
            maxVisible={50}
            onNotificationClick={handleNotificationClick}
            onError={handleError}
          />
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer position="top-right" maxToasts={5} />
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function NotificationsPage() {
  return (
    <Providers>
      <ToastProvider>
        <NotificationPageContent />
      </ToastProvider>
    </Providers>
  );
}