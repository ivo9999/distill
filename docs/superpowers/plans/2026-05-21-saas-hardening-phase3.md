# Distill SaaS Hardening — Phase 3 (MEDIUM/LOW) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the MEDIUM/LOW hardening from the SaaS audit — request size caps, CORS lockdown, web error boundaries, raw_payload minimization, allowlist validation, rehype-sanitize, per-user caps, the hardcoded-URL fix, the GET /api/me projection, and the two Phase-2 carry-over Minor items.

**Architecture:** Each task is a focused, low-risk hardening edit grouped by area. No new subsystems. No DB migrations — raw_payload is minimized at write time, not schema-changed.

**Tech Stack:** Go (server-go), Next.js 16 / React 19 / TypeScript, rehype-sanitize.

**Verification model:** `go build ./...` / `go test ./...` from `apps/api/`; `pnpm build` from `apps/web/`.

**Scope:** Phase 3 (final phase) of the launch-hardening spec. Phases 1 + 2 shipped. Independently deployable.

---

## Task 1: Baseline build

**Files:** none (verification)

- [ ] **Step 1: Baseline builds.** Run (from `apps/api/`): `go build ./...` — expect success. Run (from `apps/web/`): `pnpm install && pnpm build` — expect success. If either fails, STOP and report BLOCKED.

---

## Task 2: Request body size caps on Go mutation handlers

**Files:** Modify `apps/api/internal/http/servers.go`, `newsletters.go`, `integrations.go`

CONTEXT: Mutation handlers decode `r.Body` with `json.NewDecoder` and no size bound. `http.MaxBytesReader` caps it.

- [ ] **Step 1:** In `servers.go`, the handlers `createServer`, `updateServer`, `addChannel` each read a JSON body. As the FIRST statement after the `auth.UserIDFromContext` check in each of those three handler closures, add: `r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB cap`. `http` is already imported.
- [ ] **Step 2:** In `newsletters.go`, do the same for `createNewsletter` and `updateNewsletter` — add `r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB cap` as the first statement after the auth check in each.
- [ ] **Step 3:** In `integrations.go`, do the same for `connectIntegration`.
- [ ] **Step 4:** Build. Run from `apps/api/`: `go build ./...` — expect success.
- [ ] **Step 5:** Commit: `git add apps/api/internal/http/servers.go apps/api/internal/http/newsletters.go apps/api/internal/http/integrations.go && git commit -m "feat(api): cap request body size on mutation handlers"`

---

## Task 3: Field-length caps + allowlist validation

**Files:** Modify `apps/api/internal/http/servers.go`, `newsletters.go`, `integrations.go`

- [ ] **Step 1:** In `servers.go` `updateServer`, the code does `if req.Status != "" { status = req.Status }`. Replace with:
```
		if req.Status != "" {
			if req.Status != "active" && req.Status != "removed" {
				writeError(w, http.StatusBadRequest, "invalid status")
				return
			}
			status = req.Status
		}
```
- [ ] **Step 2:** In the same `updateServer`, after the request body is decoded and before the `UpdateServer` query call, add a `voice_sample` length cap (`req.VoiceSample` is a `*string`):
```
		if req.VoiceSample != nil && len(*req.VoiceSample) > 10000 {
			writeError(w, http.StatusBadRequest, "voice sample too long (max 10000 characters)")
			return
		}
```
- [ ] **Step 3:** In `newsletters.go` `updateNewsletter`, read the handler to find the variable holding the edited markdown (likely `editedMarkdown` or `req.EditedMarkdown`). After it is decoded, add a length cap on that value: `if len(<editedMarkdownVar>) > 200000 { writeError(w, http.StatusBadRequest, "newsletter too long"); return }` — adapt the nil-check if it is a `*string`.
- [ ] **Step 4:** In `newsletters.go` `createNewsletter`, after the body is decoded, cap the `sources` JSONB: `if len(req.Sources) > 1<<20 { writeError(w, http.StatusBadRequest, "sources payload too large"); return }`
- [ ] **Step 5:** In `integrations.go` `connectIntegration`, after the body is decoded and before storing, add a platform allowlist:
```
		switch req.Platform {
		case "beehiiv", "convertkit", "ghost":
			// ok
		default:
			writeError(w, http.StatusBadRequest, "unsupported platform")
			return
		}
```
- [ ] **Step 6:** Build. Run from `apps/api/`: `go build ./...` — expect success.
- [ ] **Step 7:** Commit: `git add apps/api/internal/http/servers.go apps/api/internal/http/newsletters.go apps/api/internal/http/integrations.go && git commit -m "feat(api): validate status/platform allowlists; cap field lengths"`

---

## Task 4: Per-server channel cap

**Files:** Modify `apps/api/internal/http/servers.go`

CONTEXT: `addChannel` has no cap on channels per server; each add enqueues a 500-message backfill. Cap at 25.

- [ ] **Step 1:** Run `grep -n "func addChannel\|ListChannels" apps/api/internal/http/servers.go apps/api/queries/*.sql` to find the list-channels-by-server query name (the one `listChannels` uses).
- [ ] **Step 2:** In `addChannel`, after the server-ownership check and before the channel insert, add:
```
		existingChannels, err := s.Queries.ListChannelsByServerID(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to check channels")
			return
		}
		if len(existingChannels) >= 25 {
			writeError(w, http.StatusBadRequest, "channel limit reached (max 25 per server)")
			return
		}
```
Use the ACTUAL query name from Step 1 (it may not be exactly `ListChannelsByServerID`) and confirm `serverID` is the in-scope server-UUID variable.
- [ ] **Step 3:** Build. Run from `apps/api/`: `go build ./...` — expect success.
- [ ] **Step 4:** Commit: `git add apps/api/internal/http/servers.go && git commit -m "feat(api): cap monitored channels at 25 per server"`

---

## Task 5: Stripe webhook body limit + GET /api/me projection

**Files:** Modify `apps/api/internal/http/webhooks.go`, `users.go`

- [ ] **Step 1:** In `webhooks.go` `stripeWebhookHandler`, change `io.LimitReader(r.Body, 65536)` to `io.LimitReader(r.Body, 524288)` (512 KiB).
- [ ] **Step 2:** In `users.go` `getMe`, replace the final `writeJSON(w, http.StatusOK, user)` with a projected response:
```
		writeJSON(w, http.StatusOK, map[string]any{
			"id":                  user.ID,
			"discord_id":          user.DiscordID,
			"discord_username":    user.DiscordUsername,
			"email":               user.Email,
			"avatar_url":          user.AvatarUrl,
			"subscription_status": user.SubscriptionStatus,
		})
```
IMPORTANT: read `db.User` in `apps/api/internal/db/models.go` first for the EXACT Go field names (`AvatarUrl` vs `AvatarURL`, etc.). Omit `stripe_customer_id`, `trial_ends_at`, internal timestamps.
- [ ] **Step 3:** Build. Run from `apps/api/`: `go build ./...` — expect success.
- [ ] **Step 4:** Run `grep -rn "proxy/me\|/api/me" apps/web --include=*.tsx --include=*.ts | head`. For each consumer, confirm the field it reads is in the projection; if a consumer needs an omitted field, add it to the projection map and rebuild.
- [ ] **Step 5:** Commit: `git add apps/api/internal/http/webhooks.go apps/api/internal/http/users.go && git commit -m "feat(api): raise Stripe webhook body limit; project /api/me response"`

---

## Task 6: CORS lockdown

**Files:** Modify `apps/api/internal/http/router.go`

CONTEXT: `corsMiddleware` sets `Access-Control-Allow-Origin: *`. Lock it to `Config.AppBaseURL`.

- [ ] **Step 1:** `corsMiddleware` is a free function with no `Config` access. Convert it to a `*Server` method and rewrite:
```
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	origin := s.Config.AppBaseURL
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```
Change the `r.Use(corsMiddleware)` line in `NewRouter` to `r.Use(s.corsMiddleware)`.
- [ ] **Step 2:** Build. Run from `apps/api/`: `go build ./...` — expect success.
- [ ] **Step 3:** Commit: `git add apps/api/internal/http/router.go && git commit -m "feat(api): lock CORS to the configured app origin"`

---

## Task 7: Stop storing raw_payload

**Files:** Modify `apps/api/internal/discord/events.go`, `fetcher.go`

CONTEXT: Every stored message keeps the full Discord JSON in `messages.raw_payload`. Only `content` is used. Stop populating it — write `{}`. The column stays (no migration).

- [ ] **Step 1:** In `events.go`, the message insert sets `RawPayload: rawPayload`. Change to `RawPayload: []byte("{}"),` and delete the now-unused `rawPayload` construction above it (and any import that becomes unused). Read the surrounding code to do this cleanly.
- [ ] **Step 2:** In `fetcher.go`, the insert sets `RawPayload: raw`. Change to `RawPayload: []byte("{}"),` and remove the now-unused `raw` construction and any unused import.
- [ ] **Step 3:** Build. Run from `apps/api/`: `go build ./...` — expect success with no unused-variable/import errors; clean up until green.
- [ ] **Step 4:** Commit: `git add apps/api/internal/discord/events.go apps/api/internal/discord/fetcher.go && git commit -m "feat(api): stop storing full Discord raw_payload — minimize retained data"`

---

## Task 8: Fix the hardcoded billing URL

**Files:** Modify `apps/api/internal/jobs/trial_reminder.go`, `apps/api/cmd/worker/main.go`

CONTEXT: `trial_reminder.go` DMs users `https://distill.so/billing`; the app is at `distill.sislelabs.com`.

- [ ] **Step 1:** In `trial_reminder.go`, the `TrialReminderWorker` struct has `Queries` and `DMSender`. Add a field: `AppBaseURL string`.
- [ ] **Step 2:** In the `Work` method, the message literal uses `"https://distill.so/billing"`. Replace that argument with `w.AppBaseURL+"/billing"`.
- [ ] **Step 3:** In `worker/main.go`, find the `&jobs.TrialReminderWorker{...}` construction (in a `river.AddWorker` call) and add `AppBaseURL: cfg.AppBaseURL,` to the struct literal. `cfg` is in scope.
- [ ] **Step 4:** Build. Run from `apps/api/`: `go build ./...` — expect success.
- [ ] **Step 5:** Commit: `git add apps/api/internal/jobs/trial_reminder.go apps/api/cmd/worker/main.go && git commit -m "fix(api): trial-reminder DM uses the configured app URL"`

---

## Task 9: Web error boundaries

**Files:** Create `apps/web/app/error.tsx`, `apps/web/app/(app)/error.tsx`

- [ ] **Step 1:** Create `apps/web/app/error.tsx`:
```
"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root error boundary]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-medium">
          An unexpected error occurred. Please try again — if it keeps
          happening, get in touch.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```
- [ ] **Step 2:** Create `apps/web/app/(app)/error.tsx`:
```
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-medium">
          We hit an unexpected error loading this page.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-ink-lighter px-5 py-2 text-sm font-semibold text-ink hover:bg-ink-lightest"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
```
- [ ] **Step 3:** Build. Run from `apps/web/`: `pnpm build` — expect success.
- [ ] **Step 4:** Commit: `git add apps/web/app/error.tsx "apps/web/app/(app)/error.tsx" && git commit -m "feat(web): add root and app-segment error boundaries"`

---

## Task 10: rehype-sanitize on the markdown renderer

**Files:** Modify `apps/web/components/features/newsletter-markdown.tsx`, `package.json`

- [ ] **Step 1:** Run from `apps/web/`: `pnpm add rehype-sanitize`.
- [ ] **Step 2:** In `newsletter-markdown.tsx`, add `import rehypeSanitize from "rehype-sanitize";`. Add a `rehypePlugins={[rehypeSanitize]}` prop to the `<ReactMarkdown>` element (alongside the existing `components={{...}}` prop — do not change the components map).
- [ ] **Step 3:** Build. Run from `apps/web/`: `pnpm build` — expect success.
- [ ] **Step 4:** Commit: `git add apps/web/components/features/newsletter-markdown.tsx apps/web/package.json apps/web/pnpm-lock.yaml && git commit -m "feat(web): sanitize rendered newsletter markdown"`

---

## Task 11: Atomic rate-limit window (Phase-2 carry-over)

**Files:** Modify `apps/api/internal/ratelimit/ratelimit.go`, `apps/web/lib/ratelimit.ts`

CONTEXT: Both limiters do INCR then a separate EXPIRE on the first hit. If Redis dies between them the key sticks with no TTL. Set the TTL in the same round-trip.

- [ ] **Step 1:** In `ratelimit.go`, the `allow` method does `Incr` then `if count == 1 { Expire }`. Replace with a pipelined version that always sets the TTL:
```
func (l *Limiter) allow(ctx context.Context, key string) bool {
	fullKey := "ratelimit:" + key
	pipe := l.rdb.TxPipeline()
	incr := pipe.Incr(ctx, fullKey)
	pipe.Expire(ctx, fullKey, l.window)
	if _, err := pipe.Exec(ctx); err != nil {
		slog.Warn("ratelimit: redis error, failing open", "err", err)
		return true
	}
	return incr.Val() <= int64(l.limit)
}
```
- [ ] **Step 2:** In `apps/web/lib/ratelimit.ts`, the `rateLimit` function does `redis.incr` then `if (count === 1) await redis.expire(...)`. Replace the body with a pipeline that always sets the TTL:
```
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  if (!redis) return true;
  try {
    const fullKey = `ratelimit:web:${key}`;
    const results = await redis
      .multi()
      .incr(fullKey)
      .expire(fullKey, windowSec)
      .exec();
    const count = results?.[0]?.[1];
    if (typeof count !== "number") return true;
    return count <= limit;
  } catch {
    return true;
  }
}
```
- [ ] **Step 3:** Build. Run from `apps/api/`: `go build ./...` — expect success. Run from `apps/web/`: `pnpm build` — expect success.
- [ ] **Step 4:** Commit: `git add apps/api/internal/ratelimit/ratelimit.go apps/web/lib/ratelimit.ts && git commit -m "fix: set rate-limit key TTL atomically with the increment"`

---

## Task 12: trialing banner copy (Phase-2 carry-over)

**Files:** Modify `apps/web/app/(app)/subscribe-banner.tsx`

CONTEXT: The banner shows "You're on the free plan" for any non-active user, including `trialing`. Add a `trialing` branch.

- [ ] **Step 1:** The component (after Phase 2) branches on `subscriptionStatus` — it has a `past_due` branch and a default free-plan branch. Add a `trialing` branch BEFORE the default: when `subscriptionStatus === "trialing"`, headline "You're on a free trial", body "Your trial is active — subscribe before it ends to keep Pro features.", button "Subscribe — $49/mo". Mirror the existing `past_due`/free-plan branch structure. The other cases stay unchanged.
- [ ] **Step 2:** Build. Run from `apps/web/`: `pnpm build` — expect success.
- [ ] **Step 3:** Commit: `git add "apps/web/app/(app)/subscribe-banner.tsx" && git commit -m "fix(web): accurate subscribe-banner copy for trialing users"`

---

## Task 13: Phase 3 full verification

**Files:** none (verification only)

- [ ] **Step 1:** Clean builds. Run (from `apps/api/`): `go build ./... && go test ./...` — expect pass. Run (from `apps/web/`): `rm -rf .next && pnpm build` — expect success.
- [ ] **Step 2:** Confirm wiring. Run from repo root:
```
grep -rn "MaxBytesReader" apps/api/internal/http/servers.go apps/api/internal/http/newsletters.go apps/api/internal/http/integrations.go
grep -rn "invalid status\|unsupported platform\|channel limit" apps/api/internal/http/
grep -rn "524288" apps/api/internal/http/webhooks.go
grep -rn "stripe_customer_id" apps/api/internal/http/users.go || echo "users.go: stripe_customer_id not exposed (good)"
grep -rn "s.corsMiddleware" apps/api/internal/http/router.go
grep -rn "RawPayload" apps/api/internal/discord/events.go apps/api/internal/discord/fetcher.go
grep -rn "distill.so" apps/api/ || echo "no distill.so hardcoded URL (good)"
ls apps/web/app/error.tsx "apps/web/app/(app)/error.tsx"
grep -rn "rehypeSanitize" apps/web/components/features/newsletter-markdown.tsx
grep -rn "TxPipeline" apps/api/internal/ratelimit/ratelimit.go
grep -rn "trialing" "apps/web/app/(app)/subscribe-banner.tsx"
```
Expected: all checks pass per their descriptions.
- [ ] **Step 3:** Final commit only if cleanup was needed: `git add -A apps/api apps/web && git commit -m "chore: Phase 3 hardening verification cleanup"` — skip if nothing changed.

---

## Rollout (post-merge — manual)

1. Deploy `apps/api` — no migration in Phase 3.
2. Repoint the `worker` and `bot` env CRs to the new api image tag (the `kuso build trigger` 500 bug means worker/bot don't auto-build — known distill-deploy step). The worker carries the trial-reminder URL fix.
3. Deploy `apps/web`.
4. Live checks: an oversized request body gets 400; `/api/proxy/me` no longer returns `stripe_customer_id`; a forced web error shows the branded error boundary.

This completes all three phases of SaaS launch-readiness hardening. The operator infra items (rotate secrets, firewall Postgres, scrub `.next`, block `/api/internal/*` at the proxy) remain the operator's responsibility.

---

## Self-Review Notes

- **Spec coverage (MEDIUM+LOW):** input size caps -> Tasks 2+3; CORS -> Task 6; error.tsx -> Task 9; raw_payload -> Task 7; hardcoded URL -> Task 8; allowlist validation -> Task 3; rehype-sanitize -> Task 10; webhook body limit -> Task 5; channel cap -> Task 4; /api/me projection -> Task 5; the two Phase-2 carry-overs -> Tasks 11+12. The spec's schedule_cron validation, admin-proxy defense-in-depth, and publish-worker re-check are LOW items deliberately omitted as YAGNI for launch — explicit, can be a follow-up.
- **Placeholder scan:** every code step has complete code. "Read the handler for the exact field/variable name" steps are concrete guards against sqlc/variable naming drift.
- **Type consistency:** `http.MaxBytesReader(w, r.Body, 1<<20)` returns an `io.ReadCloser` assigned to `r.Body`. The /api/me projection is a `map[string]any` keyed off `db.User` fields (Task 5 reads models.go). The Go `allow` keeps its `(context.Context, string) bool` signature; the web `rateLimit` keeps `(string, number, number) => Promise<boolean>`.
