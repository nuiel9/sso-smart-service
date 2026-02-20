# SSO Smart Service Platform

ระบบบริการอัจฉริยะสำนักงานประกันสังคม (สปส.) — Next.js 16 App Router + Supabase + Google Gemini AI + LINE Messaging API

---

## Features

| Module | Description |
|---|---|
| **Authentication** | Email/Password login, PDPA consent, role-based routing (member / officer / admin), audit logging |
| **Member Dashboard** | Benefits status, payment history, notifications, AI chatbot — Server Components with parallel data fetching |
| **AI Chatbot** | SSE streaming with Google Gemini, rate limiting (30 msg/hr), confidence scoring, officer escalation |
| **LINE Integration** | Webhook handler, Flex Message templates, 6-slot Rich Menu, phone-based account linking |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database / Auth**: Supabase (PostgreSQL + Auth)
- **AI**: Google Gemini (`gemini-3-flash-preview`)
- **LINE**: `@line/bot-sdk` v10
- **UI**: Tailwind CSS v4 + shadcn/ui + Lucide React
- **Font**: Noto Sans Thai

---

## Pages

| Route | Description |
|---|---|
| `/login` | Email/Password login |
| `/register` | User registration |
| `/member` | Member dashboard with AI chatbot |
| `/member/benefits` | Benefits summary (7 types) |
| `/member/payments` | Payment history & contribution status |
| `/member/notifications` | Notifications center |

---

## SSO Benefits Information

กรณีว่างงาน (มาตรา 33):
- **ถูกเลิกจ้าง**: 50% ของค่าจ้าง ไม่เกิน 180 วัน (6 เดือน)
- **ลาออกเอง**: 30% ของค่าจ้าง ไม่เกิน 90 วัน (3 เดือน)
- **ฐานเงินเดือนสูงสุด**: 15,000 บาท
- **เงื่อนไข**: ส่งสมทบ 6 เดือนใน 15 เดือน, ขึ้นทะเบียนว่างงานภายใน 30 วัน

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
| `GEMINI_API_KEY` | Google Gemini API key |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API channel access token |
| `LINE_CHANNEL_SECRET` | LINE channel secret (for webhook signature verification) |

### 3. Run database migrations

Apply the SQL schema to your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or paste the contents of the migration file into the Supabase SQL editor
```

Migration file: `supabase/migrations/20260219000000_initial_sso_schema.sql`

### 4. Enable Email Auth in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable **Email** provider
3. (Optional) Disable "Confirm email" for demo purposes

### 5. Set up LINE Rich Menu (optional)

```bash
# Create rich menu via API
curl -X POST http://localhost:3000/api/line/setup-rich-menu

# Then upload the rich menu image (2500×843 px)
```

Rich menu template available at: `/rich-menu-template.html`

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
├── (auth)/
│   ├── login/              # Email/Password login
│   └── register/           # User registration
├── (dashboard)/member/
│   ├── page.tsx            # Dashboard with AI chatbot
│   ├── benefits/           # Benefits summary page
│   ├── payments/           # Payment history page
│   └── notifications/      # Notifications page
├── api/
│   ├── chat/               # AI chatbot — SSE streaming (Gemini)
│   ├── benefits/           # Benefits API
│   └── line/
│       ├── webhook/        # LINE webhook handler
│       └── setup-rich-menu/ # Rich menu setup API

components/
├── auth/
│   └── LoginForm.tsx       # Email/Password form
├── chat/
│   ├── ChatWindow.tsx      # SSE reader, typing indicator
│   ├── ChatMessage.tsx     # User/assistant bubbles
│   └── ChatInput.tsx       # Quick replies, send button

lib/
├── supabase/
│   ├── client.ts           # Browser client
│   └── server.ts           # Server client (cookie-based)
├── ai/
│   ├── gemini.ts           # Google Gemini streaming
│   └── rag.ts              # RAG (disabled for demo)
└── line/
    ├── client.ts           # LINE API client
    ├── templates.ts        # Flex Message templates
    ├── flex-messages.ts    # Additional Flex templates
    └── rich-menu.ts        # Rich menu config
```

---

## AI Integration (Google Gemini)

The chatbot uses Google Gemini API with:
- Model: `gemini-3-flash-preview`
- Streaming: Server-Sent Events (SSE)
- Thai language system prompt with SSO knowledge
- Confidence scoring for officer escalation

```typescript
// Example: lib/ai/gemini.ts
const GEMINI_MODEL = 'gemini-3-flash-preview'
```

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

## Database Schema

Key tables:
- `profiles` - User profiles with SSO member info
- `benefits` - Member benefits (status, amount, dates)
- `chat_sessions` - AI chat sessions
- `chat_messages` - Chat message history
- `notifications` - User notifications
- `audit_logs` - PDPA compliance logging

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

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...

# LINE Messaging API (optional)
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
```

---

## License

MIT
