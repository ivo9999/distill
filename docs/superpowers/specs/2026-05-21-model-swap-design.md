# Distill — LLM Model Swap (Gemini Flash-Lite + Claude Haiku) — Design

**Date:** 2026-05-21
**Status:** Approved
**Repo:** distill (`/Users/sisle/code/work/distill`)

## Overview

distill's newsletter pipeline runs two LLM passes. Both currently use
Google Gemini. This change swaps the models:

- **Pass 1** (extract & cluster stories from Discord messages):
  `gemini-2.5-flash` → **`gemini-2.5-flash-lite`** — 3× cheaper
  ($0.10/$0.40 vs $0.30/$2.50 per 1M tokens), ample for the mechanical
  clustering work, same provider.
- **Pass 2** (write the newsletter draft) + the **regenerate-section**
  and **subject-lines** features (which all read `AI_MODEL_PASS2`):
  `gemini-2.5-pro` → **Claude Haiku 4.5** — cheaper than today's
  `2.5-pro` ($1/$5 vs $1.25/$10) and a stronger prose writer, which is
  distill's core deliverable.

The pipeline uses the Vercel AI SDK (`generateText`), which is
provider-agnostic — and `@ai-sdk/anthropic` is **already a dependency**
(`^3.0.69`). No package install needed. The change is: an Anthropic
client, a provider-routing helper, the model-id defaults, and a cost
table row.

## Architecture

`apps/web/lib/ai/client.ts` currently exports one `google` provider
instance. The pipeline files (`pass1.ts`, `pass2.ts`,
`regenerate-section.ts`, `subject-lines.ts`) each call
`google(modelId)` and read `AI_MODEL_PASS1` / `AI_MODEL_PASS2`.

The new design adds, in `client.ts`:
- an `anthropic` provider instance (`createAnthropic`, keyed by
  `ANTHROPIC_API_KEY`).
- a `modelFor(modelId: string)` helper that returns the correct AI-SDK
  model object based on the id prefix: `claude-*` → `anthropic(id)`,
  anything else → `google(id)`.

The four call sites change from `google(...)` to `modelFor(...)`. Pass 1
stays on Google because its default id is a `gemini-*` string; Pass 2's
three sites get a `claude-*` default, so `modelFor` routes them to
Anthropic. A future provider change is then a pure env-var change
(`AI_MODEL_PASS2=gemini-3.5-flash` would route back to Google with no
code change).

## Components

### `apps/web/lib/ai/client.ts`
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
(The exact `LanguageModel` type import is confirmed against the
installed `ai` v6 during implementation; if the type name differs, the
implementation uses whatever `generateText`'s `model` parameter
accepts. The behavior — prefix-routing — is the fixed contract.)

### Pass 1 — `apps/web/lib/ai/pass1.ts`
`import { google }` → `import { modelFor }`. The `model:` line becomes
`model: modelFor(process.env.AI_MODEL_PASS1 ?? "gemini-2.5-flash-lite")`.
(Default changes from `gemini-2.5-flash` to `gemini-2.5-flash-lite`.)

### Pass 2 — `apps/web/lib/ai/pass2.ts`, `regenerate-section.ts`, `subject-lines.ts`
Each: `import { google }` → `import { modelFor }`; the `model:` line
becomes `model: modelFor(process.env.AI_MODEL_PASS2 ?? "claude-haiku-4-5")`.
(Default changes from `gemini-2.5-pro` to `claude-haiku-4-5`.)

NOTE: the exact Anthropic model id (`claude-haiku-4-5` vs a dated id
like `claude-haiku-4-5-YYYYMMDD`) is verified against Anthropic's
current model docs during implementation — the AI SDK accepts the
documented id. The session context names the Haiku 4.5 id as
`claude-haiku-4-5`.

### Cost table — `apps/web/lib/ai/pipeline.ts`
`pipeline.ts` has a `PRICING` map (per-1M-token costs) used by
`calculateCost`. Add two rows:
```ts
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  "claude-haiku-4-5": { input: 1.00, output: 5.00 },
```
`calculateCost` already has a `?? { input: 3.0, output: 15.0 }`
fallback for unknown ids, so cost tracking degrades safely — but the
explicit rows keep `cost_usd` accurate. (The map's comment "Google
Gemini pricing" is updated to "LLM pricing" since it now spans
providers.)

## Configuration

A new secret is required: **`ANTHROPIC_API_KEY`** on the distill `web`
service (the AI pipeline runs in the Next.js layer). The operator
provides the key; it is set via `kuso secret set distill web
ANTHROPIC_API_KEY=...`. Without it, `createAnthropic` builds but any
Pass-2 call fails at request time with an Anthropic auth error.

`AI_MODEL_PASS1` / `AI_MODEL_PASS2` remain env-overridable — the new
values are just the in-code defaults. No env var must be set for the
swap to take effect; setting them is only needed to override.

## Prompt compatibility

The Pass-2 prompt (`PASS2_PROMPT` in `pass2.ts`) and the
regenerate/subject-line prompts are plain instruction strings passed to
`generateText`. They are not Gemini-specific in syntax. Claude Haiku
4.5 follows the same instruction style. No prompt rewrite is in scope —
but the rollout includes a real-newsletter check (below) to confirm
output quality holds; if Claude visibly mishandles a prompt rule, a
targeted prompt tweak is a follow-up, not part of this change.

## Testing & Rollout

`apps/web` has no test framework. Verification:
- `pnpm build` from `apps/web/` — type-check + compile.
- Post-deploy: the operator sets `ANTHROPIC_API_KEY`, then a real
  newsletter is generated end-to-end and the draft is eyeballed —
  Pass 1 (Gemini Lite) produces sensible story clusters, Pass 2
  (Claude) produces a draft that respects the structure rules (hook,
  per-story `## ` sections, `<!-- story:id -->` markers, the closing
  italic line, the hard rules). The regenerate-section and
  subject-lines features are exercised once each.

Rollout order:
1. Operator sets `ANTHROPIC_API_KEY` as a kuso secret on distill `web`.
2. Deploy `apps/web` (the model swap is in the code defaults).
3. Generate a real newsletter; verify the draft + the two AI features.
4. If Claude output regresses on a prompt rule, file a follow-up to
   tune that prompt — not a blocker for the swap itself.

## Risks & Mitigations

- **No `ANTHROPIC_API_KEY` at deploy time** → every Pass-2 call fails.
  Mitigation: rollout step 1 sets the key *before* the deploy; the
  build does not require the key (only request-time does).
- **Cross-provider prompt drift** — Claude may interpret a prompt rule
  differently than Gemini. Mitigation: the post-deploy real-newsletter
  check; prompts are plain instructions with no Gemini-specific syntax,
  so drift risk is low. A prompt tweak, if needed, is a small
  follow-up.
- **Model id wrong** — if `claude-haiku-4-5` is not the exact accepted
  id, the request 404s. Mitigation: the implementation verifies the id
  against Anthropic's current docs before finalizing.
- **`modelFor` mis-routes** — only `claude-*` goes to Anthropic; every
  current and future `gemini-*` id stays on Google. A model id that is
  neither (unlikely) routes to Google and would fail clearly.

## Success Criteria

- Pass 1 runs on `gemini-2.5-flash-lite`; Pass 2 / regenerate / subject
  lines run on `claude-haiku-4-5`.
- Provider routing is by model-id prefix via `modelFor`; switching
  either pass's provider later is an env-var change, no code edit.
- `cost_usd` tracking is accurate for both new models.
- `apps/web` builds cleanly; a real generated newsletter looks correct.
