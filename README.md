# SSO Smart Service Platform

> ระบบบริการอัจฉริยะสำนักงานประกันสังคม (สปส.)
> Smart Social Security Office — AI-powered citizen services platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)
![LINE](https://img.shields.io/badge/LINE-Messaging_API-00C300?logo=line)
![PDPA](https://img.shields.io/badge/PDPA-Compliant-blue)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Role Matrix](#role-matrix)
- [Security](#security)
- [Key Design Decisions](#key-design-decisions)

---

## Overview

SSO Smart Service is a full-stack web platform that modernises citizen interactions with the Thai Social Security Office (สำนักงานประกันสังคม). It combines a **Next.js** server-rendered frontend, a **Supabase** PostgreSQL backend, a **Typhoon LLM** AI chatbot, and **LINE Messaging API** integration into a single, PDPA-compliant system.

**Three user roles:**

| Role | Thai | Access |
|------|------|--------|
| `member` | ผู้ประกันตน | Dashboard, chatbot, benefits, notifications, data export |
| `officer` | เจ้าหน้าที่ | Member data within their zone, benefit management |
| `admin` | ผู้ดูแลระบบ | Full system access, audit logs, notification management |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                              │
│   Web Browser          LINE App           Cron Scheduler    │
└────────┬───────────────────┬──────────────────┬────────────┘
         │                   │                  │
         ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js 16 App Router                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Server      │  │ API Routes   │  │ Middleware          │ │
│  │ Components  │  │ /api/*       │  │ JWT + Role Guard    │ │
│  │ (SSR/RSC)   │  │              │  │                    │ │
│  └─────────────┘  └──────────────┘  └────────────────────┘ │
└────────┬───────────────────┬──────────────────┬────────────┘
         │                   │                  │
         ▼                   ▼                  ▼
┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Supabase     │  │  Typhoon LLM    │  │  LINE API       │
│  PostgreSQL    │  │  (Typhoon v2    │  │  push / reply   │
│  pgvector      │  │   70B instruct) │  │  webhooks       │
│  Auth          │  │                 │  │                 │
│  Realtime      │  └─────────────────┘  └─────────────────┘
│  Storage       │
│  Edge Functions│
└────────────────┘
```

---

## Features

### Step 1 — Authentication
- Phone OTP login via Supabase Auth
- Role-based route protection in Edge Middleware (`/member`, `/officer`, `/admin`)
- Secure `getUser()` validation (not `getSession()`) on every protected request
- Logout with audit trail

### Step 2 — Member Dashboard
- Server-rendered dashboard with parallel data fetching (`Promise.all`)
- Benefits summary, payment status, unread notification count
- Skeleton loading UI + error boundary
- `NotificationBell` dropdown with optimistic mark-as-read

### Step 3 — AI Chatbot
- **SSE streaming** — tokens appear word-by-word via `ReadableStream` + `text/event-stream`
- **RAG** — pgvector similarity search injects SSO policy context before every reply
- **Confidence scoring** — heuristic deduction triggers officer escalation below 0.7
- Rate limiting: 30 messages / hour / user (Supabase query, no Redis)
- Full chat history (last 10 messages) sent as context each turn
- Messages persisted to DB after stream completes

### Step 4 — LINE Integration
- Webhook handler with HMAC-SHA256 signature verification
- 5 Flex Message templates: welcome, benefits summary, payment status, escalation notice, PDPA consent
- 6-slot Rich Menu with postback actions
- Phone-based account linking (`profiles.phone` → `line_user_mappings`)
- AI chat via LINE (non-streaming, same Typhoon model)
- PDPA consent flow before any data is surfaced

### Step 5 — Benefits Management
- `/api/benefits` — GET (member's own) / POST (officer/admin create)
- Benefits table: `benefit_type`, `status`, `amount`, `eligible_date`, `expiry_date`, `claimed_at`
- RLS: members see own; officers see zone; admin sees all

### Step 6 — Predictive Notification Engine
- **`/api/notifications`** — GET (paginated + filterable), PATCH (mark read), POST (admin send)
- **`/api/notifications/predict`** — Cron job (secured by `CRON_SECRET`):
  - Task a: Benefits expiring within 30 days → `benefit_reminder`
  - Task b: Active benefits unused > 30 days → `benefit_reminder`
  - Task c: Members with no `section_type` + PDPA consent → `section40_outreach`
  - Task d: Benefits status changed in last 24h → `payment_status`
  - 24-hour deduplication guard, batch sends (10 concurrent max)
- **Multi-channel sender** (`lib/notifications/sender.ts`):
  - In-app push → insert to `notifications` table
  - LINE push → `pushMessage()` via existing LINE client
  - SMS → generic HTTP provider (`SMS_API_URL`)
- **`NotificationList`** — full history page with type/read filters, Supabase Realtime live updates, load-more pagination
- **Supabase Edge Function** (`supabase/functions/predict-notifications/`) — Deno runtime mirror of the cron route, schedulable via Supabase Dashboard
- **Vercel Cron** — `vercel.json` schedules `POST /api/notifications/predict` at 01:00 UTC (08:00 ICT) daily

### Step 7 — PDPA Compliance & Audit
- **Centralised audit logger** (`lib/audit/logger.ts`):
  - `logAudit()` — service-role insert, never throws
  - `logAuditFromServer()` — auto-extracts IP/UA from `next/headers`
  - `logAuditFromRequest()` — extracts meta from `Request` object
  - `AuditAction` constants enum for type-safe action names
- **PDPA Consent page** (`/consent`):
  - 3 consent items (data collection, AI analysis, notifications)
  - Full privacy policy text in Thai
  - Decline flow with sign-out option
  - Records `pdpa_consent_date` and logs `PDPA_CONSENT_GRANTED`
- **Data Export** (`/api/member/data-export`):
  - PDPA §63 right of access
  - Password re-authentication required before every export
  - Exports: profile, benefits, chat sessions + messages, notifications, audit logs
  - JSON (nested) or CSV (UTF-8 BOM, Excel-compatible)
  - Member UI at `/member/data-export`
- **Admin Audit Log Viewer** (`/admin/audit`):
  - Server-side filtering: date range, action type, user UUID
  - 50 rows/page with full pagination
  - Expandable rows showing raw JSON metadata
  - Client-side CSV export with Thai Buddhist calendar timestamps
- **Security headers** (`next.config.ts`):
  - Content-Security-Policy (Supabase + Typhoon + LINE scoped)
  - HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript, Server Components) |
| Database | Supabase PostgreSQL + pgvector (RAG embeddings) |
| Auth | Supabase Auth (OTP / email, cookie-based sessions) |
| AI | Typhoon LLM `typhoon-v2-70b-instruct` + `typhoon-v2-embed` |
| Realtime | Supabase Realtime (`postgres_changes` subscriptions) |
| Storage | Supabase Storage (benefit documents, avatars) |
| Edge Functions | Supabase Deno runtime (scheduled notification predictor) |
| LINE | `@line/bot-sdk` v10 — push, reply, Flex, Rich Menu |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide React |
| Font | Noto Sans Thai |
| Cron | Vercel Cron (calls `/api/notifications/predict`) |
| SMS | Generic HTTP provider (configurable via env) |

---

## Project Structure

```
app/
├── (auth)/
│   ├── login/page.tsx          # Phone OTP login (Server Component)
│   ├── register/page.tsx       # Registration form
│   └── consent/page.tsx        # PDPA consent (Step 7)
├── (dashboard)/
│   ├── member/
│   │   ├── page.tsx            # Member dashboard (SSR, parallel fetch)
│   │   ├── notifications/      # Full notification list (Step 6)
│   │   ├── data-export/        # PDPA data export UI (Step 7)
│   │   ├── loading.tsx         # Skeleton UI
│   │   └── error.tsx           # Error boundary
│   ├── officer/page.tsx        # Officer dashboard
│   └── admin/
│       ├── page.tsx            # Admin dashboard
│       └── audit/page.tsx      # Audit log viewer (Step 7)
└── api/
    ├── auth/callback/          # Supabase OAuth callback
    ├── benefits/               # Benefits CRUD (Step 5)
    ├── chat/                   # AI chatbot SSE streaming (Step 3)
    ├── line/webhook/           # LINE Messaging API (Step 4)
    ├── member/
    │   ├── consent/            # PDPA consent audit log (Step 7)
    │   └── data-export/        # PDPA data export + re-auth (Step 7)
    └── notifications/
        ├── route.ts            # GET / PATCH / POST (Step 6)
        └── predict/route.ts    # Cron prediction engine (Step 6)

components/
├── admin/
│   └── AuditTable.tsx          # Filter, table, CSV export (Step 7)
├── auth/
│   ├── ConsentForm.tsx         # PDPA consent checkboxes (Step 7)
│   ├── LoginForm.tsx           # Phone + OTP form
│   ├── OTPInput.tsx            # 6-digit OTP, 60s countdown
│   └── LogoutButton.tsx        # Audit-logged sign-out
├── chat/
│   ├── ChatWindow.tsx          # SSE reader, typing indicator
│   ├── ChatMessage.tsx         # User/assistant bubbles, streaming cursor
│   └── ChatInput.tsx           # Quick replies, 500-char limit
├── dashboard/
│   ├── BenefitsCard.tsx        # Status badge, expiry warning
│   ├── NotificationBell.tsx    # Dropdown, optimistic mark-as-read
│   ├── NotificationList.tsx    # Full list, Realtime, filters (Step 6)
│   └── QuickActions.tsx        # 2×2 action grid
└── ui/                         # shadcn/ui primitives

lib/
├── ai/
│   ├── typhoon.ts              # chatStream() generator, retry ×3, 30s timeout
│   └── rag.ts                  # pgvector similarity search, graceful fallback
├── audit/
│   └── logger.ts               # Centralised audit logger (Step 7)
├── line/
│   ├── client.ts               # MessagingApiClient, pushMessage, replyMessage
│   ├── templates.ts            # 5 Flex Message templates
│   └── rich-menu.ts            # 6-slot rich menu + setup script
├── notifications/
│   └── sender.ts               # Multi-channel sender: push/LINE/SMS (Step 6)
├── supabase/
│   ├── client.ts               # createBrowserClient
│   ├── server.ts               # createServerClient + createServiceClient
│   ├── middleware.ts           # Role-based route protection
│   └── auth.ts                 # getUserProfile, getDashboardPath
└── types/
    └── database.ts             # Full Supabase TypeScript types

supabase/
├── migrations/
│   └── 20260219000000_initial_sso_schema.sql   # Full schema + RLS + triggers
└── functions/
    └── predict-notifications/index.ts           # Deno Edge Function (Step 6)

middleware.ts                   # Edge Middleware — JWT check + role guard
next.config.ts                  # Security headers (CSP, HSTS, …)
vercel.json                     # Vercel Cron schedule (Step 6)
```

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/<your-org>/sso-smart-service.git
cd sso-smart-service
npm install
```

### 2. Configure environment variables

Create `.env.local` from the reference below and fill in every value:

```bash
cp .env.example .env.local   # if .env.example exists
# or create .env.local manually (see Environment Variables section)
```

### 3. Set up Supabase

```bash
# Option A — Supabase CLI (recommended)
supabase link --project-ref <your-project-ref>
supabase db push

# Option B — paste supabase/migrations/20260219000000_initial_sso_schema.sql
#             into the Supabase SQL editor and run
```

Create the LINE account mapping table (not in the main migration):

```sql
CREATE TABLE public.line_user_mappings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id  TEXT NOT NULL UNIQUE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.line_user_mappings ENABLE ROW LEVEL SECURITY;
-- Only service_role may read/write this table
```

### 4. Set up LINE Rich Menu (one-time)

```bash
npx tsx lib/line/rich-menu.ts
```

Then upload the menu image via LINE Developers Console and set your webhook URL:

```
https://<your-domain>/api/line/webhook
```

### 5. Deploy Supabase Edge Function

```bash
supabase functions deploy predict-notifications
```

Schedule it in the Supabase Dashboard → Edge Functions → Schedule:

```
Cron: 0 1 * * *    # 01:00 UTC = 08:00 ICT
```

### 6. Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Create `.env.local` with all of the following:

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Server-side only — never expose to browser

# ── Typhoon LLM ───────────────────────────────────────────────────────────────
TYPHOON_API_KEY=sk-...                  # https://opentyphoon.ai

# ── LINE Messaging API ────────────────────────────────────────────────────────
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...                 # Used for webhook signature verification

# ── Notification Engine ───────────────────────────────────────────────────────
CRON_SECRET=<random-32-char-string>     # Protects POST /api/notifications/predict

# SMS provider (optional — skip to use in-app push only)
SMS_API_URL=https://api.your-sms-provider.com/send
SMS_API_KEY=...
SMS_SENDER_ID=SSO                       # Sender name shown on handset
```

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security.
> Never reference it in `NEXT_PUBLIC_*` variables or client-side code.

---

## Database Setup

The main migration (`supabase/migrations/20260219000000_initial_sso_schema.sql`) creates:

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to `auth.users`; stores name, phone, SSO member ID, section type, PDPA consent |
| `benefits` | Benefit records per member: type, status, amount, expiry |
| `chat_sessions` | Chat session metadata per member/channel |
| `chat_messages` | Individual messages with AI confidence scores |
| `notifications` | In-app notifications (push / LINE / SMS) |
| `audit_logs` | PDPA-mandated append-only access log |

### RLS Policies (summary)

| Table | member | officer | admin | service_role |
|-------|--------|---------|-------|--------------|
| `profiles` | own row | zone members | all | all |
| `benefits` | own | zone | all | all |
| `notifications` | own (read + update read) | — | insert | insert |
| `audit_logs` | — | — | select | insert |

### Key Triggers

| Trigger | Effect |
|---------|--------|
| `on_auth_user_created` | Auto-creates `profiles` row on signup |
| `set_profiles_updated_at` | Keeps `updated_at` current |
| `on_pdpa_consent_change` | Sets `pdpa_consent_date`, writes audit log |
| `on_benefit_status_change` | Writes audit log on status transitions |

---

## Deployment

### Vercel (recommended)

1. Push to GitHub and import the repo into Vercel.
2. Add all environment variables in the Vercel dashboard.
3. `vercel.json` already configures the daily cron:

```json
{
  "crons": [
    {
      "path": "/api/notifications/predict",
      "schedule": "0 1 * * *"
    }
  ]
}
```

The cron invokes `POST /api/notifications/predict` with `Authorization: Bearer <CRON_SECRET>` every day at 01:00 UTC (08:00 ICT).

### Supabase Edge Function (alternative cron)

If you prefer Supabase-native scheduling instead of Vercel Cron:

```bash
supabase functions deploy predict-notifications
```

Schedule via Supabase Dashboard → Edge Functions → `predict-notifications` → Schedule, or using `pg_cron`:

```sql
SELECT cron.schedule(
  'daily-notification-predict',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/predict-notifications',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  )
  $$
);
```

---

## API Reference

### Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/notifications` | member | Paginated list (`?page`, `?limit`, `?type`, `?read`) |
| `PATCH` | `/api/notifications` | member | Mark read (`{ ids[] }` or `{ all: true }`) |
| `POST` | `/api/notifications` | admin | Send notification to a member |
| `POST` | `/api/notifications/predict` | cron secret | Run daily prediction engine |

### Benefits

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/benefits` | member | Member's own benefits |
| `POST` | `/api/benefits` | officer/admin | Create benefit record |

### Chat

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/chat` | member | SSE streaming chat with Typhoon LLM |

### Member (PDPA)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/member/consent` | member | Log PDPA consent action |
| `GET` | `/api/member/data-export` | member | Info / discovery |
| `POST` | `/api/member/data-export` | member | Export all personal data (requires password) |

### LINE

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/line/webhook` | LINE signature | Receive and handle LINE events |

---

## Role Matrix

### Page access

| Path | member | officer | admin |
|------|--------|---------|-------|
| `/member/*` | ✅ | ✅ | ✅ |
| `/officer/*` | ❌ | ✅ | ✅ |
| `/admin/*` | ❌ | ❌ | ✅ |
| `/consent` | ✅ | ✅ | ✅ |

### Feature access

| Feature | member | officer | admin |
|---------|--------|---------|-------|
| View own profile | ✅ | ✅ | ✅ |
| View benefits | own | zone | all |
| Send notifications | ❌ | ❌ | ✅ |
| Export own data | ✅ | ✅ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |
| LINE Rich Menu | ✅ | — | — |

---

## Security

### HTTP Security Headers

Configured in `next.config.ts` and applied globally:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | Allows: self, Supabase (REST + WSS), Typhoon, LINE. Blocks everything else. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` — prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` — prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disables camera, microphone, geolocation, payment, USB, Bluetooth |

### Authentication & Authorisation

- **`getUser()`** (not `getSession()`) is used on every server-side auth check — validates the JWT against Supabase on every request
- Row Level Security (RLS) enforced at the database layer — even if application logic has bugs, data is protected
- Service role key is used only in server-side code (API routes, Edge Functions, sender.ts) — never exposed to the browser
- LINE webhook requests verified with HMAC-SHA256 before any event processing

### PDPA Compliance

- **Consent gate** — `pdpa_consent` must be `true` before any personal data is surfaced via LINE
- **Audit trail** — every significant action (login, view_profile, data_export, benefit_status_change, pdpa_consent_*) is written to `audit_logs` (append-only, no UPDATE/DELETE policy)
- **Data export** — PDPA §63 right of access, password re-authentication required
- **Consent granularity** — three separate consent items logged in audit metadata
- **Data minimisation** — `national_id` column documented for application-level encryption (pgcrypto / AES-256) before storage

---

## Key Design Decisions

### Server Components first
All dashboard pages are React Server Components that fetch data in parallel with `Promise.all`. Client Components are used only where interactivity is required (chat, notification list, consent form).

### AI Streaming
The chat API uses `ReadableStream` + `text/event-stream` so tokens appear character-by-character in the browser. RAG context is fetched in parallel with chat history *before* the stream begins. Messages are saved to the database *after* the stream closes (inside `ReadableStream.start()`).

### Confidence-based escalation
Typhoon responses are scored by a heuristic (starts at 0.8, deducted for Thai/English uncertainty markers). Scores below 0.7 surface an escalation card directing the user to a human officer. This threshold is configurable in `lib/ai/typhoon.ts`.

### Deduplication in the notification engine
The prediction cron checks `notifications` for any row of the same `type` for the same `member_id` in the last 24 hours before sending. This prevents duplicate push/LINE/SMS even if the cron runs multiple times.

### Audit logger design
`logAudit()` uses the **service role** (bypasses RLS) to guarantee logs are always written, even if the current user's session has expired or the RLS policy would otherwise block the insert. The function **never throws** — audit failures are console-logged but never surface as errors to the end user.

### LINE account linking without SSO login
LINE users receive a deterministic UUID derived from their LINE userId (SHA-256 hash) used as `member_id` for chat sessions before they link an SSO account. This ensures a consistent audit trail across all interactions without a schema change.

---

## LINE Rich Menu Layout

```
┌──────────────┬──────────────┬──────────────┐
│  ตรวจสอบสิทธิ์ │  สถานะเงิน   │  AI ถามตอบ  │
├──────────────┼──────────────┼──────────────┤
│   แจ้งเตือน   │  มาตรา 40   │ ติดต่อ 1506 │
└──────────────┴──────────────┴──────────────┘
```

Set up with:

```bash
npx tsx lib/line/rich-menu.ts
```

---

## Available Scripts

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint check
```

```bash
# Supabase
supabase db push                                    # Apply migrations
supabase functions deploy predict-notifications     # Deploy Edge Function
supabase functions serve predict-notifications      # Local Edge Function dev

# LINE Rich Menu (one-time setup)
npx tsx lib/line/rich-menu.ts
```

---

## Contributing

1. Branch from `main` → `feature/<name>` or `fix/<name>`
2. Follow the existing file and naming conventions
3. All server-side data access must go through the typed Supabase client (`lib/types/database.ts`)
4. Every action involving personal data must call `logAudit()` from `lib/audit/logger.ts`
5. Run `npm run lint` before opening a PR

---

*ระบบนี้ดำเนินการตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)*
*© 2568 สำนักงานประกันสังคม กระทรวงแรงงาน*
