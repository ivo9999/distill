# Distill — Server Icons + Newsletter Editor Improvements — Design

**Date:** 2026-05-21
**Status:** Approved
**Repo:** distill (`/Users/sisle/code/work/distill`)

Two independent improvements shipped together. They touch separate files
and have no shared code; Part A is small and mechanical, Part B is a
focused editor enhancement.

---

## Part A — Discord Server Icons on Server Cards

### Problem

The dashboard's server cards show a letter-in-a-coloured-square avatar.
The `servers` table already has an `icon_url` column and the Go API's
`createServer` accepts an `icon_url` field — but the onboarding flow
never sends it, so `icon_url` is always `null` and the card always falls
back to the letter avatar.

### Fix

Three frontend changes — no Go API or DB change (`createServer` already
accepts `icon_url`; the `GET /api/proxy/servers` response already
includes it).

1. **Onboarding — `apps/web/app/(app)/dashboard/onboarding/onboarding-client.tsx`,
   `selectGuild`.** The `/api/proxy/discord/bot-guilds` proxy already
   returns each guild's `icon` hash. When `selectGuild` creates a server
   (the `POST /api/proxy/servers` call), include `icon_url` in the body:
   - If the guild has an `icon` hash: `icon_url` =
     `https://cdn.discordapp.com/icons/<guild.id>/<guild.icon>.png`.
   - If the guild has no icon (`icon` is null/empty): omit `icon_url`
     (or send empty — the server treats empty as "no icon").
   The `DiscordGuild` type in this file gains an optional `icon?: string`
   field so the hash is carried from the picker to `selectGuild`.

2. **`ServerCard` — `apps/web/components/features/server-card.tsx`.**
   - Add an optional `iconUrl?: string` to the `ServerCardData` interface.
   - When `iconUrl` is set, render `<img src={iconUrl}>` as the avatar —
     `h-10 w-10`, `rounded-card`, `object-cover`. When absent, render the
     existing letter-in-coloured-square avatar exactly as today.
   - Add an `onError` handler on the `<img>` that falls back to the
     letter avatar if the image fails to load (stale/broken Discord CDN
     URL). Implement with a small `useState` "image failed" flag, so the
     component degrades gracefully. (`ServerCard` becomes a client
     component — add `"use client"` — since `onError` needs a handler.)

3. **Dashboard — `apps/web/app/(app)/dashboard/page.tsx`.** Where server
   records are mapped into `ServerCardData`, pass
   `iconUrl: server.icon_url || undefined` through. The `Server`
   interface in this file gains an `icon_url?: string | null` field to
   match the API response.

### Out of scope (Part A)

- Servers created before this change keep the letter avatar until
  re-onboarded — no backfill. Acceptable: only new servers get icons.

---

## Part B — Newsletter Editor Improvements

### Current state

The editor — `apps/web/app/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx`
(~750 lines) — has a markdown `<textarea>` and `Preview` / `Email` tabs.
The `Email` tab renders via an inline `EmailFramePreview` component that
passes a per-element `components={{ h2, h3, p, … }}` map to
`ReactMarkdown` with proper typography. The `Preview` tab renders bare
`<ReactMarkdown>` wrapped in weak `prose` classes — so its headings look
faint and inconsistent with the email view.

Three improvements. ALL save / AI-rewrite / per-section / sources /
publish logic is preserved unchanged — this is additive UI plus one
component extraction.

### B1 — Markdown-insert toolbar

Create `apps/web/components/features/markdown-toolbar.tsx` — a
`MarkdownToolbar` component rendered in the markdown pane's header area,
above the `<textarea>`. Seven buttons: **Bold**, **Italic**, **H2**,
**H3**, **Link**, **List**, **Quote**.

The toolbar operates on the `<textarea>` via a `ref` (a `RefObject<HTMLTextAreaElement>`
passed from the editor page) plus the current `content` value and the
`setContent` setter. Each button computes a new `content` string and the
next selection range:

- **Wrap style** (Bold `**…**`, Italic `*…*`, Link `[…](url)`):
  wrap the current selection in the markers. With no selection, insert
  the markers and place the cursor between them (for Link, place the
  cursor in the `url` slot).
- **Line-prefix style** (H2 `## `, H3 `### `, List `- `, Quote `> `):
  prepend the prefix to the start of every line touched by the
  selection (or the current line if no selection).

After applying, call `setContent(next)` and, in a `requestAnimationFrame`,
restore focus to the textarea and set `selectionStart`/`selectionEnd` to
the computed range.

The editor page adds a `useRef<HTMLTextAreaElement>(null)` and attaches
it to the existing `<textarea>`; passes the ref, `content`, and
`setContent` to `<MarkdownToolbar>`.

### B2 — Preview fidelity: shared markdown render

Extract the markdown-render core into
`apps/web/components/features/newsletter-markdown.tsx` — a
`NewsletterMarkdown` component that wraps `ReactMarkdown` with the
per-element `components` map currently inline in `EmailFramePreview`
(the `h2` / `h3` / `p` / `a` / `ul` / `li` / `blockquote` / `strong`
styling). It takes a single `content: string` prop and renders the
styled article body — no email chrome.

Then:
- `EmailFramePreview` (still in the editor page) renders
  `<NewsletterMarkdown content={…}>` inside its 600/680px white email
  card with the From/Subject header — unchanged framing, shared body.
- The `Preview` tab renders `<NewsletterMarkdown content={…}>` directly
  (no email chrome, no `prose` classes). Result: `Preview` and `Email`
  use the **same** typography — headings, lists, blockquotes all read
  like the real newsletter.

The story-id marker strip (`content.replace(/<!--\s*story:[^>]*-->\s*/g, "")`)
stays at each call site, applied to `content` before it reaches
`NewsletterMarkdown`.

### B3 — Editor polish

- **Word count:** under the markdown pane, a small live word count
  (`text-[11px] text-ink-medium`), computed as
  `content.trim().split(/\s+/).filter(Boolean).length` — recomputed on
  each render from `content`.
- **Layout:** roomier textarea padding, clear pane headers — minor
  spacing tweaks only.
- **Save indicator:** the existing Save button already shows
  `Saving… / Saved! / Save` off the `saving` / `saved` state. No new
  dirty-tracking — that button is the indicator. (No change needed; B3
  does not add a separate indicator.)

### Out of scope (Part B)

- No rich-text/WYSIWYG editor — the `<textarea>` + markdown model stays
  (the save / AI / sources pipeline is all markdown-string based).
- No change to the AI-rewrite, per-section, view-sources, or publish
  flows.

---

## Files

Part A:
- Modify: `apps/web/app/(app)/dashboard/onboarding/onboarding-client.tsx`
- Modify: `apps/web/components/features/server-card.tsx`
- Modify: `apps/web/app/(app)/dashboard/page.tsx`

Part B:
- Create: `apps/web/components/features/markdown-toolbar.tsx`
- Create: `apps/web/components/features/newsletter-markdown.tsx`
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx`

No Go / API / DB / chart changes in either part.

## Testing

`apps/web` has no test framework. Verification is `pnpm build` (full
type-check) plus a described visual check via `pnpm dev`:
- Part A: a server card with an `icon_url` shows the Discord image; one
  without shows the letter avatar; a broken URL falls back to the letter.
- Part B: each toolbar button inserts the right markdown at the cursor /
  around the selection; the `Preview` tab renders headings/lists with the
  same typography as the `Email` tab; the word count updates as you type.

## Risks & Mitigations

- **`ServerCard` becomes a client component** — needed for the `<img>`
  `onError` fallback. It is only used in the dashboard (already a client
  page), so no RSC regression.
- **Toolbar selection math** — the line-prefix and wrap logic must
  restore a sensible cursor. Mitigation: the implementation restores
  `selectionStart`/`selectionEnd` explicitly in a `requestAnimationFrame`
  after `setContent`.
- **`EmailFramePreview` extraction** — moving the `components` map into
  `NewsletterMarkdown` must preserve every element's styling exactly so
  the `Email` tab looks identical to before. The plan will diff the
  rendered output.

## Success Criteria

- New servers added via onboarding show their real Discord icon on the
  dashboard card; iconless servers and broken URLs fall back cleanly.
- The editor has a working 7-button markdown toolbar.
- The `Preview` tab renders with the same typography as the `Email` tab.
- A live word count shows under the markdown pane.
- `apps/web` builds with no type errors; all existing editor
  functionality (save, AI rewrite, sources, publish) still works.
