import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Social DM Co-Pilot",
  description:
    "AI-powered social media DM management platform for Stockland sales agents. Streamline lead qualification, draft responses, and CRM integration.",
  keywords: [
    "social media",
    "DM management",
    "lead qualification",
    "AI copilot",
    "Stockland",
    "CRM integration",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}