# Changelog

All notable changes to the Social DM Co-Pilot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-15

### Added

#### DM Inbox & Ingestion
- Three-panel dashboard layout with DM inbox, draft composer, and lead capture sidebar
- DM ingestion service supporting Facebook and Instagram platforms
- Simulated DM data with 30 realistic customer inquiries across 6 Stockland communities
- Paginated DM list with filtering by status (New, Drafted, Replied, Sent, Escalated) and platform
- Free-text search on sender name, handle, and message content
- Real-time polling for new DMs with configurable interval (default: 30 seconds)
- Unread indicator dots and new DM count badges
- Keyboard navigation support (Enter/Space to select) with ARIA accessibility attributes
- DM status tracking with validated state machine transitions and audit logging
- `POST /api/dms` endpoint for single and batch DM ingestion
- `GET /api/dms` endpoint with pagination, filtering, and search

#### AI Draft Generation (RAG + GPT)
- Draft generation service with Retrieval-Augmented Generation (RAG) pipeline
- Knowledge base with 6 Stockland communities, 26 listings, 20 FAQs, and 11 response templates
- Context retrieval matching communities, listings, FAQs, grants, and templates by keyword relevance
- Azure OpenAI integration for GPT-powered draft generation with retry and exponential backoff
- Fallback template-based draft generation when Azure OpenAI is not configured
- Confidence score calculation based on knowledge base context match quality (0–100%)
- Confidence meter UI component with color-coded progress bar (green/yellow/red)
- Brand guidelines enforcement in system prompt (Stockland tone of voice)
- `POST /api/dms/[dmId]/draft` endpoint for draft generation
- `GET /api/dms/[dmId]/draft` endpoint for retrieving existing drafts

#### Draft Composer with Human-in-the-Loop
- Editable draft composer component with inline text editing and character count (2000 max)
- Mandatory review warning for low-confidence drafts (< 85%)
- Edit-required enforcement for very low-confidence drafts (< 70%) before approval
- Draft approval workflow: Pending → Approved → Sent (with Rejected branch)
- Reject with optional reason input
- "Insert Property Info" quick action to append listing context
- "Suggest Next Step" quick action with context-aware call-to-action suggestions
- "Regenerate" button to force new AI draft generation
- Knowledge base references panel showing matched communities, listings, FAQs, grants, and templates
- Compliance validation on edit and send (PII detection, content length)
- `PUT /api/drafts/[draftId]` endpoint for editing drafts
- `POST /api/drafts/[draftId]` endpoint for approve, reject, and send actions
- `POST /api/drafts/[draftId]/send` endpoint for sending approved drafts

#### Lead Extraction & Salesforce Sync
- Rule-based lead extraction from DM content: name, contact, budget, location, intent
- Budget extraction supporting ranges ($500-550k), single values ($620k), and qualifiers (Under $400k)
- Location extraction matching known Stockland communities and suburbs
- Intent extraction detecting buyer type, property preferences, features, and timeline
- Optional GPT-assisted extraction for low-confidence rule-based results
- Lead extraction preview mode (without persisting) for UI confirmation
- Salesforce CRM sync with live API support and simulated mode for pilot
- Salesforce lead payload mapping with custom fields (budget, location, intent, score, priority)
- Retry logic with exponential backoff for Salesforce API calls
- Sync status tracking (synced, not synced, failed) with Salesforce ID persistence
- Re-sync and retry capabilities for failed syncs
- `POST /api/leads/extract` endpoint for single, batch, and preview extraction
- `POST /api/leads/salesforce` endpoint for single and batch Salesforce sync
- `GET /api/leads/salesforce` endpoint for unsynced leads queue

#### Rule-Based Lead Scoring with Priority Flagging
- Six-dimension scoring algorithm (max 10 points total):
  - Intent signals (max 3.0): purchase intent, pre-approval, property type
  - Engagement signals (max 2.0): visit requests, questions, message detail
  - Budget signals (max 2.0): budget specified, range, pre-approval backing
  - Location signals (max 1.5): specific location, high-demand community match
  - Urgency signals (max 1.0): timeline, current housing situation
  - Completeness (max 0.5): number of extracted lead fields
- Bias mitigation: scoring uses only behavioural and declared signals — no demographic data
- High-priority flag for leads scoring ≥ 8.0/10
- Detailed score breakdown with per-dimension scores and reasoning
- Lead score display component with color-coded bar, priority flag, and breakdown tooltip
- Priority flag toggle (Flag for Sales Follow-Up) in lead capture sidebar
- `POST /api/leads/score` endpoint for scoring by lead ID or ad-hoc message content

#### Notification Center with SLA Breach Detection
- Notification center component with type-specific icons and color coding
- 10 notification types: new DM, high-priority lead, unassigned lead, draft ready, draft sent, lead assigned, escalation, SLA breach, Salesforce sync success, Salesforce sync failed
- URGENT badge and pulse animation for SLA breaches, escalations, and high-priority leads
- Unread indicator dots with count badges in header and sidebar
- Mark as read, mark as dismissed, and mark all as read actions
- Filter by notification type and status (unread, read, dismissed)
- Real-time polling for new notifications (default: 15 seconds)
- Notification bell dropdown in header with preview of recent notifications
- SLA breach detection scanning DMs in "new" status exceeding 1-hour threshold
- Automatic escalation for DMs exceeding 2x SLA threshold (2 hours)
- Deduplication of SLA breach notifications (no duplicate alerts for same DM)
- SLA status summary with within-SLA, approaching-SLA, and breached-SLA counts
- `GET /api/notifications` endpoint with pagination, filtering, and unread count
- `POST /api/notifications` endpoint for triggering notifications and mark-all-as-read
- `PATCH /api/notifications` endpoint for updating notification status
- `POST /api/sla-monitor` endpoint for triggering SLA breach checks
- `GET /api/sla-monitor` endpoint for SLA status summary and configuration

#### Privacy Compliance & PII Redaction
- PII detection for Australian-specific data types:
  - Email addresses (excluding business/generic domains)
  - Phone numbers (mobile, landline, 1300/1800, +61 prefix)
  - Tax File Numbers (TFN) with context keyword detection
  - Medicare numbers with context keyword detection
  - Credit card numbers (Visa, Mastercard, Amex)
  - BSB and bank account numbers with context keyword detection
  - Australian passport numbers with context keyword detection
  - Drivers licence numbers with context keyword detection
  - Street addresses (number + street name + street type)
  - Dates of birth with context keyword detection
  - PII keyword indicators (contextual triggers)
- Automatic PII redaction with [REDACTED] placeholders before LLM processing
- Draft compliance validation on edit and send (PII check + content length)
- Audit logging for all PII detections with detected types
- `sanitizeForLLM()` function for safe LLM input preparation
- `validateDraftCompliance()` function for outbound content validation

#### Authentication & Authorization
- NextAuth.js integration with Azure AD provider
- JWT-based session strategy with user role enrichment from database
- Middleware-based route protection for API and page routes
- Development mode bypass when Azure AD is not configured
- Role-based access (agent, manager, admin) stored in user session

#### Infrastructure & Developer Experience
- PostgreSQL database with Prisma ORM (6 models: User, DM, Draft, Lead, Notification, AuditLog)
- Database seed script with sample data (2 users, 5 DMs, 5 drafts, 5 leads, 5 notifications, 3 audit logs)
- Health check endpoint (`GET /api/health`) with database, Azure OpenAI, Salesforce, and Azure AD status
- Comprehensive audit logging for all system actions
- Toast notification system with success, error, info, and warning variants
- Reusable UI components: Button, StatusBadge, ConfidenceMeter, PriorityFlag, Toast
- Responsive layout with header, collapsible sidebar, and three-panel content area
- Tailwind CSS with Stockland brand colors and custom design tokens
- Loading skeleton states for all panels and pages
- Error boundary pages with retry functionality
- Vercel deployment configuration with security headers and SYD1 region
- Environment variable validation with Zod schema
- Custom React hooks: `usePolling`, `useDMs`, `useNotifications`

#### Testing
- Unit tests for DM status tracker with valid/invalid transitions and bulk updates
- Unit tests for lead scorer with all scoring dimensions and real-world DM scenarios
- Unit tests for SLA monitor with breach detection, escalation, and deduplication
- Unit tests for privacy compliance with PII detection across all Australian data types
- Integration tests for DM inbox panel with filtering, selection, and keyboard navigation
- Integration tests for draft composer with generation, editing, approval, and send workflows
- Integration tests for lead capture sidebar with extraction, preview, Salesforce sync, and priority toggle
- Integration tests for notification center with filtering, mark-as-read, and click handling

[1.0.0]: https://github.com/stockland/social-dm-copilot/releases/tag/v1.0.0