import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { azureOpenAIConfig, salesforceConfig, azureADConfig } from "@/lib/config";

const startTime = Date.now();

/**
 * GET /api/health
 *
 * Returns health status of the application including:
 * - Overall status (healthy / degraded / unhealthy)
 * - Database connectivity check
 * - External service availability (Azure OpenAI, Salesforce, Azure AD)
 * - Uptime information
 * - Timestamp
 */
export async function GET() {
  const checks: Record<string, { status: string; message: string; latencyMs?: number }> = {};
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Database connectivity check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    checks.database = {
      status: "healthy",
      message: "Database connection successful.",
      latencyMs: dbLatency,
    };
  } catch (error) {
    overallStatus = "unhealthy";
    checks.database = {
      status: "unhealthy",
      message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Azure OpenAI availability check
  if (azureOpenAIConfig.isConfigured) {
    checks.azureOpenAI = {
      status: "healthy",
      message: "Azure OpenAI is configured.",
    };
  } else {
    if (overallStatus === "healthy") {
      overallStatus = "degraded";
    }
    checks.azureOpenAI = {
      status: "degraded",
      message: "Azure OpenAI is not configured. Draft generation will use fallback templates.",
    };
  }

  // Salesforce availability check
  if (salesforceConfig.isConfigured) {
    checks.salesforce = {
      status: "healthy",
      message: "Salesforce API is configured.",
    };
  } else {
    if (overallStatus === "healthy") {
      overallStatus = "degraded";
    }
    checks.salesforce = {
      status: "degraded",
      message: "Salesforce API is not configured. Lead sync will use simulated mode.",
    };
  }

  // Azure AD availability check
  if (azureADConfig.isConfigured) {
    checks.azureAD = {
      status: "healthy",
      message: "Azure AD authentication is configured.",
    };
  } else {
    if (overallStatus === "healthy") {
      overallStatus = "degraded";
    }
    checks.azureAD = {
      status: "degraded",
      message: "Azure AD is not configured. Authentication providers may be limited.",
    };
  }

  // Uptime calculation
  const uptimeMs = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);

  const uptimeFormatted = uptimeDays > 0
    ? `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`
    : uptimeHours > 0
      ? `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`
      : uptimeMinutes > 0
        ? `${uptimeMinutes}m ${uptimeSeconds % 60}s`
        : `${uptimeSeconds}s`;

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: {
        ms: uptimeMs,
        formatted: uptimeFormatted,
      },
      checks,
      version: process.env.npm_package_version ?? "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
    },
    { status: statusCode }
  );
}