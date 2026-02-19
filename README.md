# SSO Smart Service Platform

ระบบบริการอัจฉริยะสำนักงานประกันสังคม (สปส.) — Next.js 16 App Router + Supabase + Typhoon LLM + LINE Messaging API

---

## Features

| Module | Description |
|---|---|
| **Authentication** | Phone OTP login, PDPA consent, role-based routing (member / officer / admin), audit logging |
| **Member Dashboard** | Real-time benefit status, payment history, notifications, quick actions — Server Components with parallel data fetching |
| **AI Chatbot** | SSE streaming with Typhoon LLM, RAG via pgvector, rate limiting (30 msg/hr), confidence scoring, officer escalation |
| **LINE Integration** | Webhook handler, Flex Message templates, 6-slot Rich Menu, phone-based account linking |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database / Auth**: Supabase (PostgreSQL + pgvector + Auth)
- **AI**: Typhoon LLM (`typhoon-v2-70b-instruct` + `typhoon-v2-embed`)
- **LINE**: `@line/bot-sdk` v10
- **UI**: Tailwind CSS v4 + shadcn/ui + Lucide React
- **Font**: Noto Sans Thai

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `TYPHOON_API_KEY` | Typhoon API key from [opentyphoon.ai](https://opentyphoon.ai) |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API channel access token |
| `LINE_CHANNEL_SECRET` | LINE channel secret (for webhook signature verification) |

### 3. Run database migrations

Apply the SQL schema to your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or paste the contents of the migration file into the Supabase SQL editor
```

Also create the LINE account mapping table (required for LINE integration):

```sql
create table public.line_user_mappings (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- RLS: only service role can read/write
alter table public.line_user_mappings enable row level security;
```

### 4. Set up LINE Rich Menu (one-time)

After setting your `LINE_CHANNEL_ACCESS_TOKEN`:

```bash
npx tsx lib/line/rich-menu.ts
```

Then upload the rich menu image via LINE Console or the printed `curl` command.

Set the webhook URL in LINE Developers Console:

```
https://<your-domain>/api/line/webhook
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
├── (auth)/login/          # Phone OTP login page (Server Component)
├── (dashboard)/member/    # Member dashboard (async Server Component)
│   ├── loading.tsx        # Skeleton UI
│   └── error.tsx          # Error boundary
├── api/
│   ├── auth/callback/     # Supabase OAuth callback
│   ├── chat/              # AI chatbot — SSE streaming endpoint
│   └── line/webhook/      # LINE Messaging API webhook

components/
├── auth/
│   ├── LoginForm.tsx      # Phone + OTP form, PDPA consent
│   ├── OTPInput.tsx       # 6-digit input, 60s countdown
│   └── LogoutButton.tsx   # With audit logging
├── chat/
│   ├── ChatWindow.tsx     # SSE reader, typing indicator, disclaimer
│   ├── ChatMessage.tsx    # User/assistant bubbles, streaming cursor
│   └── ChatInput.tsx      # Quick replies, Send icon, 500-char limit
└── dashboard/
    ├── BenefitsCard.tsx   # Status badge, expiry warning
    ├── QuickActions.tsx   # 2×2 action grid
    └── NotificationBell.tsx # Dropdown with optimistic mark-as-read

lib/
├── supabase/
│   ├── client.ts          # createBrowserClient
│   ├── server.ts          # createServerClient (cookie-based)
│   ├── middleware.ts      # Role-based route protection
│   └── auth.ts            # getUserProfile, logAuditAction, getDashboardPath
├── ai/
│   ├── typhoon.ts         # chatStream() generator, retry ×3, 30s timeout
│   └── rag.ts             # pgvector RAG, graceful fallback
└── line/
    ├── client.ts          # LINE API client, verifySignature
    ├── templates.ts       # 5 Flex Message templates
    └── rich-menu.ts       # 6-slot rich menu config + setup script

middleware.ts              # JWT check, protected routes, role-based access
```

---

## Key Design Decisions

### Authentication
- Uses `getUser()` (not `getSession()`) for server-side auth — more secure
- `/member/*` routes skip the DB role query (auth-only); `/officer/*` and `/admin/*` perform a DB lookup
- PDPA consent stored in `profiles.pdpa_consent` and required before any data access

### AI Chatbot
- Streams tokens via `ReadableStream` + `text/event-stream` — messages appear word by word
- RAG context fetched in parallel with chat history before streaming starts
- Messages are saved to DB **after** the stream completes (inside `ReadableStream.start()`)
- Confidence heuristic: starts at 0.8, deducted for uncertainty markers, triggers officer escalation below 0.7

### LINE Integration
- Signature verified with HMAC-SHA256 before any event processing
- LINE users without a linked SSO account get a deterministic UUID (SHA-256 of their LINE userId) used as `member_id` — ensuring consistent audit trails
- Account linking: user sends their SSO-registered phone number → matched against `profiles.phone`
- Non-streaming AI response (LINE doesn't support SSE)

### Rate Limiting
- 30 messages / hour / user — enforced via Supabase query (no Redis required)
- Checks `chat_messages` count across all user sessions in the last hour

---

## Role Matrix

| Path | member | officer | admin |
|---|---|---|---|
| `/member/*` | ✅ | ✅ | ✅ |
| `/officer/*` | ❌ | ✅ | ✅ |
| `/admin/*` | ❌ | ❌ | ✅ |

---

## LINE Rich Menu Layout

```
┌──────────────┬──────────────┬──────────────┐
│ ตรวจสอบสิทธิ์ │  สถานะเงิน   │  AI ถามตอบ  │
├──────────────┼──────────────┼──────────────┤
│   แจ้งเตือน   │  มาตรา 40   │ ติดต่อ 1506 │
└──────────────┴──────────────┴──────────────┘
```

---

## Available Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

---

## Environment Variables Reference

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Typhoon LLM
TYPHOON_API_KEY=sk-...

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
```
