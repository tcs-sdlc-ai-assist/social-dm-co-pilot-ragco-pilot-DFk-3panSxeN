import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),

  AZURE_AD_CLIENT_ID: z.string().min(1, "AZURE_AD_CLIENT_ID is required").optional(),
  AZURE_AD_CLIENT_SECRET: z.string().min(1, "AZURE_AD_CLIENT_SECRET is required").optional(),
  AZURE_AD_TENANT_ID: z.string().min(1, "AZURE_AD_TENANT_ID is required").optional(),

  AZURE_OPENAI_API_KEY: z.string().min(1, "AZURE_OPENAI_API_KEY is required").optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url("AZURE_OPENAI_ENDPOINT must be a valid URL").optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().min(1, "AZURE_OPENAI_DEPLOYMENT_NAME is required").optional(),

  SALESFORCE_API_URL: z.string().url("SALESFORCE_API_URL must be a valid URL").optional(),
  SALESFORCE_API_KEY: z.string().min(1, "SALESFORCE_API_KEY is required").optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type ServerConfig = z.infer<typeof serverSchema>;

function loadConfig(): ServerConfig {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten();
    const fieldErrors = Object.entries(formatted.fieldErrors)
      .map(([field, errors]) => `  ${field}: ${(errors as string[]).join(", ")}`)
      .join("\n");

    console.error("❌ Invalid environment variables:\n" + fieldErrors);

    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment variables:\n" + fieldErrors);
    }

    // In development/test, return a partial config with defaults for optional fields
    return serverSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/social_dm_copilot",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "dev-secret-do-not-use-in-production",
    });
  }

  return parsed.data;
}

export const config = loadConfig();

export const isDevelopment = config.NODE_ENV === "development";
export const isProduction = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";

export const azureOpenAIConfig = {
  apiKey: config.AZURE_OPENAI_API_KEY ?? "",
  endpoint: config.AZURE_OPENAI_ENDPOINT ?? "",
  deploymentName: config.AZURE_OPENAI_DEPLOYMENT_NAME ?? "",
  isConfigured: Boolean(
    config.AZURE_OPENAI_API_KEY &&
    config.AZURE_OPENAI_ENDPOINT &&
    config.AZURE_OPENAI_DEPLOYMENT_NAME
  ),
} as const;

export const azureADConfig = {
  clientId: config.AZURE_AD_CLIENT_ID ?? "",
  clientSecret: config.AZURE_AD_CLIENT_SECRET ?? "",
  tenantId: config.AZURE_AD_TENANT_ID ?? "",
  isConfigured: Boolean(
    config.AZURE_AD_CLIENT_ID &&
    config.AZURE_AD_CLIENT_SECRET &&
    config.AZURE_AD_TENANT_ID
  ),
} as const;

export const salesforceConfig = {
  apiUrl: config.SALESFORCE_API_URL ?? "",
  apiKey: config.SALESFORCE_API_KEY ?? "",
  isConfigured: Boolean(
    config.SALESFORCE_API_URL &&
    config.SALESFORCE_API_KEY
  ),
} as const;

export const authConfig = {
  url: config.NEXTAUTH_URL,
  secret: config.NEXTAUTH_SECRET,
} as const;

export const databaseConfig = {
  url: config.DATABASE_URL,
} as const;