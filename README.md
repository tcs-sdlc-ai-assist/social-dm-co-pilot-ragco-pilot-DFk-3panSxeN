# Social DM Co-Pilot

AI-powered social media DM management platform for Stockland sales agents. Streamline lead qualification, draft responses, and CRM integration across Instagram and Facebook.

## Overview

Social DM Co-Pilot is a three-panel dashboard application that helps Stockland sales agents manage incoming social media direct messages. The platform uses AI (Azure OpenAI GPT) with Retrieval-Augmented Generation (RAG) to draft contextual responses, extract structured lead data, score leads using a rule-based algorithm, and sync qualified leads to Salesforce CRM.

### Key Features

- **DM Inbox & Ingestion** — Three-panel dashboard with real-time DM polling, filtering by status/platform, and free-text search
- **AI Draft Generation (RAG + GPT)** — Context-aware draft responses using Stockland's knowledge base (6 communities, 26 listings, 20 FAQs, 11 templates)
- **Human-in-the-Loop Review** — Mandatory review for low-confidence drafts, edit-before-approve enforcement, and compliance validation
- **Lead Extraction & Scoring** — Rule-based pattern matching with optional GPT-assisted extraction; six-dimension scoring algorithm (max 10 points)
- **Salesforce CRM Sync** — Live API integration with simulated mode for pilot; retry logic with exponential backoff
- **Notification Center & SLA Monitoring** — 10 notification types, SLA breach detection (1-hour threshold), automatic escalation at 2× threshold
- **Privacy Compliance & PII Redaction** — Australian-specific PII detection (TFN, Medicare, BSB, passport, drivers licence, credit cards, phone, email, addresses, DOB)
- **Authentication & Authorization** — NextAuth.js with Azure AD provider; role-based access (agent, manager, admin)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Database | [PostgreSQL](https://www.postgresql.org/) via [Neon](https://neon.tech/) |
| ORM | [Prisma 5](https://www.prisma.io/) |
| Authentication | [NextAuth.js 4](https://next-auth.js.org/) with Azure AD |
| AI | [Azure OpenAI](https://azure.microsoft.com/en-au/products/ai-services/openai-service) (GPT-4) |
| CRM | [Salesforce](https://www.salesforce.com/) REST API |
| Deployment | [Vercel](https://vercel.com/) (SYD1 region) |
| Testing | [Jest 29](https://jestjs.io/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) |

## Folder Structure

```
social-dm-copilot/
├── app/                          # Next.js App Router pages & API routes
│   ├── api/
│   │   ├── auth/nextauth/        # NextAuth.js route handler
│   │   ├── dms/                  # DM ingestion & listing endpoints
│   │   │   └── [dmId]/
│   │   │       ├── draft/        # Draft generation & retrieval
│   │   │       └── status/       # DM status transitions
│   │   ├── drafts/
│   │   │   └── [draftId]/        # Draft edit, approve, reject, send
│   │   │       └── send/         # Dedicated send endpoint
│   │   ├── health/               # Health check endpoint
│   │   ├── leads/
│   │   │   ├── extract/          # Lead extraction (single, batch, preview)
│   │   │   ├── salesforce/       # Salesforce sync & unsynced queue
│   │   │   └── score/            # Lead scoring (by ID or ad-hoc)
│   │   ├── notifications/        # Notification CRUD & mark-all-read
│   │   └── sla-monitor/          # SLA breach check & status summary
│   ├── notifications/            # Notifications page
│   ├── error.tsx                 # Global error boundary
│   ├── globals.css               # Tailwind base styles & Stockland tokens
│   ├── layout.tsx                # Root layout with metadata
│   ├── loading.tsx               # Dashboard loading skeleton
│   ├── page.tsx                  # Main dashboard (three-panel layout)
│   └── providers.tsx             # NextAuth SessionProvider
├── prisma/
│   ├── schema.prisma             # Database schema (6 models)
│   └── seed.ts                   # Sample data seeder
├── src/
│   ├── components/
│   │   ├── composer/             # DraftComposer, DraftActions
│   │   ├── inbox/                # DMInboxPanel, DMInboxItem, DMInboxFilters
│   │   ├── layout/               # Header, Sidebar
│   │   ├── leads/                # LeadCaptureSidebar, LeadScoreDisplay
│   │   ├── notifications/        # NotificationCenter, NotificationBell, NotificationItem
│   │   └── ui/                   # Button, StatusBadge, ConfidenceMeter, PriorityFlag, Toast
│   ├── data/
│   │   ├── knowledge-base.json   # Stockland communities, listings, FAQs, templates
│   │   └── simulated-dms.json    # 30 simulated DMs for pilot testing
│   ├── hooks/
│   │   ├── useDMs.ts             # DM inbox state management with polling
│   │   ├── useNotifications.ts   # Notification state management with polling
│   │   └── usePolling.ts         # Generic polling hook
│   ├── lib/
│   │   ├── config.ts             # Environment variable validation (Zod)
│   │   ├── constants.ts          # SLA thresholds, scoring constants, labels
│   │   └── db.ts                 # Prisma client singleton
│   ├── services/
│   │   ├── audit-logger.ts       # Comprehensive audit logging
│   │   ├── dm-ingestion.ts       # DM normalisation, PII check, persistence
│   │   ├── dm-status-tracker.ts  # Status state machine with transition validation
│   │   ├── draft-composer.ts     # Edit, approve, reject, send workflows
│   │   ├── draft-generator.ts    # RAG pipeline with Azure OpenAI + fallback
│   │   ├── lead-extractor.ts     # Rule-based + GPT-assisted lead extraction
│   │   ├── lead-scorer.ts        # Six-dimension scoring algorithm
│   │   ├── notification-manager.ts # Notification CRUD, SLA breach, escalation
│   │   ├── privacy-compliance.ts # PII detection & redaction (Australian types)
│   │   ├── salesforce-sync.ts    # Live + simulated Salesforce API
│   │   └── sla-monitor.ts        # SLA breach detection & escalation
│   └── types.ts                  # Shared TypeScript types & enums
├── middleware.ts                  # Route protection (NextAuth JWT)
├── .env.example                  # Environment variable template
├── jest.config.ts                # Jest configuration
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies & scripts
├── postcss.config.js             # PostCSS (Tailwind)
├── tailwind.config.ts            # Tailwind configuration with Stockland tokens
├── tsconfig.json                 # TypeScript configuration
└── vercel.json                   # Vercel deployment configuration
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18.17 or later
- [npm](https://www.npmjs.com/) 9 or later
- [PostgreSQL](https://www.postgresql.org/) 14 or later (or a [Neon](https://neon.tech/) database)
- (Optional) [Azure AD](https://azure.microsoft.com/en-au/products/active-directory) tenant for authentication
- (Optional) [Azure OpenAI](https://azure.microsoft.com/en-au/products/ai-services/openai-service) resource for AI draft generation
- (Optional) [Salesforce](https://www.salesforce.com/) developer org for CRM sync

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/stockland/social-dm-copilot.git
cd social-dm-copilot
```

### 2. Install Dependencies

```bash
npm install
```

This will also run `prisma generate` automatically via the `postinstall` script.

### 3. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) below for details on each variable.

### 4. Set Up the Database

Push the Prisma schema to your database:

```bash
npm run db:push
```

Seed the database with sample data (2 users, 5 DMs, 5 drafts, 5 leads, 5 notifications, 3 audit logs):

```bash
npm run db:seed
```

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### 6. Verify the Setup

Check the health endpoint to confirm all services are connected:

```bash
curl http://localhost:3000/api/health
```

You should see a JSON response with `status: "healthy"` or `status: "degraded"` (degraded is expected if Azure OpenAI, Salesforce, or Azure AD are not configured).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. For Neon: `postgresql://user:password@host/dbname?sslmode=require` |
| `NEXTAUTH_URL` | **Yes** | Base URL of the application. Use `http://localhost:3000` for local development. |
| `NEXTAUTH_SECRET` | **Yes** | Secret key for NextAuth.js JWT encryption. Generate with `openssl rand -base64 32`. |
| `AZURE_AD_CLIENT_ID` | No | Azure AD application (client) ID for authentication. |
| `AZURE_AD_CLIENT_SECRET` | No | Azure AD client secret for authentication. |
| `AZURE_AD_TENANT_ID` | No | Azure AD tenant (directory) ID. |
| `AZURE_OPENAI_API_KEY` | No | Azure OpenAI API key for GPT draft generation. |
| `AZURE_OPENAI_ENDPOINT` | No | Azure OpenAI endpoint URL (e.g., `https://your-resource.openai.azure.com`). |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | No | Azure OpenAI model deployment name (e.g., `gpt-4`). |
| `SALESFORCE_API_URL` | No | Salesforce REST API base URL (e.g., `https://your-instance.salesforce.com/services/data/v59.0`). |
| `SALESFORCE_API_KEY` | No | Salesforce API bearer token for lead sync. |

> **Note:** When Azure AD is not configured, the application runs in development mode with authentication bypassed. When Azure OpenAI is not configured, draft generation falls back to template-based responses. When Salesforce is not configured, lead sync uses simulated mode.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js development server with hot reload |
| `npm run build` | Build the application for production |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint across the codebase |
| `npm test` | Run the Jest test suite |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:seed` | Seed the database with sample data |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## Database Schema

The application uses 6 Prisma models:

| Model | Description |
|---|---|
| `User` | Sales agents and managers with role-based access |
| `DM` | Incoming social media direct messages |
| `Draft` | AI-generated draft responses with confidence scores |
| `Lead` | Extracted lead data with scores and priority flags |
| `Notification` | System notifications (SLA breach, high-priority lead, sync status) |
| `AuditLog` | Comprehensive audit trail for all system actions |

To explore the database visually:

```bash
npm run db:studio
```

## API Endpoints

### DMs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dms` | List DMs with pagination, filtering, and search |
| `POST` | `/api/dms` | Ingest a single DM or batch of simulated DMs |
| `GET` | `/api/dms/[dmId]/draft` | Retrieve existing drafts for a DM |
| `POST` | `/api/dms/[dmId]/draft` | Generate an AI draft for a DM |
| `GET` | `/api/dms/[dmId]/status` | Get DM status history and valid transitions |
| `PATCH` | `/api/dms/[dmId]/status` | Update DM status with transition validation |

### Drafts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/drafts/[draftId]` | Retrieve a single draft by ID |
| `PUT` | `/api/drafts/[draftId]` | Edit draft content (compliance-checked) |
| `POST` | `/api/drafts/[draftId]` | Approve, reject, or send a draft |
| `POST` | `/api/drafts/[draftId]/send` | Send an approved draft as a reply |

### Leads

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/leads/extract` | Extract lead data (single, batch, or preview) |
| `POST` | `/api/leads/score` | Score a lead by ID or ad-hoc message content |
| `POST` | `/api/leads/salesforce` | Sync lead to Salesforce (single or batch) |
| `GET` | `/api/leads/salesforce` | Get unsynced leads queue |

### Notifications

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | List notifications with filtering; unread count |
| `POST` | `/api/notifications` | Trigger a notification or mark all as read |
| `PATCH` | `/api/notifications` | Mark a notification as read or dismissed |

### SLA Monitor

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sla-monitor` | Trigger SLA breach check across all new DMs |
| `GET` | `/api/sla-monitor` | Get SLA status summary and configuration |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Application health check (database, services, uptime) |

## Testing

The project includes unit tests and integration tests covering all major features:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test file
npx jest src/services/lead-scorer.test.ts
```

### Test Coverage

| Area | Tests |
|---|---|
| DM Status Tracker | Valid/invalid transitions, bulk updates, audit logging |
| Lead Scorer | All scoring dimensions, real-world DM scenarios, bias mitigation |
| SLA Monitor | Breach detection, escalation, deduplication, threshold boundaries |
| Privacy Compliance | PII detection across all Australian data types |
| DM Inbox Panel | Filtering, selection, keyboard navigation, polling |
| Draft Composer | Generation, editing, approval, send workflows |
| Lead Capture Sidebar | Extraction, preview, Salesforce sync, priority toggle |
| Notification Center | Filtering, mark-as-read, click handling, SLA breach display |

## Lead Scoring Algorithm

The lead scoring algorithm uses six dimensions (max 10 points total) based exclusively on behavioural and declared signals — no demographic data is used (bias mitigation):

| Dimension | Max Score | Signals |
|---|---|---|
| Intent | 3.0 | Purchase intent keywords, pre-approval, property type interest |
| Engagement | 2.0 | Visit/tour requests, number of questions, message detail level |
| Budget | 2.0 | Budget specified, range provided, pre-approval backing |
| Location | 1.5 | Specific community/suburb, high-demand community match |
| Urgency | 1.0 | ASAP/urgent keywords, specific timeline, current housing situation |
| Completeness | 0.5 | Number of extracted lead fields (contact, budget, location, intent) |

Leads scoring **≥ 8.0** are automatically flagged as **high priority** for immediate sales follow-up.

## Deployment

### Vercel (Recommended)

The project is configured for deployment to Vercel's SYD1 (Sydney) region:

1. Connect your GitHub repository to [Vercel](https://vercel.com/)
2. Set all required environment variables in the Vercel dashboard
3. Deploy — Vercel will automatically build and deploy on push to `main`

The `vercel.json` configuration includes:
- Standalone output mode for optimised builds
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)
- No-cache headers for API routes
- SPA rewrites for client-side routing

### Manual Deployment

```bash
# Build the application
npm run build

# Start the production server
npm start
```

Ensure `NEXTAUTH_SECRET` and `DATABASE_URL` are set in production. The build will fail if these are missing.

## Architecture

### Three-Panel Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                          Header                                  │
├──────┬──────────────┬───────────────────┬───────────────────────┤
│      │              │                   │                       │
│  S   │   DM Inbox   │  Draft Composer   │  Lead Capture         │
│  i   │              │                   │  Sidebar              │
│  d   │  - Filter    │  - AI Draft       │                       │
│  e   │  - Search    │  - Edit           │  - Auto-filled fields │
│  b   │  - Select    │  - Approve/Reject │  - Score & Priority   │
│  a   │  - Status    │  - Send           │  - Salesforce Sync    │
│  r   │  - Platform  │  - Confidence     │  - Follow-up Flag     │
│      │              │  - Knowledge Refs │                       │
├──────┴──────────────┴───────────────────┴───────────────────────┤
│                       Toast Notifications                        │
└─────────────────────────────────────────────────────────────────┘
```

### Draft Generation Pipeline (RAG)

```
Customer DM
    │
    ▼
┌─────────────────┐
│ PII Detection   │──▶ Audit Log (if PII found)
│ & Redaction     │
└────────┬────────┘
         │ Sanitised message
         ▼
┌─────────────────┐
│ Keyword          │
│ Extraction       │
└────────┬────────┘
         │ Keywords
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Knowledge Base  │◀───▶│ Communities (6)   │
│ Retrieval       │     │ Listings (26)    │
│ (RAG Context)   │     │ FAQs (20)        │
│                 │     │ Templates (11)   │
│                 │     │ Grants           │
└────────┬────────┘     └──────────────────┘
         │ Context
         ▼
┌─────────────────┐
│ Azure OpenAI    │──▶ (Fallback: Template-based)
│ GPT-4           │
└────────┬────────┘
         │ Draft
         ▼
┌─────────────────┐
│ Compliance      │
│ Validation      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Confidence      │
│ Score (0–100%)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Persist Draft   │──▶ Update DM Status → "drafted"
│ & Audit Log     │
└─────────────────┘
```

### DM Status State Machine

```
         ┌──────────┐
         │   new    │
         └────┬─────┘
              │
       ┌──────┴──────┐
       ▼              ▼
  ┌─────────┐   ┌───────────┐
  │ drafted │   │ escalated │
  └────┬────┘   └─────┬─────┘
       │              │
  ┌────┴────┐    ┌────┴────┐
  ▼    ▼    ▼    ▼         ▼
sent replied escalated  new  drafted
```

Valid transitions:
- `new` → `drafted`, `escalated`
- `drafted` → `sent`, `replied`, `escalated`, `new`
- `replied` → `escalated`
- `sent` → `escalated`
- `escalated` → `new`, `drafted`

## Development Mode

When running locally without Azure AD configured:

- Authentication is bypassed automatically in development/test environments
- The middleware detects missing Azure AD credentials and allows all requests through
- A default "agent" role is assigned to unauthenticated sessions
- All API endpoints remain functional for local testing

When running without Azure OpenAI configured:

- Draft generation uses a template-based fallback system
- Drafts are generated using matched knowledge base context and response templates
- Confidence scores are calculated based on context match quality (typically lower than GPT-generated drafts)

When running without Salesforce configured:

- Lead sync operates in simulated mode
- Simulated Salesforce IDs are generated (18-character format matching real Salesforce IDs)
- A 5% simulated failure rate is included for realistic error handling testing
- All sync operations are logged in the audit trail

## Ingesting Simulated DMs

To load the 30 simulated DMs for pilot testing:

```bash
curl -X POST http://localhost:3000/api/dms \
  -H "Content-Type: application/json" \
  -d '{"simulate": true}'
```

This ingests all DMs from `src/data/simulated-dms.json` covering 6 Stockland communities across Instagram and Facebook.

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

## License

Private — Stockland Corporation Limited. All rights reserved.