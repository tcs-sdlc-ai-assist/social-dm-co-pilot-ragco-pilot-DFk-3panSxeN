# Deployment Guide

Comprehensive deployment guide for the Social DM Co-Pilot application on Vercel with Neon PostgreSQL, Azure AD authentication, Azure OpenAI, and Salesforce CRM integration.

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Neon PostgreSQL Provisioning](#1-neon-postgresql-provisioning)
- [2. Database Setup & Prisma Migrations](#2-database-setup--prisma-migrations)
- [3. Environment Variable Configuration](#3-environment-variable-configuration)
- [4. Vercel Project Configuration](#4-vercel-project-configuration)
- [5. Azure AD Authentication Setup](#5-azure-ad-authentication-setup)
- [6. Azure OpenAI Configuration](#6-azure-openai-configuration)
- [7. Salesforce API Configuration](#7-salesforce-api-configuration)
- [8. CI/CD with GitHub Actions](#8-cicd-with-github-actions)
- [9. Monitoring & Health Checks](#9-monitoring--health-checks)
- [10. Post-Deployment Verification](#10-post-deployment-verification)
- [11. Troubleshooting](#11-troubleshooting)
- [12. Rollback Procedures](#12-rollback-procedures)

---

## Prerequisites

Before deploying, ensure you have:

- [Node.js](https://nodejs.org/) 18.17 or later installed locally
- A [GitHub](https://github.com/) account with the repository cloned
- A [Vercel](https://vercel.com/) account (Team or Hobby plan)
- A [Neon](https://neon.tech/) account for PostgreSQL hosting
- (Optional) An [Azure AD](https://portal.azure.com/) tenant for authentication
- (Optional) An [Azure OpenAI](https://portal.azure.com/) resource for AI draft generation
- (Optional) A [Salesforce](https://developer.salesforce.com/) developer org for CRM sync

---

## 1. Neon PostgreSQL Provisioning

### 1.1 Create a Neon Project

1. Sign in to [Neon Console](https://console.neon.tech/)
2. Click **New Project**
3. Configure the project:
   - **Name:** `social-dm-copilot`
   - **Region:** `Asia Pacific (Sydney)` — closest to Vercel SYD1 region
   - **PostgreSQL Version:** 16 (recommended) or 15
   - **Compute Size:** Autoscaling 0.25–2 CU (adjust based on expected load)
4. Click **Create Project**

### 1.2 Retrieve the Connection String

1. In the Neon dashboard, navigate to your project
2. Click **Connection Details**
3. Select **Prisma** from the connection string dropdown
4. Copy the connection string — it will look like:

```
postgresql://username:password@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/social_dm_copilot?sslmode=require
```

> **Important:** The connection string must include `?sslmode=require` for Neon.

### 1.3 Configure Connection Pooling (Recommended)

For production workloads, enable connection pooling:

1. In the Neon dashboard, go to **Settings** → **Connection Pooling**
2. Enable **PgBouncer** connection pooling
3. Use the pooled connection string for `DATABASE_URL`:

```
postgresql://username:password@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/social_dm_copilot?sslmode=require&pgbouncer=true
```

### 1.4 Create a Branching Strategy (Optional)

Neon supports database branching for staging environments:

```bash
# Create a staging branch from main
neon branches create --name staging --parent main

# Get the staging branch connection string
neon connection-string staging
```

---

## 2. Database Setup & Prisma Migrations

### 2.1 Install Dependencies

```bash
npm install
```

This automatically runs `prisma generate` via the `postinstall` script.

### 2.2 Push Schema to Database

For initial deployment, push the Prisma schema directly:

```bash
# Set the DATABASE_URL environment variable
export DATABASE_URL="postgresql://username:password@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/social_dm_copilot?sslmode=require"

# Push the schema to the database
npx prisma db push
```

This creates all 6 tables defined in `prisma/schema.prisma`:

| Table | Description |
|---|---|
| `users` | Sales agents and managers with role-based access |
| `dms` | Incoming social media direct messages |
| `drafts` | AI-generated draft responses with confidence scores |
| `leads` | Extracted lead data with scores and priority flags |
| `notifications` | System notifications (SLA breach, high-priority lead, sync status) |
| `audit_logs` | Comprehensive audit trail for all system actions |

### 2.3 Seed the Database (Optional)

To populate the database with sample data for testing:

```bash
npx prisma db seed
```

This creates:
- 2 users (1 agent, 1 manager)
- 5 DMs across Instagram and Facebook
- 5 AI-generated drafts with confidence scores
- 5 leads with scores and priority flags
- 5 notifications
- 3 audit log entries

### 2.4 Verify Database Connection

```bash
npx prisma studio
```

This opens a browser-based GUI at `http://localhost:5555` where you can inspect the database tables and data.

### 2.5 Prisma Migration Commands Reference

| Command | Description |
|---|---|
| `npx prisma db push` | Push schema changes to the database (no migration history) |
| `npx prisma generate` | Regenerate the Prisma Client |
| `npx prisma studio` | Open the database GUI |
| `npx prisma db seed` | Run the seed script |
| `npx prisma format` | Format the schema file |
| `npx prisma validate` | Validate the schema file |

> **Note:** This project uses `prisma db push` rather than `prisma migrate` for simplicity during the pilot phase. For production with multiple environments, consider switching to `prisma migrate dev` and `prisma migrate deploy` for migration history tracking.

---

## 3. Environment Variable Configuration

### 3.1 Required Variables

These variables **must** be set for the application to start:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string with SSL | `postgresql://user:pass@host/db?sslmode=require` |
| `NEXTAUTH_URL` | Base URL of the deployed application | `https://social-dm-copilot.vercel.app` |
| `NEXTAUTH_SECRET` | Secret key for NextAuth.js JWT encryption | (see generation command below) |

### 3.2 Generate NEXTAUTH_SECRET

Generate a secure random secret:

```bash
openssl rand -base64 32
```

Example output: `K7gNz3pQ1mR8xW4vB9tY2uA5cE0fH6jL1nO3qS7wZ=`

> **Security:** Never commit this value to source control. Always set it via environment variables.

### 3.3 Optional Variables — Azure AD

Required only if you want Azure AD authentication (recommended for production):

| Variable | Description | Where to Find |
|---|---|---|
| `AZURE_AD_CLIENT_ID` | Application (client) ID | Azure Portal → App Registrations → Overview |
| `AZURE_AD_CLIENT_SECRET` | Client secret value | Azure Portal → App Registrations → Certificates & Secrets |
| `AZURE_AD_TENANT_ID` | Directory (tenant) ID | Azure Portal → App Registrations → Overview |

> **Development Mode:** When Azure AD is not configured, authentication is bypassed automatically. A default "agent" role is assigned to all sessions.

### 3.4 Optional Variables — Azure OpenAI

Required only if you want AI-powered draft generation (recommended):

| Variable | Description | Where to Find |
|---|---|---|
| `AZURE_OPENAI_API_KEY` | API key for Azure OpenAI | Azure Portal → OpenAI Resource → Keys and Endpoint |
| `AZURE_OPENAI_ENDPOINT` | Endpoint URL | Azure Portal → OpenAI Resource → Keys and Endpoint |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Model deployment name | Azure Portal → OpenAI Resource → Model Deployments |

> **Fallback Mode:** When Azure OpenAI is not configured, draft generation uses a template-based fallback system with the knowledge base. Confidence scores will typically be lower than GPT-generated drafts.

### 3.5 Optional Variables — Salesforce

Required only if you want live Salesforce CRM sync:

| Variable | Description | Where to Find |
|---|---|---|
| `SALESFORCE_API_URL` | REST API base URL | Salesforce Setup → Company Information |
| `SALESFORCE_API_KEY` | Bearer token for API access | Salesforce Setup → Connected Apps |

> **Simulated Mode:** When Salesforce is not configured, lead sync operates in simulated mode with generated Salesforce IDs (18-character format) and a 5% simulated failure rate for realistic error handling testing.

### 3.6 Complete .env Example

```bash
# ─── Required ─────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/social_dm_copilot?sslmode=require"
NEXTAUTH_URL="https://social-dm-copilot.vercel.app"
NEXTAUTH_SECRET="K7gNz3pQ1mR8xW4vB9tY2uA5cE0fH6jL1nO3qS7wZ="

# ─── Azure AD (Optional) ─────────────────────────────────────────────────────
AZURE_AD_CLIENT_ID="12345678-abcd-efgh-ijkl-123456789012"
AZURE_AD_CLIENT_SECRET="your-client-secret-value"
AZURE_AD_TENANT_ID="87654321-dcba-hgfe-lkji-210987654321"

# ─── Azure OpenAI (Optional) ─────────────────────────────────────────────────
AZURE_OPENAI_API_KEY="your-azure-openai-api-key"
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4"

# ─── Salesforce (Optional) ───────────────────────────────────────────────────
SALESFORCE_API_URL="https://your-instance.salesforce.com/services/data/v59.0"
SALESFORCE_API_KEY="your-salesforce-bearer-token"
```

---

## 4. Vercel Project Configuration

### 4.1 Connect GitHub Repository

1. Sign in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Select **Import Git Repository**
4. Choose the `social-dm-copilot` repository
5. Click **Import**

### 4.2 Configure Build Settings

Vercel should auto-detect the Next.js framework. Verify these settings:

| Setting | Value |
|---|---|
| **Framework Preset** | Next.js |
| **Build Command** | `next build` (default) |
| **Output Directory** | `.next` (default) |
| **Install Command** | `npm install` (default) |
| **Node.js Version** | 18.x or 20.x |

### 4.3 Set Environment Variables

In the Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add each variable from [Section 3](#3-environment-variable-configuration)
3. For each variable, select the appropriate environments:
   - **Production** — for the main deployment
   - **Preview** — for pull request preview deployments
   - **Development** — for `vercel dev` local development

| Variable | Production | Preview | Development |
|---|---|---|---|
| `DATABASE_URL` | ✅ Production DB | ✅ Staging DB (or same) | ✅ Local DB |
| `NEXTAUTH_URL` | ✅ Production URL | ✅ Auto (Vercel sets this) | ✅ `http://localhost:3000` |
| `NEXTAUTH_SECRET` | ✅ | ✅ | ✅ |
| `AZURE_AD_CLIENT_ID` | ✅ | ✅ | ❌ (optional) |
| `AZURE_AD_CLIENT_SECRET` | ✅ | ✅ | ❌ (optional) |
| `AZURE_AD_TENANT_ID` | ✅ | ✅ | ❌ (optional) |
| `AZURE_OPENAI_API_KEY` | ✅ | ✅ | ❌ (optional) |
| `AZURE_OPENAI_ENDPOINT` | ✅ | ✅ | ❌ (optional) |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | ✅ | ✅ | ❌ (optional) |
| `SALESFORCE_API_URL` | ✅ | ❌ | ❌ |
| `SALESFORCE_API_KEY` | ✅ | ❌ | ❌ |

> **Tip:** Use Vercel's [Environment Variable References](https://vercel.com/docs/projects/environment-variables) (`@variable-name`) for sensitive values. The `vercel.json` file already references variables using this pattern.

### 4.4 Configure Region

The `vercel.json` file is pre-configured for the Sydney region:

```json
{
  "regions": ["syd1"]
}
```

This ensures the serverless functions run in the `syd1` (Sydney, Australia) region, minimising latency to the Neon database (also in `ap-southeast-1`) and Australian end users.

### 4.5 Configure Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain (e.g., `dm-copilot.stockland.com.au`)
3. Follow the DNS configuration instructions
4. Update `NEXTAUTH_URL` to match the custom domain

### 4.6 Deploy

Vercel automatically deploys on push to the `main` branch. To trigger a manual deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

### 4.7 Vercel Configuration Reference

The `vercel.json` file includes:

- **Standalone output mode** for optimised builds
- **Security headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **No-cache headers** for all API routes (`/api/*`)
- **SPA rewrites** for client-side routing

---

## 5. Azure AD Authentication Setup

### 5.1 Register an Application

1. Sign in to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name:** `Social DM Co-Pilot`
   - **Supported account types:** Accounts in this organizational directory only (Single tenant)
   - **Redirect URI:** Web — `https://social-dm-copilot.vercel.app/api/auth/callback/azure-ad`
5. Click **Register**

### 5.2 Configure Client Secret

1. In the app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Set description: `Social DM Co-Pilot Production`
4. Set expiry: 24 months (recommended)
5. Click **Add**
6. **Copy the secret value immediately** — it will not be shown again

### 5.3 Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph**
3. Select **Delegated permissions**
4. Add:
   - `User.Read` (Sign in and read user profile)
   - `email` (View users' email address)
   - `profile` (View users' basic profile)
5. Click **Grant admin consent** (requires admin privileges)

### 5.4 Note the Required Values

From the app registration **Overview** page, copy:

- **Application (client) ID** → `AZURE_AD_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`

From **Certificates & secrets**:

- **Client secret value** → `AZURE_AD_CLIENT_SECRET`

### 5.5 Add Redirect URIs for Preview Deployments

For Vercel preview deployments, add additional redirect URIs:

1. Go to **Authentication** → **Platform configurations** → **Web**
2. Add redirect URIs:
   - `https://social-dm-copilot.vercel.app/api/auth/callback/azure-ad` (production)
   - `https://social-dm-copilot-*.vercel.app/api/auth/callback/azure-ad` (preview — note: Azure AD does not support wildcards; add specific preview URLs as needed)

### 5.6 User Role Mapping

The application maps Azure AD users to roles stored in the `users` database table:

| Role | Description | Access Level |
|---|---|---|
| `agent` | Sales agent | DM inbox, draft composer, lead capture |
| `manager` | Sales manager | All agent access + SLA monitoring, escalation management |
| `admin` | System administrator | Full access including settings and configuration |

Users are matched by email address. If a user signs in with an email not in the database, they are assigned the default `agent` role.

To add users to the database:

```sql
INSERT INTO users (id, name, email, role)
VALUES
  (gen_random_uuid(), 'Alex Thompson', 'alex.thompson@stockland.com.au', 'agent'),
  (gen_random_uuid(), 'Rachel Chen', 'rachel.chen@stockland.com.au', 'manager');
```

---

## 6. Azure OpenAI Configuration

### 6.1 Create an Azure OpenAI Resource

1. Sign in to [Azure Portal](https://portal.azure.com/)
2. Click **Create a resource** → search for **Azure OpenAI**
3. Configure:
   - **Subscription:** Your Azure subscription
   - **Resource group:** Create or select a resource group
   - **Region:** `Australia East` (closest to SYD1)
   - **Name:** `stockland-dm-copilot-openai`
   - **Pricing tier:** Standard S0
4. Click **Review + create** → **Create**

### 6.2 Deploy a Model

1. In the Azure OpenAI resource, go to **Model deployments**
2. Click **Create new deployment**
3. Configure:
   - **Model:** `gpt-4` (recommended) or `gpt-4o`
   - **Deployment name:** `gpt-4` (this becomes `AZURE_OPENAI_DEPLOYMENT_NAME`)
   - **Tokens per minute rate limit:** 30K TPM (adjust based on expected volume)
4. Click **Create**

### 6.3 Retrieve API Credentials

1. In the Azure OpenAI resource, go to **Keys and Endpoint**
2. Copy:
   - **KEY 1** or **KEY 2** → `AZURE_OPENAI_API_KEY`
   - **Endpoint** → `AZURE_OPENAI_ENDPOINT` (e.g., `https://stockland-dm-copilot-openai.openai.azure.com`)

### 6.4 Rate Limiting & Retry Configuration

The draft generator service includes built-in retry logic:

- **Max retries:** 3 attempts
- **Backoff strategy:** Exponential (1s, 2s, 4s)
- **Rate limit handling:** Automatic retry on HTTP 429 with `Retry-After` header
- **Fallback:** Template-based generation if all retries fail

### 6.5 Cost Estimation

Approximate costs for Azure OpenAI GPT-4 (as of November 2024):

| Metric | Estimate |
|---|---|
| Average tokens per draft | ~800 tokens (input + output) |
| Cost per 1K tokens (GPT-4) | ~$0.03 input / ~$0.06 output |
| Cost per draft | ~$0.03–$0.05 |
| 100 drafts/day | ~$3–$5/day |
| 3,000 drafts/month | ~$90–$150/month |

> **Tip:** Use `gpt-4o-mini` for lower costs during the pilot phase (~10x cheaper than GPT-4).

---

## 7. Salesforce API Configuration

### 7.1 Create a Connected App

1. Sign in to [Salesforce Setup](https://login.salesforce.com/)
2. Navigate to **Setup** → **App Manager** → **New Connected App**
3. Configure:
   - **Connected App Name:** `Social DM Co-Pilot`
   - **API Name:** `Social_DM_Co_Pilot`
   - **Contact Email:** Your admin email
   - **Enable OAuth Settings:** ✅
   - **Callback URL:** `https://social-dm-copilot.vercel.app/api/auth/callback/salesforce` (or any valid URL — not used for server-to-server)
   - **Selected OAuth Scopes:**
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
4. Click **Save**

### 7.2 Generate API Credentials

For server-to-server integration, use the OAuth 2.0 Client Credentials flow or a pre-generated bearer token:

**Option A: Bearer Token (Simpler for Pilot)**

1. In Salesforce, go to **Setup** → **My Personal Information** → **Reset My Security Token**
2. Combine your password + security token for API access
3. Use the Salesforce REST API to obtain a session token:

```bash
curl -X POST https://login.salesforce.com/services/oauth2/token \
  -d "grant_type=password" \
  -d "client_id=YOUR_CONSUMER_KEY" \
  -d "client_secret=YOUR_CONSUMER_SECRET" \
  -d "username=YOUR_USERNAME" \
  -d "password=YOUR_PASSWORD_AND_TOKEN"
```

4. Copy the `access_token` from the response → `SALESFORCE_API_KEY`

**Option B: Connected App with Client Credentials (Recommended for Production)**

1. Enable **Client Credentials Flow** in the Connected App settings
2. Assign a **Run As** user with appropriate permissions
3. Generate tokens programmatically (requires custom implementation)

### 7.3 Determine API URL

Your Salesforce API URL depends on your instance:

- **Production:** `https://your-instance.salesforce.com/services/data/v59.0`
- **Sandbox:** `https://your-instance--sandbox.sandbox.my.salesforce.com/services/data/v59.0`
- **Developer Org:** `https://your-dev-org.develop.my.salesforce.com/services/data/v59.0`

Set this as `SALESFORCE_API_URL`.

### 7.4 Custom Fields

The Salesforce sync service maps leads to standard and custom fields. Ensure these custom fields exist on the Lead object in Salesforce:

| API Name | Type | Description |
|---|---|---|
| `Custom_Budget__c` | Text(255) | Customer's stated budget |
| `Custom_Location__c` | Text(255) | Preferred community/location |
| `Custom_Intent__c` | Text Area(1000) | Detected purchase intent |
| `Custom_Score__c` | Number(4,1) | Lead score (0–10) |
| `Custom_Priority__c` | Checkbox | High-priority flag |
| `Custom_DM_Id__c` | Text(255) | Source DM identifier |
| `Custom_Platform__c` | Text(50) | Source platform (Instagram/Facebook) |

Create these fields in Salesforce:

1. Go to **Setup** → **Object Manager** → **Lead** → **Fields & Relationships**
2. Click **New** for each custom field
3. Configure the field type and API name as specified above

### 7.5 Retry & Error Handling

The Salesforce sync service includes:

- **Max retries:** 3 attempts with exponential backoff (1s, 2s, 4s)
- **Rate limit handling:** Automatic retry on HTTP 429
- **Simulated mode:** 5% failure rate for realistic testing when Salesforce is not configured
- **Audit logging:** All sync attempts (success and failure) are logged

---

## 8. CI/CD with GitHub Actions

### 8.1 Workflow File

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
  NEXTAUTH_URL: "http://localhost:3000"

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run lint

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build

  deploy:
    name: Deploy to Vercel
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"
```

### 8.2 Required GitHub Secrets

Add these secrets in **GitHub** → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Description | How to Obtain |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Neon Console → Connection Details |
| `NEXTAUTH_SECRET` | NextAuth.js JWT secret | `openssl rand -base64 32` |
| `VERCEL_TOKEN` | Vercel API token | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization/team ID | Vercel Dashboard → Settings → General |
| `VERCEL_PROJECT_ID` | Vercel project ID | Vercel Dashboard → Project → Settings → General |

### 8.3 Branch Protection Rules

Configure branch protection on `main`:

1. Go to **GitHub** → **Settings** → **Branches** → **Branch protection rules**
2. Add rule for `main`:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Select: `Lint`, `Test`, `Build`
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging

### 8.4 Preview Deployments

Vercel automatically creates preview deployments for every pull request. Each preview deployment:

- Has a unique URL (e.g., `social-dm-copilot-abc123.vercel.app`)
- Uses the **Preview** environment variables
- Is linked in the GitHub pull request as a deployment status

### 8.5 Database Migrations in CI

For the pilot phase, database schema changes are applied manually using `prisma db push`. For a production CI pipeline with migration history:

```yaml
  migrate:
    name: Database Migration
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npx prisma db push
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## 9. Monitoring & Health Checks

### 9.1 Health Check Endpoint

The application exposes a health check endpoint at:

```
GET /api/health
```

**Response (healthy):**

```json
{
  "status": "healthy",
  "timestamp": "2024-11-15T10:30:00.000Z",
  "uptime": {
    "ms": 3600000,
    "formatted": "1h 0m 0s"
  },
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful.",
      "latencyMs": 12
    },
    "azureOpenAI": {
      "status": "healthy",
      "message": "Azure OpenAI is configured."
    },
    "salesforce": {
      "status": "healthy",
      "message": "Salesforce API is configured."
    },
    "azureAD": {
      "status": "healthy",
      "message": "Azure AD authentication is configured."
    }
  },
  "version": "0.1.0",
  "environment": "production"
}
```

**Response (degraded — optional services not configured):**

```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "healthy" },
    "azureOpenAI": { "status": "degraded", "message": "Azure OpenAI is not configured. Draft generation will use fallback templates." },
    "salesforce": { "status": "degraded", "message": "Salesforce API is not configured. Lead sync will use simulated mode." },
    "azureAD": { "status": "degraded", "message": "Azure AD is not configured. Authentication providers may be limited." }
  }
}
```

**Response (unhealthy — database down):**

```json
{
  "status": "unhealthy",
  "checks": {
    "database": { "status": "unhealthy", "message": "Database connection failed: Connection refused" }
  }
}
```

**HTTP Status Codes:**

| Status | Meaning |
|---|---|
| `200` | Healthy or degraded (application is running) |
| `503` | Unhealthy (critical service failure — e.g., database down) |

### 9.2 Vercel Monitoring

Vercel provides built-in monitoring:

1. **Vercel Dashboard** → **Analytics** — request volume, response times, error rates
2. **Vercel Dashboard** → **Logs** — real-time and historical function logs
3. **Vercel Dashboard** → **Speed Insights** — Core Web Vitals and performance metrics

### 9.3 Uptime Monitoring (Recommended)

Set up an external uptime monitor to ping the health endpoint:

**Using Vercel Cron Jobs:**

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/sla-monitor",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This checks health every 5 minutes and runs SLA breach detection every 5 minutes.

**Using External Services:**

- [UptimeRobot](https://uptimerobot.com/) — free tier supports 50 monitors
- [Better Uptime](https://betteruptime.com/) — free tier with status pages
- [Checkly](https://www.checklyhq.com/) — API monitoring with assertions

Configure the monitor to:
- **URL:** `https://social-dm-copilot.vercel.app/api/health`
- **Method:** GET
- **Interval:** 5 minutes
- **Expected status:** 200
- **Alert on:** Status 503 or timeout

### 9.4 SLA Monitoring

The SLA monitor endpoint checks for DMs that have been in "new" status longer than the 1-hour threshold:

```
POST /api/sla-monitor
```

Returns a summary of breached DMs, notifications created, and escalations triggered.

```
GET /api/sla-monitor?config=true&breached=true
```

Returns the current SLA status summary with configuration details and breached DM list.

### 9.5 Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|---|---|---|
| Health check status | `GET /api/health` | Status ≠ 200 |
| Database latency | Health check `latencyMs` | > 500ms |
| SLA breaches | `GET /api/sla-monitor` | `breachedSLA` > 0 |
| Unread notifications | `GET /api/notifications?countOnly=true` | > 50 unread |
| Error rate | Vercel Analytics | > 5% of requests |
| Response time (P95) | Vercel Analytics | > 3000ms |
| Serverless function duration | Vercel Logs | > 10s |

### 9.6 Log Monitoring

Application logs are available in Vercel's log viewer. Key log patterns to watch:

| Pattern | Severity | Meaning |
|---|---|---|
| `❌ Failed to` | Error | Service operation failure |
| `⚠️ Failed to` | Warning | Non-critical operation failure (e.g., notification) |
| `✅ Seed data created` | Info | Database seeded successfully |
| `PII detected` | Audit | PII found in DM content |
| `SLA breach` | Alert | DM exceeded response time threshold |

---

## 10. Post-Deployment Verification

After deploying, run through this checklist to verify the deployment:

### 10.1 Health Check

```bash
curl -s https://social-dm-copilot.vercel.app/api/health | jq .
```

Expected: `status` is `"healthy"` or `"degraded"` (degraded is acceptable if optional services are not configured).

### 10.2 Database Connectivity

```bash
curl -s https://social-dm-copilot.vercel.app/api/health | jq '.checks.database'
```

Expected: `status` is `"healthy"` with `latencyMs` < 100ms.

### 10.3 Ingest Simulated DMs

```bash
curl -X POST https://social-dm-copilot.vercel.app/api/dms \
  -H "Content-Type: application/json" \
  -d '{"simulate": true}'
```

Expected: Response with `ingested: 30` and `errors: 0`.

### 10.4 List DMs

```bash
curl -s https://social-dm-copilot.vercel.app/api/dms?page=1&limit=5 | jq '.total'
```

Expected: Total count ≥ 30 (simulated DMs).

### 10.5 Generate a Draft

```bash
curl -X POST https://social-dm-copilot.vercel.app/api/dms/dm-001/draft \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: Response with `draftId`, `content`, and `confidenceScore`.

### 10.6 Extract a Lead

```bash
curl -X POST https://social-dm-copilot.vercel.app/api/leads/extract \
  -H "Content-Type: application/json" \
  -d '{"dmId": "dm-001"}'
```

Expected: Response with `lead` object containing `name`, `score`, and `priorityFlag`.

### 10.7 Check SLA Status

```bash
curl -s https://social-dm-copilot.vercel.app/api/sla-monitor?config=true | jq .
```

Expected: Response with `summary` and `config` objects.

### 10.8 UI Verification

1. Open `https://social-dm-copilot.vercel.app` in a browser
2. Verify the three-panel dashboard loads:
   - Left panel: DM Inbox with messages
   - Center panel: Draft Composer (empty state until DM selected)
   - Right panel: Lead Capture Sidebar (empty state until DM selected)
3. Select a DM from the inbox
4. Verify the draft composer shows the original message and generates a draft
5. Verify the lead capture sidebar extracts lead data

---

## 11. Troubleshooting

### 11.1 Build Failures

**Error: `NEXTAUTH_SECRET environment variable is required in production`**

The `next.config.mjs` enforces `NEXTAUTH_SECRET` in production. Ensure the variable is set in Vercel environment variables.

**Error: `DATABASE_URL environment variable is required in production`**

The `next.config.mjs` enforces `DATABASE_URL` in production. Ensure the variable is set in Vercel environment variables.

**Error: `prisma generate` fails during build**

The `postinstall` script runs `prisma generate`. Ensure `prisma` is in `devDependencies` and `@prisma/client` is in `dependencies`.

### 11.2 Database Connection Issues

**Error: `Connection refused` or `ECONNREFUSED`**

- Verify the `DATABASE_URL` is correct and includes `?sslmode=require`
- Check that the Neon project is active (not suspended due to inactivity)
- Verify the IP allowlist in Neon (if configured)

**Error: `prepared statement already exists`**

This occurs with connection pooling. Ensure the connection string includes `&pgbouncer=true` when using Neon's connection pooler.

**Error: `too many connections`**

- Enable connection pooling in Neon
- The Prisma client singleton in `src/lib/db.ts` prevents multiple client instances in development

### 11.3 Authentication Issues

**Error: `OAUTH_CALLBACK_ERROR` or redirect loop**

- Verify `NEXTAUTH_URL` matches the actual deployment URL exactly (including `https://`)
- Verify the redirect URI in Azure AD matches: `{NEXTAUTH_URL}/api/auth/callback/azure-ad`
- Check that the Azure AD client secret has not expired

**Error: Authentication bypassed in production**

- Ensure `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, and `AZURE_AD_TENANT_ID` are all set
- The middleware bypasses auth only when `NODE_ENV` is `development` or `test` AND Azure AD is not configured

### 11.4 Azure OpenAI Issues

**Error: `Azure OpenAI API error (401)`**

- Verify the `AZURE_OPENAI_API_KEY` is correct
- Check that the key has not been rotated or expired

**Error: `Azure OpenAI API error (404)`**

- Verify the `AZURE_OPENAI_ENDPOINT` URL is correct
- Verify the `AZURE_OPENAI_DEPLOYMENT_NAME` matches an active deployment

**Error: `Azure OpenAI API error (429)`**

- The service automatically retries with exponential backoff
- If persistent, increase the TPM (tokens per minute) rate limit in Azure Portal
- Consider using `gpt-4o-mini` for lower rate limit consumption

### 11.5 Salesforce Issues

**Error: `INVALID_SESSION_ID`**

- The bearer token has expired — regenerate it
- Consider implementing OAuth 2.0 refresh token flow for production

**Error: `UNABLE_TO_LOCK_ROW`**

- This is a transient Salesforce error — the retry logic handles it automatically
- If persistent, check for conflicting automation rules in Salesforce

**Error: Custom field not found**

- Ensure all custom fields from [Section 7.4](#74-custom-fields) are created on the Lead object
- Verify the API names match exactly (including `__c` suffix)

### 11.6 Performance Issues

**Slow API responses (> 3s)**

- Check database latency via the health endpoint
- Verify the Vercel function region matches the database region (both should be in Sydney/ap-southeast-1)
- Check for N+1 query issues in Prisma (use `include` for related data)

**Cold start latency**

- Vercel serverless functions have cold starts (~500ms–2s)
- The health check cron job (every 5 minutes) helps keep functions warm
- Consider Vercel's [Fluid Compute](https://vercel.com/docs/functions/fluid-compute) for reduced cold starts

---

## 12. Rollback Procedures

### 12.1 Vercel Rollback

To rollback to a previous deployment:

1. Go to **Vercel Dashboard** → **Deployments**
2. Find the last known good deployment
3. Click the **⋮** menu → **Promote to Production**

Or via CLI:

```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url>
```

### 12.2 Database Rollback

Since the project uses `prisma db push` (no migration history), database rollbacks require manual intervention:

1. **Neon Point-in-Time Recovery:**
   - Neon supports point-in-time recovery (PITR)
   - In the Neon Console, go to **Branches** → **Restore**
   - Select the timestamp to restore to

2. **Manual Schema Rollback:**
   ```bash
   # Revert to a previous schema version
   git checkout <previous-commit> -- prisma/schema.prisma
   npx prisma db push
   ```

### 12.3 Environment Variable Rollback

If a deployment fails due to environment variable changes:

1. Go to **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Revert the changed variable to its previous value
3. Trigger a redeployment: **Deployments** → latest → **Redeploy**

---

## Quick Reference

### Deployment Checklist

- [ ] Neon PostgreSQL project created in `ap-southeast-1` region
- [ ] `DATABASE_URL` connection string obtained with `?sslmode=require`
- [ ] `NEXTAUTH_SECRET` generated with `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` set to the production URL
- [ ] Database schema pushed with `npx prisma db push`
- [ ] Database seeded with `npx prisma db seed` (optional)
- [ ] Vercel project connected to GitHub repository
- [ ] All environment variables set in Vercel dashboard
- [ ] Vercel region set to `syd1`
- [ ] Azure AD app registered with correct redirect URIs (optional)
- [ ] Azure OpenAI resource created with model deployment (optional)
- [ ] Salesforce Connected App created with custom fields (optional)
- [ ] GitHub Actions secrets configured
- [ ] Branch protection rules enabled on `main`
- [ ] Health check endpoint returning `200`
- [ ] Simulated DMs ingested successfully
- [ ] Draft generation working (GPT or fallback)
- [ ] Lead extraction and scoring working
- [ ] UI loading correctly with three-panel layout

### Useful Commands

```bash
# Local development
npm run dev                          # Start dev server at http://localhost:3000
npm run build                        # Build for production
npm start                            # Start production server
npm test                             # Run test suite
npm run lint                         # Run ESLint

# Database
npm run db:push                      # Push schema to database
npm run db:seed                      # Seed sample data
npm run db:studio                    # Open Prisma Studio GUI

# Vercel
vercel                               # Deploy to preview
vercel --prod                        # Deploy to production
vercel env pull .env.local           # Pull env vars to local file
vercel logs                          # View function logs
vercel ls                            # List deployments

# Health check
curl https://your-app.vercel.app/api/health

# Ingest simulated DMs
curl -X POST https://your-app.vercel.app/api/dms -H "Content-Type: application/json" -d '{"simulate": true}'

# Check SLA status
curl https://your-app.vercel.app/api/sla-monitor?config=true&breached=true
```