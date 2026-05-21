# Distill — SaaS Launch-Readiness Hardening — Design

**Date:** 2026-05-21
**Status:** Approved
**Repo:** distill (`/Users/sisle/code/work/distill`)

## Overview

A single phased plan that fixes the 34 code-side findings from a pre-launch
audit (security, abuse/rate-limiting, billing, legal, ops, error handling).
Phases are severity-ordered AND independently shippable — Phase 1
(launch-blockers) can merge + deploy before Phase 3 is written.

**Out of scope — infra, owned by the operator (NOT this plan):**
rotating leaked secrets, firewalling the public Postgres port + enabling
`sslmode=require`, scrubbing the `.next/standalone/.env` build artifact,
and blocking `/api/internal/*` at the reverse proxy. These are restated
in the rollout section as a reminder but no task implements them.

**Retention window decision:** Discord messages are retained **30 days**
after collection, then deleted by a cleanup job. 30 days covers a missed
weekly generation cycle plus buffer and makes the FAQ retention claim
truthful.

**Rate-limit store decision:** a kuso Redis addon, shared across pods.
**LLM-quota decision:** a `usage_counters` table for per-day caps; the
Pro monthly cap re-checked atomically server-side.

---

## Phase 1 — Launch-blockers (CRITICAL)

### 1.1 Legal pages

Create `apps/web/app/(marketing)/privacy/page.tsx` and
`apps/web/app/(marketing)/terms/page.tsx` — real, distill-specific
content (not placeholder):
- **Privacy Policy:** what is collected (Discord messages from monitored
  channels, Discord user ID + username + email + avatar, Stripe customer
  ID); how it's processed (Google Gemini for generation; never used to
  train models); third parties (Discord, Stripe, Google, and the
  publisher platforms Beehiiv/ConvertKit/Ghost); the 30-day message
  retention; the `/optout` mechanism and that opt-out deletes stored
  messages; account deletion; data location; operator identity
  (SisleLabs, Sofia, Bulgaria — EU/GDPR jurisdiction); contact.
- **Terms of Service:** service description, $49/mo subscription terms,
  cancellation/refund stance, acceptable use, the user's responsibility
  to have permission to monitor their Discord server, disclaimer of
  warranties, limitation of liability, governing law (Bulgaria),
  changes-to-terms clause.
- Both rendered with the marketing page's typography. A short italic
  line at the top of each: "Last updated 2026-05-21" — and the operator
  should have a lawyer review before scaling (operator's follow-up,
  noted but not blocking).
- Footer (`apps/web/app/(marketing)/page.tsx`): add "Privacy" and
  "Terms" links.

### 1.2 Make the message-retention claims true

Two coupled fixes — the marketing/FAQ copy currently claims things the
code does not do.

**Opt-out deletes stored messages.** Add a sqlc query
`DeleteMessagesByAuthorInServer` —
`DELETE FROM messages WHERE server_id = $1 AND discord_author_id = $2`.
The Discord bot's `/optout` handler (`apps/api/internal/discord/commands.go`,
the `optout` case) currently only calls `AddOptout`. After `AddOptout`
succeeds, also call `DeleteMessagesByAuthorInServer` for that
(server, discord user). This makes the marketing claim "their messages
are gone — never stored" true for past messages, not just future ones.

**Retention cleanup job.** Add a sqlc query `DeleteMessagesOlderThan` —
`DELETE FROM messages WHERE created_at < $1`. Add a River periodic job
`MessageRetentionWorker` (mirror `SchedulerWorker` in
`apps/api/internal/jobs/scheduler.go`): on each run it deletes messages
with `created_at` older than 30 days. Register it as a daily
`river.NewPeriodicJob` in `apps/api/cmd/worker/main.go`'s `PeriodicJobs`
list (alongside the existing periodic jobs). This makes the FAQ claim
("raw messages are deleted after the draft is generated") defensible —
the FAQ answer (`apps/web/app/(marketing)/_components/faq.tsx`) is also
reworded to accurately say messages are deleted within 30 days.

### 1.3 LLM-endpoint quotas + atomic Pro cap

New migration `008_usage_counters` — a per-user per-day counter:
```sql
CREATE TABLE usage_counters (
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind     TEXT NOT NULL,          -- e.g. 'regenerate_section', 'subject_lines'
    day      DATE NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, kind, day)
);
```
sqlc queries: `IncrementUsageCounter` (INSERT … ON CONFLICT DO UPDATE
SET count = count + 1 RETURNING count) and `GetUsageCounter`.

- **`regenerate-section`** (`apps/web/app/api/proxy/newsletters/[id]/regenerate-section/route.ts`):
  before the LLM call, increment the `regenerate_section` counter for
  the day; if the returned count exceeds **20**, reject with 429. The
  Go API exposes a small endpoint (or the existing internal route)
  for the web proxy to record/check — see implementation note below.
- **`subject-lines`** (`.../subject-lines/route.ts`): same, capped at
  **10/day**.
- **Atomic Pro monthly cap:** `createNewsletter`
  (`apps/api/internal/http/newsletters.go`) currently re-checks the
  quota only for free-tier users. Add the Pro-tier re-check too: before
  the `CreateNewsletter` insert, for `subscription_status == "active"`
  non-admins, call `CountOnDemandThisMonth`; if it is already >= the Pro
  limit (10), reject with 402. This closes the parallel-request bypass.
- **Free-tier TOCTOU:** the existing `GuildFreeGenerationUsed` (SELECT)
  + `MarkGuildFreeGenerationUsed` (INSERT) pair in `createNewsletter` is
  a check-then-act race. Tighten it: keep the early SELECT-based reject
  for the common case, but the authoritative gate is the INSERT —
  `MarkGuildFreeGenerationUsed` already returns nothing; add a variant
  `ClaimGuildFreeGeneration` that does `INSERT … ON CONFLICT DO NOTHING
  RETURNING discord_guild_id` and treats "no row returned" (conflict) as
  "already claimed → reject". For free-tier on-demand, claim BEFORE
  running/saving; if the claim loses the race, reject. (The LLM call
  happens in the web proxy before the save, so the claim at save time
  is the correctness gate; a lost race means one wasted generation at
  most — acceptable, bounded.)

Implementation note: the day-counter checks live server-side in the Go
API. Add Go endpoints `POST /api/usage/{kind}` (increment+return count,
reject if over a per-kind limit) or fold the check into the existing
internal-generate flow — the plan will pick the lowest-friction wiring
after reading the regenerate/subject-line routes; both currently call
the LLM directly from the Next.js proxy. The counter table + queries are
the fixed contract; the exact endpoint shape is a plan-level detail.

### 1.4 Internal-route key check → timing-safe

`apps/web/app/api/internal/generate/route.ts` and `.../publish/route.ts`
compare `INTERNAL_API_KEY` with `!==`. Replace with
`crypto.timingSafeEqual` over equal-length buffers (guard against length
mismatch first). Network-level blocking of `/api/internal/*` is the
operator's reverse-proxy task — not in this plan.

---

## Phase 2 — HIGH

### 2.1 Redis-backed rate limiting

- Add a kuso Redis addon to the distill project (`kuso project addon add
  distill cache --kind redis`) — this is an infra step the plan's
  rollout calls out; `REDIS_URL` is then auto-injected into every
  service.
- **Go API:** a `chi` middleware applying a Redis token-bucket limit to
  all `/api/*` routes — per-user (the bearer UUID) when present, else
  per-IP. Generous default (e.g. 60 req/min) with a tighter bucket on
  the generate/expensive paths.
- **Next.js:** add `apps/web/middleware.ts` limiting `/api/proxy/*` —
  especially `/api/proxy/servers/*/generate*` and the
  regenerate/subject-line routes — per session user, Redis-backed.
- A rate-limited response is `429` with a clear JSON body.
- If Redis is unreachable, fail OPEN (log + allow) — a limiter outage
  must not take down the app.

### 2.2 Stripe webhook idempotency

New migration `009_processed_stripe_events`:
```sql
CREATE TABLE processed_stripe_events (
    event_id     TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
In the Go webhook handler (`apps/api/internal/http/webhooks.go`), after
signature verification and before dispatching: `INSERT … ON CONFLICT DO
NOTHING RETURNING event_id`; if no row returned (already processed),
ack 200 and skip. This makes webhook processing idempotent and
order-tolerant.

### 2.3 Secret startup-guards

`apps/api/internal/config/config.go` `Load()` currently only guards
`DATABASE_URL`. Add hard guards (return an error → process exits) for
empty `StripeSecretKey`, `StripeWebhookSecret`, `EncryptionKey`,
`DiscordBotToken`, `InternalAPIKey`. A misconfigured deploy should fail
fast and loud, not boot into silent runtime failures.

### 2.4 `past_due` subscription gating

The API gates (`newsletters.go`, `servers.go`) and the scheduler
(`generate.go`) branch on `subscription_status == "active"`. A
`past_due` user currently falls through to free-tier behavior silently.
Make the handling explicit and consistent: `past_due` is treated as
not-entitled-to-Pro (same as inactive) across all three sites, and the
subscribe-banner copy reflects it. No new states invented — just
explicit `past_due` handling.

### 2.5 Discord guild-channel authorization

`/api/proxy/discord/bot-guilds` and
`/api/proxy/discord/guilds/[guildId]/channels` currently let any
logged-in user enumerate every guild the bot is in / any guild's
channels. Fix: before returning data for a `guildId`, verify the
requesting user is a member of that guild — fetch the user's own guilds
via their OAuth access token (`GET /users/@me/guilds` with
`Bearer <session.accessToken>`) and intersect. `bot-guilds` is filtered
to the intersection of (bot guilds) ∩ (user's guilds).

### 2.6 Proxy error handling

Every `apps/web/app/api/proxy/**/route.ts` calls `goFetch(...)` then
`.json()` with no `try/catch` — a Go-API outage produces a raw Next.js
500. Wrap each proxy handler's `goFetch` + `.json()` in `try/catch`,
returning a structured `503 { error: "Service temporarily unavailable" }`
on a network failure. Apply consistently to all proxy routes (a small
shared helper is acceptable).

---

## Phase 3 — MEDIUM / LOW

Small, low-risk hardening — each is a focused edit:
- **Input size caps:** `http.MaxBytesReader(w, r.Body, 1<<20)` on all
  mutating Go handlers; cap `voice_sample` (~10k chars), `edited_markdown`,
  and the `sources` JSONB (~1 MB) with explicit length checks.
- **CORS lockdown:** `apps/api/internal/http/router.go` — replace
  `Access-Control-Allow-Origin: *` with the explicit `APP_BASE_URL`
  origin.
- **`error.tsx` boundaries:** add `apps/web/app/error.tsx` and
  `apps/web/app/(app)/error.tsx` — branded "something went wrong" + retry.
- **`raw_payload` retention:** the 30-day cleanup job (1.2) already
  removes whole rows; additionally stop storing the full
  `messages.raw_payload` — write `{}` (the LLM pipeline only uses
  `content`). Reduces stored sensitive data.
- **Hardcoded URL:** `apps/api/internal/jobs/trial_reminder.go` uses
  `https://distill.so/billing` — change to `cfg.AppBaseURL + "/billing"`.
- **Allowlist validation:** `status` (servers — `active`/`removed`),
  `platform` (integrations — `beehiiv`/`convertkit`/`ghost`),
  `schedule_cron` (valid cron) validated in their handlers.
- **`rehype-sanitize`:** add it as a plugin to the `NewsletterMarkdown`
  `ReactMarkdown` so future raw-HTML rendering can't introduce XSS.
- **Stripe webhook body limit:** raise `io.LimitReader` 64 KB → 512 KB
  in `webhooks.go`.
- **Per-user caps:** cap monitored channels per server (~20) in
  `addChannel`; a sane per-user server count cap.
- **Admin proxy defense-in-depth:** `/api/proxy/admin/dashboard` —
  early-exit for non-admin sessions at the Next.js layer.
- **`GET /api/me` projection:** return a projected safe user shape
  (omit `stripe_customer_id`, internal timestamps) instead of the raw
  `db.User`.
- **`trialing` status:** the UI banner lumps `trialing` into "free
  plan" — distinguish it, or migrate stale `trialing` rows to
  `inactive` (the plan picks the lower-risk option after checking how
  many such rows exist).
- **Auth-guard the proxy generate routes:** add an early `auth()` check
  in the `generate` / `generation-quota` proxy routes for consistency.
- **Publish worker re-check:** the publish River job re-checks
  subscription status at execution time.

---

## Testing & Rollout

- `apps/api` has minimal tests, `apps/web` has none. Verification per
  task is `go build ./...` / `go test ./...` (api) and `pnpm build`
  (web), plus described live checks.
- **Phases ship independently.** Phase 1 merges + deploys (api + web)
  before Phase 2 is implemented. Phase 2 requires the kuso Redis addon
  to be provisioned first (`kuso project addon add distill cache --kind
  redis`) — the plan calls this out as its first Phase-2 step.
- New migrations (`008_usage_counters`, `009_processed_stripe_events`)
  run at api startup via golang-migrate.

## Operator responsibilities (NOT implemented by this plan)

Restated so they are not forgotten:
1. Rotate all leaked secrets (Stripe, Discord, NextAuth/Auth, encryption
   key, internal key, DB password). Note: rotating `DISTILL_ENCRYPTION_KEY`
   invalidates stored publisher API keys — users reconnect, or do a
   re-encrypt migration.
2. Firewall Postgres `:5432` to app IPs only; set `sslmode=require`.
3. Ensure `.next/` (incl. `standalone/.env`) is never committed or
   shipped in an image layer.
4. Block `/api/internal/*` at the reverse proxy to internal IPs only.
5. Provision the kuso Redis addon before deploying Phase 2.

## Risks & Mitigations

- **Scope is large (34 items).** Mitigated by phasing — each phase is a
  coherent, independently deployable unit; Phase 1 gets the product
  launch-safe even if 2/3 land later.
- **Redis is a new dependency + failure mode.** Mitigated by fail-open
  rate limiting — a Redis outage degrades to "no limiting," never an
  outage.
- **The LLM day-counter wiring** spans the Next.js proxy and the Go API
  (the proxy currently calls the LLM directly). The counter table +
  queries are fixed; the exact check endpoint is a plan-level detail
  resolved by reading the two routes during planning.
- **Atomic Pro cap** changes `createNewsletter` behavior — a Pro user at
  exactly the limit now gets rejected server-side. Intended; the UI
  pre-check already shows the limit, so this only closes the bypass.

## Success Criteria

- `/privacy` and `/terms` exist with real content, linked in the footer.
- The FAQ/marketing retention + opt-out claims are factually true (opt-out
  deletes stored messages; a 30-day cleanup job runs).
- `regenerate-section` and `subject-lines` are capped per-day;
  the Pro monthly cap cannot be bypassed by parallel requests.
- Rate limiting (Redis-backed) is active on the API and the web proxy.
- Stripe webhooks are idempotent; the app fails fast on missing secrets.
- `past_due` users are consistently treated as not-Pro.
- Discord guild/channel endpoints no longer leak other users' guilds.
- Proxy routes return a clean 503 when the Go API is down.
- All Phase-3 hardening items are applied.
- `apps/api` and `apps/web` build cleanly throughout.
