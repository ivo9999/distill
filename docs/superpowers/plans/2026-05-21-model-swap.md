# Distill LLM Model Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap distill's newsletter LLMs — Pass 1 to `gemini-2.5-flash-lite` (cheaper), Pass 2 / regenerate-section / subject-lines to Claude Haiku 4.5 (better writer, cheaper than today's gemini-2.5-pro) — via a provider-routing helper.

**Architecture:** Add an Anthropic provider client + a `modelFor(id)` helper in `client.ts` that routes by model-id prefix (`claude-*` → Anthropic, else Google). The four AI call sites switch from `google(...)` to `modelFor(...)` and get new default model ids. A cost-table row is added per new model.

**Tech Stack:** Next.js 16 / TypeScript, Vercel AI SDK v6 (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic` — all already dependencies).

**Verification model:** `pnpm build` from `apps/web/` (type-check + compile). `apps/web` has no test framework.

**Prerequisite:** The operator must set the `ANTHROPIC_API_KEY` secret on the distill `web` service before the Claude path is exercised live (rollout step — not part of subagent execution).

---

## File Structure

- `apps/web/lib/ai/client.ts` — add the `anthropic` provider + `modelFor` helper.
- `apps/web/lib/ai/pass1.ts` — use `modelFor`; default → `gemini-2.5-flash-lite`.
- `apps/web/lib/ai/pass2.ts` — use `modelFor`; default → `claude-haiku-4-5`.
- `apps/web/lib/ai/regenerate-section.ts` — use `modelFor`; default → `claude-haiku-4-5`.
- `apps/web/lib/ai/subject-lines.ts` — use `modelFor`; default → `claude-haiku-4-5`.
- `apps/web/lib/ai/pipeline.ts` — add cost rows for the two new models.

---

## Task 1: Baseline build

**Files:** none (verification)

- [ ] **Step 1: Baseline build**

Run (from `apps/web/`): `pnpm install && pnpm build`
Expected: build succeeds. If it fails, STOP and report BLOCKED.

---

## Task 2: Anthropic provider + `modelFor` helper

**Files:**
- Modify: `apps/web/lib/ai/client.ts`

CONTEXT: `client.ts` currently exports one `google` provider. The AI SDK
`ai` v6 exports a `LanguageModel` type. `@ai-sdk/anthropic` is already
in `package.json`.

- [ ] **Step 1: Rewrite `client.ts`**

Replace the entire contents of `apps/web/lib/ai/client.ts` with:
```ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// modelFor routes a model id to its provider: claude-* ids go to
// Anthropic, everything else to Google. This keeps model selection a
// pure env-var concern — AI_MODEL_PASS1/PASS2 can name a model from
// either provider and the right client is chosen automatically.
export function modelFor(modelId: string): LanguageModel {
  if (modelId.startsWith("claude-")) {
    return anthropic(modelId);
  }
  return google(modelId);
}
```

- [ ] **Step 2: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds. The `google` export is still used by the pipeline
files (unchanged so far), and `anthropic`/`modelFor` are new exports
not yet imported anywhere — that is fine, TypeScript compiles them.
If the build fails on the `LanguageModel` import, check the `ai`
package's exported type name (`grep "LanguageModel" apps/web/node_modules/ai/dist/index.d.ts`)
— `ai` v6 exports `LanguageModel`; use the exact exported name.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/ai/client.ts
git commit -m "feat(web): add Anthropic provider + modelFor routing helper"
```

---

## Task 3: Pass 1 → `gemini-2.5-flash-lite`

**Files:**
- Modify: `apps/web/lib/ai/pass1.ts`

- [ ] **Step 1: Switch Pass 1 to `modelFor` + the Lite default**

In `apps/web/lib/ai/pass1.ts`:
- Change the import line `import { google } from "./client";` to
  `import { modelFor } from "./client";`
- Change the model line. It is currently:
  ```ts
      model: google(process.env.AI_MODEL_PASS1 ?? "gemini-2.5-flash"),
  ```
  Change it to:
  ```ts
      model: modelFor(process.env.AI_MODEL_PASS1 ?? "gemini-2.5-flash-lite"),
  ```

- [ ] **Step 2: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/ai/pass1.ts
git commit -m "feat(web): Pass 1 uses gemini-2.5-flash-lite"
```

---

## Task 4: Pass 2 + regenerate-section + subject-lines → Claude Haiku 4.5

**Files:**
- Modify: `apps/web/lib/ai/pass2.ts`
- Modify: `apps/web/lib/ai/regenerate-section.ts`
- Modify: `apps/web/lib/ai/subject-lines.ts`

CONTEXT: All three files import `google` and call
`google(process.env.AI_MODEL_PASS2 ?? "gemini-2.5-pro")`. They all
switch to `modelFor` with a `claude-haiku-4-5` default.

- [ ] **Step 1: Verify the Claude model id**

The Anthropic-current Haiku id is `claude-haiku-4-5`. Confirm this is
the id the AI SDK accepts — quickly check Anthropic's model docs
(https://docs.anthropic.com/en/docs/about-claude/models) for the exact
current Haiku 4.5 id. If the documented id differs (e.g. a dated
suffix), use the documented id consistently in all three files below.
The plan text uses `claude-haiku-4-5`.

- [ ] **Step 2: Switch `pass2.ts`**

In `apps/web/lib/ai/pass2.ts`:
- `import { google } from "./client";` → `import { modelFor } from "./client";`
- The model line is currently:
  ```ts
      model: google(process.env.AI_MODEL_PASS2 ?? "gemini-2.5-pro"),
  ```
  Change it to:
  ```ts
      model: modelFor(process.env.AI_MODEL_PASS2 ?? "claude-haiku-4-5"),
  ```

- [ ] **Step 3: Switch `regenerate-section.ts`**

In `apps/web/lib/ai/regenerate-section.ts`, apply the identical change:
`import { google }` → `import { modelFor }`, and
`model: google(process.env.AI_MODEL_PASS2 ?? "gemini-2.5-pro"),` →
`model: modelFor(process.env.AI_MODEL_PASS2 ?? "claude-haiku-4-5"),`.

- [ ] **Step 4: Switch `subject-lines.ts`**

In `apps/web/lib/ai/subject-lines.ts`, apply the identical change:
`import { google }` → `import { modelFor }`, and
`model: google(process.env.AI_MODEL_PASS2 ?? "gemini-2.5-pro"),` →
`model: modelFor(process.env.AI_MODEL_PASS2 ?? "claude-haiku-4-5"),`.

- [ ] **Step 5: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds — `google` is no longer imported by these three
files, but `client.ts` still exports it (used nowhere else now, but a
still-exported symbol is fine). If the build flags `google` as an
unused export, that is not an error — leave the export, a future
env-var override (`AI_MODEL_PASS2=gemini-...`) routes back through it
via `modelFor`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/ai/pass2.ts apps/web/lib/ai/regenerate-section.ts apps/web/lib/ai/subject-lines.ts
git commit -m "feat(web): Pass 2 / rewrites / subject lines use Claude Haiku 4.5"
```

---

## Task 5: Cost-table rows for the new models

**Files:**
- Modify: `apps/web/lib/ai/pipeline.ts`

CONTEXT: `pipeline.ts` has a `PRICING` map (per-1M-token costs) used by
`calculateCost`. It currently has only `gemini-2.0-flash`,
`gemini-2.5-flash`, `gemini-2.5-pro`. `calculateCost` has a
`?? { input: 3.0, output: 15.0 }` fallback, so unknown ids degrade
safely — but accurate rows keep `cost_usd` correct.

- [ ] **Step 1: Add the two rows + fix the comment**

In `apps/web/lib/ai/pipeline.ts`, the `PRICING` map is:
```ts
// Google Gemini pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "gemini-2.5-pro": { input: 1.25, output: 10.00 },
};
```
Replace it with (updated comment + two new rows):
```ts
// LLM pricing per million tokens (input / output), across providers.
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  "gemini-2.5-pro": { input: 1.25, output: 10.00 },
  "claude-haiku-4-5": { input: 1.00, output: 5.00 },
};
```
(If Task 4 Step 1 found a different Claude id, use that same id as the
key here so cost lookup matches.)

- [ ] **Step 2: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/ai/pipeline.ts
git commit -m "feat(web): cost-table rows for flash-lite and claude-haiku"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run (from `apps/web/`): `rm -rf .next && pnpm build`
Expected: build succeeds, zero type errors.

- [ ] **Step 2: Confirm the wiring**

Run (from repo root):
```bash
grep -rn "modelFor\|anthropic" apps/web/lib/ai/client.ts
grep -rn "modelFor(process.env.AI_MODEL" apps/web/lib/ai/pass1.ts apps/web/lib/ai/pass2.ts apps/web/lib/ai/regenerate-section.ts apps/web/lib/ai/subject-lines.ts
grep -rn "flash-lite\|claude-haiku" apps/web/lib/ai/pipeline.ts
grep -rn "google(" apps/web/lib/ai/pass1.ts apps/web/lib/ai/pass2.ts apps/web/lib/ai/regenerate-section.ts apps/web/lib/ai/subject-lines.ts || echo "no direct google() calls remain in the 4 pipeline files (good)"
```
Expected: `client.ts` has `anthropic` + `modelFor`; all 4 pipeline
files call `modelFor(process.env.AI_MODEL_...)`; `pipeline.ts` has the
two new cost rows; no pipeline file calls `google(` directly anymore.

- [ ] **Step 3: Final commit (only if cleanup was needed)**

```bash
git add -A apps/web
git commit -m "chore(web): model-swap verification cleanup"
```
If nothing changed, skip.

---

## Rollout (post-merge — performed manually, not part of subagent execution)

1. **Operator sets the Anthropic key:**
   `kuso secret set distill web ANTHROPIC_API_KEY=sk-ant-...`
   This must happen before the deploy so the first Pass-2 request can
   authenticate. (The build does not need the key; only request-time
   does.)
2. Deploy `apps/web` (the model swap is in the code defaults).
3. Generate one real newsletter end-to-end and eyeball the draft:
   Pass 1 (Gemini Flash-Lite) clusters stories sensibly; Pass 2
   (Claude Haiku 4.5) produces a draft that respects the structure
   rules (hook, per-story `## ` headings, `<!-- story:id -->` markers,
   the closing italic line, the hard rules — no invented facts, no real
   usernames, under 600 words).
4. Exercise the regenerate-section and subject-lines features once
   each.
5. If Claude regresses on a specific prompt rule, file a follow-up to
   tune that prompt — not a blocker for the swap.

No Go API / worker / bot changes — the AI pipeline runs entirely in the
Next.js `web` service, so only `web` redeploys.

---

## Self-Review Notes

- **Spec coverage:** the `anthropic` client + `modelFor` helper → Task 2.
  Pass 1 → `gemini-2.5-flash-lite` → Task 3. Pass 2 / regenerate /
  subject-lines → `claude-haiku-4-5` → Task 4 (all three call sites).
  Cost-table rows → Task 5. Verification → Tasks 1, 6. The
  `ANTHROPIC_API_KEY` secret is a rollout step (operator-owned, not a
  code task) — covered in the Rollout section, matching the spec's
  "Configuration" section.
- **Placeholder scan:** every code step shows complete file content or
  exact before/after lines. Task 4 Step 1's "verify the Claude id
  against Anthropic docs" is a concrete pre-flight check against
  external version drift, not a vague placeholder — the fixed default
  (`claude-haiku-4-5`) is stated and used throughout; the check only
  guards against Anthropic having shipped a differently-named id.
- **Type consistency:** `modelFor(modelId: string): LanguageModel`
  (Task 2) is called as `modelFor(process.env.AI_MODEL_PASS1 ?? "...")`
  / `modelFor(process.env.AI_MODEL_PASS2 ?? "...")` in Tasks 3-4 — the
  `?? "..."` guarantees a `string` argument (env vars are
  `string | undefined`). The `PRICING` key `claude-haiku-4-5` (Task 5)
  matches the model-id default in Task 4 — both must use whatever id
  Task 4 Step 1 confirms.
