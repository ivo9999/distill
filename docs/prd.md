# Distill — Product Requirements Document

**Version:** 2.0
**Owner:** Ivo / SisleLabs
**Target:** Claude Code — implement everything in this document in a single session
**Status:** Build the complete v1

---

## 1. Product summary

**Distill** is a Discord bot + web dashboard that turns the best discussions in a Discord community into a publishable newsletter draft every week. The owner reviews, edits, and publishes to Beehiiv (or other newsletter platforms) with one click.

**Tagline:** _Your Discord wrote your newsletter this week._

**Target customer:** Operators of paid communities, dev tool Discords, course cohorts, and creator newsletters who want to turn their Discord activity into owned-audience email content.

**Pricing:** Single tier — $49/mo with a 14-day free trial (no card required).

---

## 2. Tech stack (non-negotiable)

| Layer           | Choice                                         | Notes                                                   |
| --------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Backend         | **Go 1.22+**                                   | Match existing SisleLabs services                       |
| Discord library | **`bwmarrin/discordgo`**                       | Standard, well-maintained                               |
| Database        | **PostgreSQL 16**                              | Self-hosted on Hetzner via Coolify                      |
| Migrations      | **`golang-migrate/migrate`**                   | Plain SQL migrations                                    |
| DB access       | **`sqlc`**                                     | Code-gen from SQL                                       |
| Background jobs | **`riverqueue/river`**                         | Postgres-native job queue, Go-native                    |
| HTTP framework  | **`chi`**                                      | Lightweight, idiomatic                                  |
| LLM pipeline    | **Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)** | Lives entirely in Next.js; Zod-typed structured outputs |
| Frontend        | **Next.js 15 (App Router)**                    | TypeScript, server components                           |
| UI              | **Tailwind CSS + shadcn/ui**                   | Match analiz design language                            |
| Auth            | **NextAuth.js v5 with Discord provider**       | Users log in with the same Discord they manage          |
| Deployment      | **Coolify on Hetzner**                         | Existing infra                                          |
| Domain          | **distill.sislelabs.com**                      | Subdomain for v1                                        |
| Payments        | **Stripe**                                     | Direct subscription billing, no Connect                 |

**Do not introduce new infrastructure (no ClickHouse, no Redpanda, no Redis cluster). This is a CRUD app with LLM calls and a job queue.**

**LLM architecture:** The LLM pipeline lives entirely in the Next.js app via Vercel AI SDK. The Go backend does NOT call any LLM provider directly. When a generation job fires, the Go worker makes an authenticated HTTP call to `POST /api/internal/generate` on the Next.js app, which runs both LLM passes and returns the markdown draft. The two services share a secret via the `INTERNAL_API_KEY` env var. This keeps all prompt logic, model selection, and structured-output schemas in one TypeScript codebase.

---

## 3. Repository structure

Single monorepo, two apps:

```
distill/
├── README.md
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── api/                    # Go backend (HTTP API + Discord bot + workers)
│   │   ├── cmd/
│   │   │   ├── api/main.go     # HTTP server entrypoint
│   │   │   ├── bot/main.go     # Discord bot entrypoint (separate process)
│   │   │   └── worker/main.go  # River worker entrypoint (separate process)
│   │   ├── internal/
│   │   │   ├── config/         # env loading
│   │   │   ├── db/             # sqlc-generated code
│   │   │   ├── discord/        # Discord client + bot event handlers + slash commands
│   │   │   ├── llmclient/      # thin HTTP client to Next.js /api/internal/generate
│   │   │   ├── newsletter/     # generation job orchestration (calls llmclient)
│   │   │   ├── jobs/           # River job definitions (generate, backfill, publish, trial-reminder)
│   │   │   ├── http/           # chi route handlers
│   │   │   └── auth/           # session validation middleware
│   │   ├── migrations/         # plain SQL migration files
│   │   ├── queries/            # sqlc input SQL files
│   │   ├── sqlc.yaml
│   │   ├── go.mod
│   │   └── Dockerfile
│   └── web/                    # Next.js frontend + LLM pipeline
│       ├── app/
│       │   ├── (marketing)/
│       │   │   └── page.tsx    # public landing page
│       │   ├── (app)/
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx                          # server list + latest draft per server
│       │   │   │   ├── servers/[id]/page.tsx              # server settings (channels, schedule)
│       │   │   │   ├── servers/[id]/newsletters/[nid]/page.tsx  # editor + preview + publish
│       │   │   │   ├── integrations/page.tsx              # connect Beehiiv / ConvertKit / Ghost
│       │   │   │   └── onboarding/page.tsx                # first-time setup flow
│       │   │   └── layout.tsx  # auth-gated layout
│       │   ├── api/
│       │   │   ├── auth/[...nextauth]/route.ts
│       │   │   └── internal/
│       │   │       ├── generate/route.ts   # LLM pipeline endpoint
│       │   │       └── publish/route.ts    # publishing endpoint
│       │   └── layout.tsx
│       ├── lib/
│       │   ├── ai/
│       │   │   ├── client.ts       # Vercel AI SDK provider config (@ai-sdk/anthropic)
│       │   │   ├── pass1.ts        # ranking pass: generateObject + Zod schema
│       │   │   ├── pass2.ts        # drafting pass: generateText
│       │   │   ├── pipeline.ts     # orchestrates pass1 → pass2, returns markdown + usage
│       │   │   └── prompts/
│       │   │       ├── pass1.txt
│       │   │       └── pass2.txt
│       │   ├── publishing/
│       │   │   ├── types.ts        # Publisher interface
│       │   │   ├── beehiiv.ts
│       │   │   ├── convertkit.ts
│       │   │   └── ghost.ts
│       │   └── db.ts               # Postgres client for NextAuth + reads
│       ├── components/
│       ├── package.json
│       └── Dockerfile
├── scripts/
│   └── experiment/             # CLI tool for testing LLM pipeline on exported Discord JSON
│       ├── index.ts
│       ├── README.md
│       └── package.json
└── docs/
    └── prd.md
```

**Three separate Go binaries** (`api`, `bot`, `worker`) sharing `internal/`, plus the Next.js app. They run as four Coolify services pointing at the same Postgres.

---

## 4. Build order

Build everything below in this order. Each section builds on the previous ones. **Implement all of it — do not stop partway.**

### 4.1 — Database + migrations

Create all SQL migration files in `apps/api/migrations/`. Then write all sqlc query files in `apps/api/queries/` and generate the Go code.

**Schema:**

```sql
-- 001_initial.up.sql

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id          TEXT NOT NULL UNIQUE,
    discord_username    TEXT NOT NULL,
    email               TEXT NOT NULL,
    avatar_url          TEXT,
    stripe_customer_id  TEXT UNIQUE,
    subscription_status TEXT NOT NULL DEFAULT 'trialing',
    trial_ends_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE servers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discord_guild_id    TEXT NOT NULL,
    name                TEXT NOT NULL,
    icon_url            TEXT,
    community_type      TEXT,
    schedule_cron       TEXT NOT NULL DEFAULT '0 18 * * 0',
    status              TEXT NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, discord_guild_id)
);

CREATE TABLE monitored_channels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    discord_channel_id  TEXT NOT NULL,
    name                TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (server_id, discord_channel_id)
);

CREATE TABLE messages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_message_id      TEXT NOT NULL UNIQUE,
    server_id               UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    channel_id              UUID NOT NULL REFERENCES monitored_channels(id) ON DELETE CASCADE,
    discord_author_id       TEXT NOT NULL,
    author_display_name     TEXT NOT NULL,
    content                 TEXT NOT NULL,
    reply_to_discord_id     TEXT,
    thread_discord_id       TEXT,
    sent_at                 TIMESTAMPTZ NOT NULL,
    reaction_count          INTEGER NOT NULL DEFAULT 0,
    reply_count             INTEGER NOT NULL DEFAULT 0,
    raw_payload             JSONB NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_server_sent ON messages(server_id, sent_at DESC);
CREATE INDEX idx_messages_channel_sent ON messages(channel_id, sent_at DESC);

CREATE TABLE optouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    discord_user_id     TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (server_id, discord_user_id)
);

CREATE TABLE newsletters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft',
    draft_markdown      TEXT NOT NULL,
    edited_markdown     TEXT,
    published_at        TIMESTAMPTZ,
    published_url       TEXT,
    cost_usd            NUMERIC(10, 4) NOT NULL DEFAULT 0,
    pass1_tokens_in     INTEGER NOT NULL DEFAULT 0,
    pass1_tokens_out    INTEGER NOT NULL DEFAULT 0,
    pass2_tokens_in     INTEGER NOT NULL DEFAULT 0,
    pass2_tokens_out    INTEGER NOT NULL DEFAULT 0,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_newsletters_server_created ON newsletters(server_id, created_at DESC);

CREATE TABLE publisher_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL,
    api_key_encrypted   TEXT NOT NULL,
    publication_id      TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, platform)
);
```

Also create `001_initial.down.sql` that drops all tables in reverse dependency order.

Publisher API keys are encrypted at rest using AES-GCM with the key from `DISTILL_ENCRYPTION_KEY` env var.

---

### 4.2 — LLM pipeline (TypeScript, Vercel AI SDK)

This is the core product logic. Build it in `apps/web/lib/ai/`.

**`client.ts`** — Vercel AI SDK provider config:

```typescript
import { createAnthropic } from "@ai-sdk/anthropic";

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
```

**`pass1.ts`** — Ranking pass:

- Uses `generateObject` from `ai` package.
- Model: `anthropic(process.env.AI_MODEL_PASS1!)`.
- Input: array of Discord messages + community type string.
- Output: Zod-validated array of story candidates.

Zod schema:

```typescript
import { z } from "zod";

export const StorySchema = z.object({
  story_id: z.string(),
  type: z.enum(["win", "debate", "resource", "question", "hot_take", "moment"]),
  title: z.string(),
  why_it_matters: z.string(),
  engagement_signal: z.number().min(1).max(10),
  key_message_ids: z.array(z.string()),
  verbatim_snippets: z.array(z.string()).max(2),
});

export const Pass1OutputSchema = z.object({
  stories: z.array(StorySchema).min(3).max(15),
});
```

**`pass2.ts`** — Drafting pass:

- Uses `generateText` from `ai` package.
- Model: `anthropic(process.env.AI_MODEL_PASS2!)`.
- Input: top 8 stories from Pass 1 with their full source messages re-attached.
- Output: raw markdown string.

**`pipeline.ts`** — Orchestrator:

- Takes `{ communityType: string, serverName: string, messages: Message[] }`.
- Runs pass1 → takes top 8 by `engagement_signal` → re-attaches source messages by `key_message_ids` → runs pass2.
- Returns `{ markdown: string, costUsd: number, pass1TokensIn: number, pass1TokensOut: number, pass2TokensIn: number, pass2TokensOut: number }`.
- Calculates cost from token counts using Anthropic pricing constants.
- **This module is imported by both the experiment script AND the `/api/internal/generate` endpoint.**

**Prompts** — plain text files in `apps/web/lib/ai/prompts/`, loaded at module init via `fs.readFileSync`. Template variables (`{{COMMUNITY_TYPE}}`, `{{MESSAGES_JSON}}`, etc.) interpolated via simple string replace before sending to model.

`pass1.txt`:

```
You are a community editor analyzing one week of Discord messages from {{COMMUNITY_TYPE}}.

Your job is to find the 10–15 conversations from this week that would make the best content for a weekly newsletter sent to people who are NOT in the Discord. The newsletter readers care about:
- Wins and launches by community members
- Substantive technical debates and "I learned X" moments
- Useful resources shared (links, tools, tips)
- Hot takes and opinions that sparked real discussion
- Questions that got great answers
- Anything funny, weird, or memorable

Ignore: greetings, off-topic chatter, single-message announcements with no engagement, support requests with no resolution, anything spam-adjacent, anything from a user in the opt-out list.

For each story candidate, return:
{
  "story_id": "short-slug",
  "type": "win|debate|resource|question|hot_take|moment",
  "title": "one-line description of what happened",
  "why_it_matters": "one sentence on why a newsletter reader would care",
  "engagement_signal": <number 1-10 based on reactions, replies, thread depth>,
  "key_message_ids": ["id1", "id2", ...],
  "verbatim_snippets": ["short direct quotes if essential, max 1-2 per story, max 15 words each"]
}

Return ONLY a valid JSON array of 10–15 stories ranked by engagement_signal descending. No prose before or after the JSON.

Here are this week's messages:
{{MESSAGES_JSON}}
```

`pass2.txt`:

```
You are writing a weekly newsletter for {{COMMUNITY_NAME}}. Your job is to turn this week's top community moments into a draft the community owner can edit and publish.

VOICE: Conversational, warm, slightly nerdy. Address the reader as "you." First-person plural ("we") when referring to the community. Never use the phrases "in this article", "let's dive in", "without further ado", "in conclusion", "game-changer", or any LinkedIn-flavored language. If you find yourself writing those, stop and rewrite.

STRUCTURE:
1. A 1–2 sentence hook at the top that captures the energy of the week. No heading on the hook.
2. 3–5 sections, each with a punchy heading (## level) and 80–150 words of body.
3. Each section paraphrases the conversation in your own words. Members are anonymized as "one member", "a regular", "someone in #general", unless I tell you to attribute.
4. Include direct links where members shared resources (use markdown link syntax).
5. Close with a single italic line: *What to watch next week: ...*

HARD RULES:
- Never invent facts, opinions, or quotes that weren't in the source messages.
- Never use anyone's real Discord username or display name.
- Never write more than 600 words total.
- If a story is thin or boring, cut it. Better 3 strong sections than 5 weak ones.
- Markdown output, ready to paste. No code fences around the whole output.
- Do not include a title at the top — the publishing platform handles that.

Here are this week's top stories with full message context:
{{TOP_STORIES_WITH_MESSAGES}}
```

---

### 4.3 — Experiment CLI script

Build a standalone TypeScript CLI in `scripts/experiment/` that imports and runs the same `pipeline.ts` from `apps/web/lib/ai/`.

```bash
cd scripts/experiment
pnpm install
pnpm tsx index.ts \
  --input ./samples/coolify-week1.json \
  --community-type "developer tool community for self-hosters" \
  --output ./output/coolify-2026-04-12.md
```

The script:

1. Reads the input JSON (DiscordChatExporter format — array of message objects with `id`, `author.name`, `author.id`, `content`, `timestamp`, `reactions[]`, `reference.messageId`).
2. Normalizes messages into the `Message[]` format that `pipeline.ts` expects.
3. Calls the pipeline.
4. Writes markdown to the output path.
5. Logs token usage and estimated cost to stdout.

Include a `samples/README.md` explaining where to place exported Discord JSON. Include `.gitkeep` in `output/`.

Use tsconfig path aliases or a symlink to import from `apps/web/lib/ai/` — the script MUST use the exact same pipeline module, not a copy.

---

### 4.4 — Discord bot + message ingestion

**Bot binary** (`cmd/bot/main.go`): connects to Discord gateway via discordgo.

**Gateway intents:** `GUILDS`, `GUILD_MESSAGES`, `GUILD_MESSAGE_REACTIONS`, `MESSAGE_CONTENT` (privileged), `DIRECT_MESSAGES`.

**Bot permissions (OAuth):** `bot` + `applications.commands` scopes. Permissions: read messages, read message history, send messages, embed links, use slash commands.

**Slash commands** (registered globally on startup):

- `/distill setup` — ephemeral message with dashboard link
- `/distill optout` — adds calling user to per-guild opt-out list, confirms with ephemeral response
- `/distill status` — shows next scheduled run for this server

**Event handlers:**

- `MESSAGE_CREATE` → insert into `messages` table if channel is monitored and author is not opted out
- `MESSAGE_UPDATE` → update `content` if row exists
- `MESSAGE_DELETE` → set `content = '[deleted]'`
- `MESSAGE_REACTION_ADD` → increment `reaction_count`
- `GUILD_DELETE` → set server `status = 'removed'`

**Backfill:** When a channel is added via `POST /api/servers/:id/channels`, enqueue a `BackfillChannelJob` (River). The job fetches 7 days of history via Discord REST API (paginated, 100/request, respecting rate limits) and bulk-inserts into Postgres, skipping messages from opted-out users.

---

### 4.5 — Newsletter generation pipeline (Go worker + Next.js endpoint)

**Scheduler:** River periodic job runs every hour. Checks which servers have `status = 'active'` and whose `schedule_cron` matches the current time. For each match, enqueue a `GenerateNewsletterJob`. Also check that the owning user has `subscription_status IN ('trialing', 'active')` and if trialing, `trial_ends_at > NOW()`.

**`GenerateNewsletterJob` (Go worker):**

1. Load last 7 days of messages from monitored channels, excluding opted-out users.
2. Build JSON payload: `{ community_type, server_name, messages[] }`.
3. POST to `${WEB_INTERNAL_BASE_URL}/api/internal/generate` with `Authorization: Bearer ${INTERNAL_API_KEY}`.
4. Parse response: `{ markdown, cost_usd, pass1_tokens_in, pass1_tokens_out, pass2_tokens_in, pass2_tokens_out }`.
5. Insert into `newsletters` with `status = 'draft'`.
6. Send Discord DM to server admin with link to the newsletter editor page.
7. On failure: retry up to 3 times (River's built-in retry), then insert with `status = 'failed'` and error message.

**Manual trigger:** `POST /api/servers/:id/generate` enqueues the same job immediately.

**Next.js endpoint** (`apps/web/app/api/internal/generate/route.ts`):

1. Validate `Authorization: Bearer ${INTERNAL_API_KEY}`.
2. Validate request body with Zod.
3. Call `pipeline.ts`.
4. Return result as JSON.

---

### 4.6 — Web dashboard

**Auth:** NextAuth v5 with Discord provider. On first login, upsert user into `users` table (use Postgres `ON CONFLICT`). Login redirects to `/dashboard`.

**Pages:**

**Landing page** (`/(marketing)/page.tsx`) — public. Content:

- Headline: "Your Discord wrote your newsletter this week."
- Subhead: "Distill turns the best discussions in your community into a publishable draft, every Sunday. You hit edit, then publish — straight to Beehiiv, ConvertKit, or Ghost. Stop ghosting your email list."
- CTA: "Start free for 14 days" → Discord OAuth
- How it works: 3 steps (Connect server → Get draft Sunday → Edit and ship)
- Pricing: single card, $49/mo, 14-day free trial, feature list
- FAQ: 4 items (Substack? Member privacy? AI accuracy? Why $49?)
- Footer: "Built by SisleLabs in Sofia."

**Onboarding** (`/(app)/dashboard/onboarding/page.tsx`) — shown on first login when user has 0 servers:

- Step 1: "Add Distill to your Discord server" (bot OAuth URL)
- Step 2: "Pick channels to monitor" (multi-select from server's text channels via Discord API)
- Step 3: "Connect newsletter platform" (Beehiiv / ConvertKit / Ghost / skip)
- Step 4: "You're set — first draft arrives Sunday"

**Dashboard home** (`/(app)/dashboard/page.tsx`) — server list with latest newsletter status. Trial countdown in header if trialing.

**Server settings** (`/(app)/dashboard/servers/[id]/page.tsx`) — manage channels, community type, schedule.

**Newsletter editor** (`/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx`):

- Left: markdown textarea (pre-filled with `edited_markdown ?? draft_markdown`)
- Right: live preview via `react-markdown`
- "Save draft" → PATCH `/api/newsletters/:id`
- "Publish" → POST `/api/newsletters/:id/publish`
- Show cost and timestamp

**Integrations** (`/(app)/dashboard/integrations/page.tsx`) — connect/disconnect publishers. Form: API key + publication ID. Stored encrypted.

---

### 4.7 — Publishing

**Publisher interface** (`apps/web/lib/publishing/types.ts`):

```typescript
export interface PublishRequest {
  markdown: string;
  subject: string;
  publicationId?: string;
  apiKey: string;
}

export interface PublishResult {
  publishedUrl: string;
}

export interface Publisher {
  publish(req: PublishRequest): Promise<PublishResult>;
}
```

**Adapters:** `beehiiv.ts`, `convertkit.ts`, `ghost.ts` — each implements `Publisher`.

**Flow:**

1. User clicks "Publish" → frontend calls `POST /api/newsletters/:id/publish` (Go).
2. Go enqueues `PublishNewsletterJob` (River).
3. Job calls `POST ${WEB_INTERNAL_BASE_URL}/api/internal/publish` with markdown, platform, encrypted API key, publication ID, subject.
4. Next.js endpoint decrypts key, selects adapter, calls it, returns `{ published_url }`.
5. Go worker updates newsletter: `status = 'published'`, `published_url`, `published_at`.

---

### 4.8 — Billing (Stripe)

- **Trial:** 14-day free, starts on user creation, no card required.
- **Trial reminder:** River periodic job (daily) finds users with `trial_ends_at` in 2 days and `subscription_status = 'trialing'`. Sends Discord DM reminder.
- **Trial enforcement:** Generation and publish jobs check `subscription_status IN ('trialing', 'active')` AND `trial_ends_at > NOW()` before proceeding. Return 402 if expired.
- **Dashboard enforcement:** Show "Trial ended — subscribe to continue" banner with checkout button if trial expired.
- **Checkout:** `POST /api/billing/checkout` → Stripe Checkout Session for $49/mo. Success URL → dashboard.
- **Portal:** `POST /api/billing/portal` → Stripe Customer Portal for managing/canceling.
- **Webhooks** (`POST /api/webhooks/stripe`):
  - `customer.subscription.created` → `subscription_status = 'active'`
  - `customer.subscription.updated` → update status
  - `customer.subscription.deleted` → `subscription_status = 'canceled'`
  - `invoice.payment_failed` → `subscription_status = 'past_due'`

---

### 4.9 — Docker Compose + Dockerfiles

`docker-compose.yml` at repo root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: distill
      POSTGRES_USER: distill
      POSTGRES_PASSWORD: distill
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build:
      context: ./apps/api
    command: ["./api"]
    env_file: ./apps/api/.env
    depends_on: [postgres]
    ports:
      - "8080:8080"

  bot:
    build:
      context: ./apps/api
    command: ["./bot"]
    env_file: ./apps/api/.env
    depends_on: [postgres]

  worker:
    build:
      context: ./apps/api
    command: ["./worker"]
    env_file: ./apps/api/.env
    depends_on: [postgres, web]

  web:
    build:
      context: ./apps/web
    env_file: ./apps/web/.env
    depends_on: [postgres]
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

**Go Dockerfile** (`apps/api/Dockerfile`): multi-stage build. Builder stage compiles all three binaries (`api`, `bot`, `worker`). Final stage copies all three into a minimal image.

**Next.js Dockerfile** (`apps/web/Dockerfile`): standard Next.js standalone build.

---

## 5. HTTP API contract

### Go backend routes

| Method | Path                                   | Description                               |
| ------ | -------------------------------------- | ----------------------------------------- |
| GET    | `/api/me`                              | Current user + subscription status        |
| GET    | `/api/servers`                         | List user's servers                       |
| GET    | `/api/servers/:id`                     | Server details + channels                 |
| PATCH  | `/api/servers/:id`                     | Update community type, schedule, status   |
| POST   | `/api/servers/:id/channels`            | Add monitored channel (enqueues backfill) |
| DELETE | `/api/servers/:id/channels/:channelId` | Remove channel                            |
| POST   | `/api/servers/:id/generate`            | Manual newsletter trigger                 |
| GET    | `/api/newsletters`                     | List newsletters (filter by server)       |
| GET    | `/api/newsletters/:id`                 | Newsletter detail                         |
| PATCH  | `/api/newsletters/:id`                 | Update edited markdown                    |
| POST   | `/api/newsletters/:id/publish`         | Enqueue publish                           |
| GET    | `/api/integrations`                    | List connected publishers                 |
| POST   | `/api/integrations/:platform`          | Connect publisher                         |
| DELETE | `/api/integrations/:platform`          | Disconnect                                |
| POST   | `/api/billing/checkout`                | Stripe checkout session                   |
| POST   | `/api/billing/portal`                  | Stripe portal session                     |
| POST   | `/api/webhooks/stripe`                 | Stripe webhooks                           |

### Next.js internal routes (Go worker only)

| Method | Path                     | Auth                    | Description                    |
| ------ | ------------------------ | ----------------------- | ------------------------------ |
| POST   | `/api/internal/generate` | Bearer INTERNAL_API_KEY | Two-pass LLM pipeline          |
| POST   | `/api/internal/publish`  | Bearer INTERNAL_API_KEY | Publish to newsletter platform |

---

## 6. Environment variables

### `apps/api/.env`

```bash
DATABASE_URL=postgres://distill:distill@localhost:5432/distill?sslmode=disable
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_PUBLIC_KEY=
WEB_INTERNAL_BASE_URL=http://web:3000
INTERNAL_API_KEY=          # openssl rand -hex 32
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_CREATOR=
DISTILL_ENCRYPTION_KEY=    # openssl rand -hex 16
APP_BASE_URL=https://distill.sislelabs.com
LOG_LEVEL=info
```

### `apps/web/.env`

```bash
DATABASE_URL=postgres://distill:distill@localhost:5432/distill?sslmode=disable
ANTHROPIC_API_KEY=
AI_MODEL_PASS1=claude-haiku-4-5-20251001
AI_MODEL_PASS2=claude-sonnet-4-6
NEXTAUTH_URL=https://distill.sislelabs.com
NEXTAUTH_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
INTERNAL_API_KEY=          # same as apps/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_BASE_URL=https://distill.sislelabs.com
DISTILL_ENCRYPTION_KEY=    # same as apps/api
```

---

## 7. Out of scope

Do NOT build any of these:

- Multiple newsletters per server
- Daily cadence (weekly only)
- Custom voice training from past newsletters
- Member attribution by Discord username (always anonymize)
- Slack / Telegram / Circle / Skool support
- White-label branding
- Team accounts
- Analytics dashboard (open rates, click rates)
- A/B testing
- Multiple LLM providers (Anthropic only)
- Multi-language (English only)
- Mobile app
- Substack integration (no public API)
- MCP server
- Stripe Connect
- Affiliate program
- Rate limiting
- i18n

**If a feature is not described in Section 4, do not build it.**

---

## 8. Quality checklist

After implementation, verify:

- [ ] `docker-compose up` brings up all services, app reachable at localhost:3000
- [ ] Migrations run on fresh Postgres
- [ ] sqlc generates without errors
- [ ] Bot installable via OAuth URL on a fresh Discord
- [ ] `/distill setup`, `/distill optout`, `/distill status` all work
- [ ] Messages from monitored channels appear in `messages` table
- [ ] Backfill fetches 7 days when channel added
- [ ] Opted-out users excluded from generation
- [ ] `POST /api/servers/:id/generate` produces a draft in `newsletters` table
- [ ] Experiment script runs: `pnpm tsx index.ts --input sample.json --community-type "test" --output out.md`
- [ ] Generated markdown < 600 words, has 3–5 `##` headings
- [ ] Pass 1 output is Zod-validated, no `any` types
- [ ] Token usage logged on every LLM call
- [ ] Dashboard login with Discord works
- [ ] Onboarding completes for new user
- [ ] Newsletter editor shows draft with live preview
- [ ] Save draft persists `edited_markdown`
- [ ] Publish triggers publish flow, updates status
- [ ] Stripe checkout creates subscription
- [ ] Stripe webhooks update `subscription_status`
- [ ] Trial expiry blocks generation, shows banner
- [ ] Landing page renders at `/`
- [ ] `pipeline.ts` is shared between experiment script and `/api/internal/generate`

---

## 9. Implementation notes

- **Build everything in one pass.** This is a complete v1 spec. Implement all of Section 4, in order, without pausing.
- **The LLM pipeline lives in Next.js, not Go.** Do not add any LLM SDK to Go. The Go `llmclient` package is just a thin `net/http` wrapper.
- **Use Vercel AI SDK for all LLM calls.** `generateObject` + Zod for Pass 1. `generateText` for Pass 2. No raw `fetch` to Anthropic.
- **Reuse `lib/ai/pipeline.ts`** between experiment script and production endpoint. Same function, same module.
- **Use sqlc for all Go database access.** No GORM, no ent, no raw `database/sql`.
- **Use River for all Go background work.** No goroutines from handlers, no cron libs.
- **Log token usage on every LLM call.** Vercel AI SDK exposes `usage` on results.
- **Do not add features not in Section 4.** Check Section 7 if unsure.
- **Dependencies in Section 2 are pre-approved.** Ask before adding others.
- **Go style:** short package names, doc comments on exports, errors wrapped with `fmt.Errorf("...: %w", err)`.
- **TypeScript style:** `strict: true`, no `any`, Zod for all external data.

---

**End of PRD.**
