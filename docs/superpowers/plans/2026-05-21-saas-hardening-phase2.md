# Distill SaaS Hardening — Phase 2 (HIGH) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the HIGH-severity audit findings — Redis-backed rate limiting, Stripe webhook idempotency, fail-fast secret startup-guards, explicit `past_due` handling, Discord guild-channel authorization, and graceful proxy error handling.

**Architecture:** A Redis token-bucket rate limiter wraps the Go API (chi middleware) and the Next.js proxy (`middleware.ts`). A `processed_stripe_events` table makes the webhook idempotent. `config.Load()` gains hard guards for critical secrets. The Discord proxy routes verify guild membership against the caller's own OAuth token. Proxy routes wrap `goFetch` so a Go-API outage returns a clean 503.

**Tech Stack:** Go (server-go, sqlc, golang-migrate, chi, `redis/go-redis/v9`), Next.js 16 / TypeScript (`@upstash/redis` or `ioredis` for the edge limiter).

**Verification model:** `go build ./...` / `go test ./...` from `apps/api/`; `pnpm build` from `apps/web/`.

**Prerequisite (already done):** the kuso Redis addon `distill/cache` is provisioned — `REDIS_URL` (+ `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`) is auto-injected into every distill service.

**Scope:** Phase 2 of the launch-hardening spec. Phase 1 shipped; Phase 3 (input caps, CORS, error boundaries, raw_payload, …) is a separate plan. Phase 2 is independently deployable.

---

## File Structure

Go API:
- Create: `apps/api/migrations/009_processed_stripe_events.up.sql` + `.down.sql`
- Create: `apps/api/queries/processed_stripe_events.sql`
- Modify: `apps/api/internal/db/*` (sqlc-regenerated)
- Modify: `apps/api/internal/config/config.go` (secret guards + `RedisURL`)
- Create: `apps/api/internal/ratelimit/ratelimit.go` (Redis token-bucket limiter + chi middleware)
- Modify: `apps/api/internal/http/router.go` (apply the rate-limit middleware)
- Modify: `apps/api/internal/http/webhooks.go` (idempotency + real status on checkout)
- Modify: `apps/api/internal/http/newsletters.go` — server.go — generate.go: nothing structural; `past_due` is already non-active. Only the scheduler comment/handling is clarified.
- Modify: `apps/api/internal/jobs/generate.go` (explicit `past_due` skip)
- Modify: `apps/api/cmd/api/main.go` (pass Redis to the router)
- Modify: `apps/api/go.mod` / `go.sum` (add `redis/go-redis/v9`)

Web:
- Create: `apps/web/middleware.ts` (Redis-backed proxy rate limiting)
- Create: `apps/web/lib/ratelimit.ts` (the limiter helper)
- Modify: `apps/web/app/api/proxy/discord/bot-guilds/route.ts` (filter to user's guilds)
- Modify: `apps/web/app/api/proxy/discord/guilds/[guildId]/channels/route.ts` (membership check)
- Modify: `apps/web/lib/api.ts` (a `goFetchSafe` wrapper) and the proxy routes (use it)
- Modify: `apps/web/app/(app)/subscribe-banner.tsx` (distinguish `past_due`)
- Modify: `apps/web/package.json` (add `ioredis`)

---

## Task 1: Baseline build

**Files:** none (verification)

- [ ] **Step 1: Baseline builds**

Run (from `apps/api/`): `go build ./...` — expect success.
Run (from `apps/web/`): `pnpm install && pnpm build` — expect success.
If either fails, STOP and report BLOCKED.

---

## Task 2: Secret startup-guards in `config.Load()`

**Files:**
- Modify: `apps/api/internal/config/config.go`

- [ ] **Step 1: Add the `RedisURL` field**

In `apps/api/internal/config/config.go`, the `Config` struct has fields
like `DatabaseURL`, `InternalAPIKey`, etc. Add a `RedisURL` field:
```go
	RedisURL            string
```
(place it after `AppBaseURL`). And in `Load()`, in the struct literal,
add:
```go
		RedisURL:            os.Getenv("REDIS_URL"),
```

- [ ] **Step 2: Add hard guards for critical secrets**

In `Load()`, after the existing `if c.DatabaseURL == "" { return ... }`
guard, add guards for the other critical secrets. Insert:
```go
	// Fail fast on a misconfigured deploy rather than booting into
	// confusing runtime errors. These secrets are all required for the
	// app to function correctly.
	required := map[string]string{
		"DISCORD_BOT_TOKEN":      c.DiscordBotToken,
		"INTERNAL_API_KEY":       c.InternalAPIKey,
		"STRIPE_SECRET_KEY":      c.StripeSecretKey,
		"STRIPE_WEBHOOK_SECRET":  c.StripeWebhookSecret,
		"DISTILL_ENCRYPTION_KEY": c.EncryptionKey,
	}
	for name, val := range required {
		if val == "" {
			return nil, fmt.Errorf("%s is required", name)
		}
	}
```
NOTE: this means every Go service (`api`, `worker`, `bot`) now requires
all five secrets at startup. They share the `distill-shared` secret, so
this is fine — but if any service genuinely lacks one, the deploy will
fail loudly (which is the intent). `RedisURL` is NOT in the required
set — rate limiting fails open if Redis is absent (Task 5).

- [ ] **Step 3: Build**

Run (from `apps/api/`): `go build ./...`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/internal/config/config.go
git commit -m "feat(api): fail-fast startup guards for critical secrets; add RedisURL"
```

---

## Task 3: `processed_stripe_events` table + queries

**Files:**
- Create: `apps/api/migrations/009_processed_stripe_events.up.sql` + `.down.sql`
- Create: `apps/api/queries/processed_stripe_events.sql`
- Regenerate: `apps/api/internal/db/*`

- [ ] **Step 1: Create the migration**

Create `apps/api/migrations/009_processed_stripe_events.up.sql`:
```sql
-- Tracks Stripe webhook event IDs that have already been processed, so
-- a retried or out-of-order delivery (Stripe guarantees at-least-once)
-- is not applied twice.
CREATE TABLE processed_stripe_events (
    event_id     TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Create `apps/api/migrations/009_processed_stripe_events.down.sql`:
```sql
DROP TABLE processed_stripe_events;
```

- [ ] **Step 2: Create the query**

Create `apps/api/queries/processed_stripe_events.sql`:
```sql
-- name: ClaimStripeEvent :one
-- Atomically record that a Stripe event is being processed. Returns the
-- event_id on a fresh insert; returns no row if the event was already
-- processed (the caller treats "no row" as "skip, already handled").
INSERT INTO processed_stripe_events (event_id)
VALUES ($1)
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;
```

- [ ] **Step 3: Regenerate sqlc**

Run (from `apps/api/`): `sqlc generate`
Expected: succeeds — `ClaimStripeEvent` appears in generated code.

- [ ] **Step 4: Build**

Run (from `apps/api/`): `go build ./...`
Expected: succeeds (the query is unused so far — fine).

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/009_processed_stripe_events.up.sql apps/api/migrations/009_processed_stripe_events.down.sql apps/api/queries/processed_stripe_events.sql apps/api/internal/db/
git commit -m "feat(api): add processed_stripe_events table for webhook idempotency"
```

---

## Task 4: Stripe webhook idempotency + real checkout status

**Files:**
- Modify: `apps/api/internal/http/webhooks.go`

CONTEXT: `stripeWebhookHandler` verifies the signature, then `switch`es
on `event.Type`. `handleCheckoutCompleted` hardcodes status `"active"`.
The new `ClaimStripeEvent` query returns the event_id on first sight,
nothing on a duplicate. `ClaimStripeEvent` returns `(string, error)`;
sqlc maps "no row" to `pgx.ErrNoRows`.

- [ ] **Step 1: Add the idempotency claim**

In `stripeWebhookHandler`, after `webhook.ConstructEvent` succeeds and
BEFORE the `switch event.Type`, add the idempotency check:
```go
		// Idempotency: Stripe delivers at-least-once. Skip an event we
		// have already processed. ClaimStripeEvent returns no row (an
		// ErrNoRows) when the event_id is already present.
		ctx := r.Context()
		if _, claimErr := s.Queries.ClaimStripeEvent(ctx, event.ID); claimErr != nil {
			if errors.Is(claimErr, pgx.ErrNoRows) {
				slog.Debug("stripe event already processed, skipping", "event_id", event.ID)
				w.WriteHeader(http.StatusOK)
				return
			}
			slog.Error("failed to claim stripe event", "event_id", event.ID, "err", claimErr)
			writeError(w, http.StatusInternalServerError, "failed to record event")
			return
		}
```
Add the needed imports to the file's import block: `"errors"` and
`"github.com/jackc/pgx/v5"` (for `pgx.ErrNoRows`). Confirm `pgx` is not
already imported under a different alias.

- [ ] **Step 2: Use the real subscription status in `handleCheckoutCompleted`**

In `handleCheckoutCompleted`, the status update currently hardcodes
`"active"`:
```go
	_ = s.Queries.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:                 user.ID,
		SubscriptionStatus: "active",
	})
```
Replace the hardcoded `"active"` with the real status from the checkout
session's subscription when available, falling back to `"active"`:
```go
	// Prefer the actual subscription status — a checkout can complete
	// in an "incomplete" state (e.g. SCA still pending). Fall back to
	// "active" only when the session carries no subscription object.
	status := "active"
	if sess.Subscription != nil && sess.Subscription.Status != "" {
		status = string(sess.Subscription.Status)
	}
	_ = s.Queries.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:                 user.ID,
		SubscriptionStatus: status,
	})
```
NOTE: confirm `stripe.CheckoutSession` has a `Subscription` field of a
type with a `.Status` (stripe-go v81 — `sess.Subscription` is
`*stripe.Subscription`). If the field is only an ID string in this SDK
version, keep `"active"` and add a one-line comment saying the
`customer.subscription.created` event (already handled) will correct it
— do not invent an API.

- [ ] **Step 3: Build**

Run (from `apps/api/`): `go build ./...`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/internal/http/webhooks.go
git commit -m "fix(api): idempotent Stripe webhook; use real status on checkout"
```

---

## Task 5: Redis rate-limit middleware (Go API)

**Files:**
- Create: `apps/api/internal/ratelimit/ratelimit.go`
- Modify: `apps/api/go.mod` (add `github.com/redis/go-redis/v9`)
- Modify: `apps/api/internal/http/router.go`
- Modify: `apps/api/cmd/api/main.go`

- [ ] **Step 1: Add the go-redis dependency**

Run (from `apps/api/`): `go get github.com/redis/go-redis/v9@latest`
Expected: `go.mod` / `go.sum` updated.

- [ ] **Step 2: Create the rate-limit package**

Create `apps/api/internal/ratelimit/ratelimit.go`:
```go
// Package ratelimit provides a Redis-backed fixed-window rate limiter
// and a chi middleware that applies it per authenticated user (or per
// client IP when unauthenticated).
package ratelimit

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/sislelabs/distill/apps/api/internal/auth"
)

// Limiter wraps a Redis client with a fixed-window counter.
type Limiter struct {
	rdb    *redis.Client
	limit  int
	window time.Duration
}

// New builds a Limiter from a redis:// URL. A nil/empty URL or an
// unparseable one yields a nil Limiter — callers must treat a nil
// Limiter as "no limiting" (fail-open).
func New(redisURL string, limit int, window time.Duration) *Limiter {
	if redisURL == "" {
		slog.Warn("ratelimit: REDIS_URL empty — rate limiting disabled")
		return nil
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		slog.Error("ratelimit: bad REDIS_URL — rate limiting disabled", "err", err)
		return nil
	}
	return &Limiter{rdb: redis.NewClient(opt), limit: limit, window: window}
}

// allow increments the fixed-window counter for key and reports whether
// the request is under the limit. On any Redis error it fails OPEN
// (returns true) — a limiter outage must never take down the API.
func (l *Limiter) allow(ctx context.Context, key string) bool {
	fullKey := "ratelimit:" + key
	count, err := l.rdb.Incr(ctx, fullKey).Result()
	if err != nil {
		slog.Warn("ratelimit: redis error, failing open", "err", err)
		return true
	}
	if count == 1 {
		// First hit in this window — set the expiry.
		l.rdb.Expire(ctx, fullKey, l.window)
	}
	return count <= int64(l.limit)
}

// Middleware returns a chi-compatible middleware enforcing the limit.
// The bucket key is the authenticated user ID when present, else the
// client IP. A nil Limiter returns a pass-through middleware.
func (l *Limiter) Middleware(next http.Handler) http.Handler {
	if l == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := clientKey(r)
		if !l.allow(r.Context(), key) {
			w.Header().Set("Retry-After", strconv.Itoa(int(l.window.Seconds())))
			http.Error(w, `{"error":"rate limit exceeded — slow down"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientKey prefers the authenticated user ID; falls back to the IP.
func clientKey(r *http.Request) string {
	if uid, ok := auth.UserIDFromContext(r.Context()); ok {
		// pgtype.UUID has a Bytes field; format it stably.
		return "user:" + uuidString(uid)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return "ip:" + host
}
```
IMPORTANT before writing: `auth.UserIDFromContext` returns a
`pgtype.UUID` (confirmed in Phase 1). `pgtype.UUID` has a `.String()`
method in pgx v5 — use `uid.String()` directly instead of a `uuidString`
helper. Rewrite `clientKey`'s user branch as
`return "user:" + uid.String()` and DELETE the `uuidString` reference.
Confirm `pgtype.UUID` has `.String()` by checking
`apps/api/internal/db/models.go` usage; if it does not, marshal via
`uid.Value()`.

- [ ] **Step 3: Wire the limiter into the router**

In `apps/api/internal/http/router.go`:
- The `Server` struct gains a limiter dependency. Add a field:
  ```go
  	RateLimiter *ratelimit.Limiter
  ```
  and import `"github.com/sislelabs/distill/apps/api/internal/ratelimit"`.
- In `NewRouter`, the rate-limit middleware must run AFTER `auth.Middleware`
  inside the authenticated group (so `clientKey` can read the user ID),
  and a separate per-IP instance could guard unauthenticated routes —
  but to keep this simple, apply ONE limiter inside the authenticated
  `r.Group`: after `r.Use(auth.Middleware)`, add:
  ```go
  		r.Use(s.RateLimiter.Middleware)
  ```
  The `/health` and `/api/webhooks/stripe` routes stay unlimited
  (health must always answer; Stripe needs every event).

- [ ] **Step 4: Construct the limiter in `main.go`**

In `apps/api/cmd/api/main.go`, where the `http.Server`/`NewRouter` is
set up and `cfg` is available, construct the limiter and pass it:
```go
	rateLimiter := ratelimit.New(cfg.RedisURL, 120, time.Minute)
```
(120 requests/minute per user — generous for normal use, throttles
abuse.) Add it to the `http.Server`/`NewRouter` `&Server{...}` literal:
`RateLimiter: rateLimiter,`. Add the imports `"time"` and
`"github.com/sislelabs/distill/apps/api/internal/ratelimit"` if not
present. Read `main.go` to match how the `Server` struct is currently
constructed.

- [ ] **Step 5: Build**

Run (from `apps/api/`): `go build ./...`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/api/internal/ratelimit/ apps/api/internal/http/router.go apps/api/cmd/api/main.go apps/api/go.mod apps/api/go.sum
git commit -m "feat(api): Redis-backed per-user rate limiting on the API"
```

---

## Task 6: Redis rate limiting in the Next.js proxy

**Files:**
- Create: `apps/web/lib/ratelimit.ts`
- Create: `apps/web/middleware.ts`
- Modify: `apps/web/package.json` (add `ioredis`)

- [ ] **Step 1: Add ioredis**

Run (from `apps/web/`): `pnpm add ioredis`
Expected: `package.json` gains `ioredis`.

- [ ] **Step 2: Create the limiter helper**

Create `apps/web/lib/ratelimit.ts`:
```ts
import Redis from "ioredis";

// Single shared Redis client. REDIS_URL is injected by the kuso Redis
// addon. If it is missing, `redis` stays null and rate limiting is
// disabled (fail-open) — a limiter outage must not break the app.
let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  } catch {
    redis = null;
  }
}

// rateLimit increments a fixed-window counter for `key` and reports
// whether the caller is still under `limit` requests per `windowSec`.
// Fails OPEN on any Redis error.
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  if (!redis) return true;
  try {
    const fullKey = `ratelimit:web:${key}`;
    const count = await redis.incr(fullKey);
    if (count === 1) await redis.expire(fullKey, windowSec);
    return count <= limit;
  } catch {
    return true;
  }
}
```

- [ ] **Step 3: Create the middleware**

Create `apps/web/middleware.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";

// Rate-limits the proxy API surface. The generate/LLM routes get a
// tighter bucket than the rest. Keyed by client IP (middleware runs
// before route auth, so the session user id is not yet available — IP
// is the available signal at this layer; the Go API additionally
// limits per-user).
export const config = {
  matcher: ["/api/proxy/:path*"],
};

export async function middleware(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const path = req.nextUrl.pathname;

  // Expensive generation routes: tight bucket. Everything else: loose.
  const isGenerate = /\/generate|\/regenerate-section|\/subject-lines/.test(path);
  const [limit, windowSec] = isGenerate ? [10, 60] : [120, 60];

  const ok = await rateLimit(`${ip}:${isGenerate ? "gen" : "api"}`, limit, windowSec);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429 },
    );
  }
  return NextResponse.next();
}
```
NOTE: `ioredis` uses Node APIs — confirm the middleware runs in the
Node.js runtime, not Edge. Next.js 16 middleware defaults to the Edge
runtime, which `ioredis` does not support. Add to `middleware.ts`:
```ts
export const runtime = "nodejs";
```
If Next.js 16 rejects `runtime = "nodejs"` in middleware (older
versions did), the fallback is to do the rate-limit check inside a
shared helper called at the top of each proxy route handler instead of
in `middleware.ts` — but try the `nodejs` runtime first; Next.js 16
supports Node middleware.

- [ ] **Step 4: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds. If the build fails because middleware cannot use
the Node runtime, implement the fallback (per-route helper) noted above
and re-build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ratelimit.ts apps/web/middleware.ts apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat(web): Redis-backed rate limiting on the proxy API"
```

---

## Task 7: Discord guild-channel authorization

**Files:**
- Modify: `apps/web/app/api/proxy/discord/bot-guilds/route.ts`
- Modify: `apps/web/app/api/proxy/discord/guilds/[guildId]/channels/route.ts`

CONTEXT: `bot-guilds` returns EVERY guild the bot is in to any logged-in
user. `guilds/[guildId]/channels` returns any guild's channels without
checking the caller belongs to that guild. Both must intersect with the
caller's own Discord guilds, fetched via their OAuth access token
(`session.accessToken`).

- [ ] **Step 1: Filter `bot-guilds` to the caller's guilds**

Replace the body of `apps/web/app/api/proxy/discord/bot-guilds/route.ts`
GET handler with a version that intersects bot guilds with the user's
guilds:
```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const accessToken = (session as { accessToken?: string }).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "no discord access token" }, { status: 401 });
  }

  // The guilds the BOT is in.
  const botResp = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  const botData = await botResp.json();
  if (!botResp.ok) {
    return NextResponse.json(botData, { status: botResp.status });
  }

  // The guilds the USER is in (their own OAuth token).
  const userResp = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userResp.ok) {
    return NextResponse.json(
      { error: "couldn't verify your Discord servers" },
      { status: 502 },
    );
  }
  const userData = await userResp.json();
  const userGuildIds = new Set(
    (Array.isArray(userData) ? userData : []).map((g: { id: string }) => g.id),
  );

  // Only return bot guilds the requesting user also belongs to.
  const guilds = (Array.isArray(botData) ? botData : [])
    .filter((g: { id: string }) => userGuildIds.has(g.id))
    .map((g: { id: string; name: string; icon: string | null }) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
    }));
  return NextResponse.json(guilds);
}
```

- [ ] **Step 2: Membership-check `guilds/[guildId]/channels`**

In `apps/web/app/api/proxy/discord/guilds/[guildId]/channels/route.ts`,
the handler already extracts `accessToken`. After resolving `guildId`
and BEFORE the bot-token channels fetch, add a membership check:
```ts
  // Verify the caller actually belongs to this guild — otherwise any
  // logged-in user could enumerate channels of any guild the bot is in.
  const userGuildsResp = await fetch(
    "https://discord.com/api/v10/users/@me/guilds",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!userGuildsResp.ok) {
    return NextResponse.json(
      { error: "couldn't verify your Discord servers" },
      { status: 502 },
    );
  }
  const userGuilds = await userGuildsResp.json();
  const isMember =
    Array.isArray(userGuilds) &&
    userGuilds.some((g: { id: string }) => g.id === guildId);
  if (!isMember) {
    return NextResponse.json(
      { error: "you don't have access to this server" },
      { status: 403 },
    );
  }
```
Insert this right after the `const { guildId } = await params;` line and
before the existing `fetch(.../guilds/${guildId}/channels...)`.

- [ ] **Step 3: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/api/proxy/discord/bot-guilds/route.ts" "apps/web/app/api/proxy/discord/guilds/[guildId]/channels/route.ts"
git commit -m "fix(web): authorize Discord guild/channel access to the caller's own guilds"
```

---

## Task 8: Proxy error handling — graceful 503 on Go-API outage

**Files:**
- Modify: `apps/web/lib/api.ts`
- Modify: all `apps/web/app/api/proxy/**/route.ts` that call `goFetch`

CONTEXT: Proxy routes call `goFetch(...)` then `.json()` with no
try/catch — a Go-API outage (ECONNREFUSED) throws and Next.js returns a
raw HTML 500. A small wrapper that proxies the call and returns a clean
503 on a network failure fixes every route uniformly.

- [ ] **Step 1: Read `lib/api.ts`**

Run: `cat apps/web/lib/api.ts`. Note the `goFetch` signature (it returns
a `Response`) and how it builds the request.

- [ ] **Step 2: Add a `proxyJson` helper**

In `apps/web/lib/api.ts`, add an exported helper that performs the
goFetch + `.json()` + `NextResponse` round-trip with error handling.
Append:
```ts
import { NextResponse } from "next/server";

// proxyJson forwards a request to the Go API via goFetch and returns
// the JSON response. On a network failure (Go API unreachable) it
// returns a clean 503 instead of letting the exception bubble into a
// raw Next.js 500.
export async function proxyJson(
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  try {
    const resp = await goFetch(path, init);
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
```
(If `lib/api.ts` already imports `NextResponse` or has its own response
helpers, adapt — do not duplicate the import.)

- [ ] **Step 3: Convert the proxy routes to `proxyJson`**

For each route under `apps/web/app/api/proxy/` whose handler is the
simple `goFetch(...) → .json() → NextResponse.json(...)` shape, replace
that body with a single `return proxyJson(...)` call. Concretely, for
`apps/web/app/api/proxy/servers/route.ts`:
```ts
import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api";

export async function GET() {
  return proxyJson("/api/servers");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyJson("/api/servers", { method: "POST", body });
}
```
Apply the same conversion to every proxy route file that is a thin
goFetch passthrough — at minimum: `servers/route.ts`,
`servers/[id]/route.ts`, `servers/[id]/channels/route.ts`,
`servers/[id]/channels/[channelId]/route.ts`,
`servers/[id]/newsletters/route.ts`,
`servers/[id]/generation-quota/route.ts`,
`servers/[id]/generate/route.ts`, `newsletters/[id]/route.ts`,
`newsletters/[id]/publish/route.ts`, `integrations/route.ts`,
`integrations/[platform]/route.ts`, `me/route.ts`,
`billing/checkout/route.ts`, `billing/portal/route.ts`,
`admin/dashboard/route.ts`.
DO NOT convert routes that do more than a thin passthrough — the
`generate-now`, `regenerate-section`, and `subject-lines` routes run LLM
pipelines and quota gates; leave their structure intact (they already
handle errors). For those three, only ensure their existing `goFetch`
calls (the quota gate, the newsletter load, the save) are within
try/catch — if any bare `goFetch().json()` remains, wrap it. Read each
file before editing; if a route is not a thin passthrough, leave it.

- [ ] **Step 4: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/api.ts apps/web/app/api/proxy/
git commit -m "feat(web): proxy routes return clean 503 when the Go API is down"
```

---

## Task 9: Explicit `past_due` handling in the scheduler

**Files:**
- Modify: `apps/api/internal/jobs/generate.go`
- Modify: `apps/web/app/(app)/subscribe-banner.tsx`

CONTEXT: The API gates (`newsletters.go`, `servers.go`) already use
`SubscriptionStatus != "active"`, so `past_due` correctly does NOT get
Pro treatment there — no change needed. This task makes the scheduler's
handling explicit and the UI banner honest.

- [ ] **Step 1: Read the scheduler gate**

Run: `sed -n '40,70p' apps/api/internal/jobs/generate.go`. Find the
block that checks `user.SubscriptionStatus` and skips the scheduled
generation for non-active users (around the `slog.Warn("user
subscription not active, skipping", ...)` line).

- [ ] **Step 2: Make the `past_due` skip explicit**

The scheduler skip currently logs a generic "not active" warning. Make
`past_due` explicit so logs/ops can distinguish a lapsed payer from a
never-subscribed user. In the block that decides whether to skip,
adjust the log to name the case — if the current code is roughly:
```go
		if user.SubscriptionStatus != "active" && !trialingValid {
			slog.Warn("user subscription not active, skipping", "status", user.SubscriptionStatus)
			return nil
		}
```
change the log line to:
```go
		if user.SubscriptionStatus != "active" && !trialingValid {
			reason := "not subscribed"
			if user.SubscriptionStatus == "past_due" {
				reason = "payment past due"
			}
			slog.Warn("skipping scheduled generation", "reason", reason, "status", user.SubscriptionStatus)
			return nil
		}
```
Read the EXACT current code first (the `trialingValid` variable name
may differ) and adapt — the only behavior change is a clearer log; the
skip itself is unchanged. If the current code has no `trialingValid`-
style variable, keep the existing condition verbatim and only enrich
the `slog.Warn` call.

- [ ] **Step 3: Distinguish `past_due` in the subscribe banner**

In `apps/web/app/(app)/subscribe-banner.tsx`, the banner currently shows
"You're on the free plan" for any non-`active` user. Read the file;
find where it decides the banner message from the subscription status.
Add a `past_due` branch so a lapsed payer sees an accurate message.
Where the status is checked, add handling so that when the status is
`"past_due"` the banner reads (text and a billing link/button as the
component already provides for the free case):
```tsx
        Your payment is past due — update your billing to keep Pro features.
```
Adapt to the component's actual structure (it may use a `status` prop or
fetch it). The free-plan and active cases stay unchanged; only add the
`past_due` message branch. If the component has no access to the
subscription status at all, add a minimal status check consistent with
how the rest of the app reads it (`/api/proxy/me` returns
`subscription_status`).

- [ ] **Step 4: Build**

Run (from `apps/api/`): `go build ./...` — expect success.
Run (from `apps/web/`): `pnpm build` — expect success.

- [ ] **Step 5: Commit**

```bash
git add apps/api/internal/jobs/generate.go "apps/web/app/(app)/subscribe-banner.tsx"
git commit -m "feat: explicit past_due handling in scheduler logs and the subscribe banner"
```

---

## Task 10: Phase 2 full verification

**Files:** none (verification only)

- [ ] **Step 1: Clean builds**

Run (from `apps/api/`): `go build ./... && go test ./...` — expect pass.
Run (from `apps/web/`): `rm -rf .next && pnpm build` — expect success.

- [ ] **Step 2: Confirm Phase-2 wiring**

Run (from repo root):
```bash
ls apps/api/migrations/009_processed_stripe_events.*
grep -rn "ClaimStripeEvent" apps/api/internal/http/webhooks.go
grep -rn "required :=\|RedisURL" apps/api/internal/config/config.go
ls apps/api/internal/ratelimit/ratelimit.go
grep -rn "RateLimiter.Middleware\|RateLimiter " apps/api/internal/http/router.go
ls apps/web/middleware.ts apps/web/lib/ratelimit.ts
grep -rln "users/@me/guilds" "apps/web/app/api/proxy/discord/bot-guilds/route.ts" "apps/web/app/api/proxy/discord/guilds/[guildId]/channels/route.ts"
grep -rn "proxyJson" apps/web/lib/api.ts
```
Expected: migration 009 exists; webhook claims the event; config has
the secret guards + `RedisURL`; the ratelimit package exists and is
wired into the router; the web middleware + limiter exist; both Discord
routes fetch the user's own guilds; `proxyJson` exists.

- [ ] **Step 3: Final commit (only if cleanup was needed)**

```bash
git add -A apps/api apps/web
git commit -m "chore: Phase 2 hardening verification cleanup"
```
If nothing changed, skip.

---

## Rollout (post-merge — performed manually, not part of subagent execution)

1. The kuso Redis addon `distill/cache` is already provisioned;
   `REDIS_URL` is injected into all distill services.
2. Deploy `apps/api` — migration `009_processed_stripe_events` runs at
   startup; the secret guards now enforce that all five critical
   secrets are present (a missing one fails the deploy loudly — that is
   intended).
3. Repoint the `worker` and `bot` env CRs to the new api image tag
   (the `kuso build trigger` 500 bug means worker/bot don't auto-build
   — known distill-deploy step).
4. Deploy `apps/web`.
5. Live checks: hammering a proxy route returns 429 after the limit;
   a replayed Stripe event is a no-op; `/api/proxy/discord/bot-guilds`
   only returns guilds the caller belongs to.

Phase 3 (input caps, CORS lockdown, error.tsx boundaries, raw_payload
retention, hardcoded-URL fix, allowlist validation, rehype-sanitize,
per-user caps, …) is a separate plan.

---

## Self-Review Notes

- **Spec coverage (Phase 2):** §2.1 Redis rate limiting → Tasks 5 (Go) +
  6 (web). §2.2 webhook idempotency → Tasks 3 + 4. §2.3 secret guards →
  Task 2. §2.4 `past_due` → Task 9 (the API gates already treat
  `past_due` as non-active — Task 9 makes the scheduler + UI explicit,
  which is the remaining gap). §2.5 Discord guild-channel auth → Task 7.
  §2.6 proxy error handling → Task 8. Verification → Tasks 1, 10.
- **Placeholder scan:** every code step has complete code. Steps that
  say "confirm the SDK field" / "read the exact current code" are
  deliberate guards against version drift in stripe-go and against the
  scheduler's exact variable names — concrete read-then-adapt
  instructions, not vague placeholders. Task 6 names a concrete Node-
  runtime fallback rather than leaving it open.
- **Type consistency:** `ClaimStripeEvent` is `:one` returning
  `(string, error)`, "no row" → `pgx.ErrNoRows`, used that way in Task 4.
  `ratelimit.New(redisURL string, limit int, window time.Duration)
  *Limiter` (Task 5) is called as `ratelimit.New(cfg.RedisURL, 120,
  time.Minute)` in Task 5 Step 4; `(*Limiter).Middleware` is a
  `func(http.Handler) http.Handler` used as `r.Use(s.RateLimiter.Middleware)`.
  `Config.RedisURL` (Task 2) feeds `ratelimit.New` (Task 5). The web
  `rateLimit(key, limit, windowSec)` (Task 6) is called in
  `middleware.ts` with `(string, number, number)`. `proxyJson(path,
  init?)` (Task 8) returns `NextResponse`.
