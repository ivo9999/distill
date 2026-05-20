# Distill Server Icons + Newsletter Editor Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real Discord server icons on dashboard server cards, and improve the newsletter editor with a markdown-insert toolbar, an email-fidelity preview, and a word count.

**Architecture:** Part A threads the Discord guild icon hash from onboarding into the existing `icon_url` field and renders it (with letter-avatar fallback). Part B adds a `MarkdownToolbar` component that edits the textarea via a ref, and extracts the editor's markdown render into a shared `NewsletterMarkdown` component so the `Preview` and `Email` tabs render identically. Frontend only — no Go/API/DB changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, react-markdown.

**Verification model:** `apps/web` has no test framework. Each task is verified by `pnpm build` (full type-check + compile) from `apps/web/`, plus a described visual check via `pnpm dev`.

---

## File Structure

Part A (Discord server icons):
- `apps/web/app/(app)/dashboard/onboarding/onboarding-client.tsx` — thread the guild icon hash into the create-server POST.
- `apps/web/components/features/server-card.tsx` — render `iconUrl` as an `<img>` with letter-avatar fallback.
- `apps/web/app/(app)/dashboard/page.tsx` — pass `iconUrl` into `ServerCardData`.

Part B (editor):
- `apps/web/components/features/newsletter-markdown.tsx` — NEW. Shared `ReactMarkdown` render with the per-element styling.
- `apps/web/components/features/markdown-toolbar.tsx` — NEW. 7-button toolbar that edits a textarea via ref.
- `apps/web/app/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx` — use both new components; add the textarea ref + word count.

No Go / API / DB / chart changes.

---

## Task 1: Confirm baseline build

**Files:** none (verification)

- [ ] **Step 1: Baseline build**

Run (from `apps/web/`): `pnpm install && pnpm build`
Expected: build succeeds. If it fails, STOP and report BLOCKED — the work must start from a green build.

---

## Task 2: Thread the Discord icon hash through onboarding

**Files:**
- Modify: `apps/web/app/(app)/dashboard/onboarding/onboarding-client.tsx`

- [ ] **Step 1: Add `icon` to the `DiscordGuild` type**

In `apps/web/app/(app)/dashboard/onboarding/onboarding-client.tsx`, the type is:
```tsx
interface DiscordGuild {
  id: string;
  name: string;
}
```
Change it to:
```tsx
interface DiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
}
```
(The `/api/proxy/discord/bot-guilds` proxy already returns `icon` per guild, so it flows in with no other change.)

- [ ] **Step 2: Send `icon_url` in the create-server POST**

In `selectGuild`, the create call is currently:
```tsx
      const createRes = await fetch("/api/proxy/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: guild.name, discord_guild_id: guild.id }),
      });
```
Replace it with a version that includes the Discord CDN icon URL when the guild has an icon hash:
```tsx
      const iconUrl = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
        : undefined;
      const createRes = await fetch("/api/proxy/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guild.name,
          discord_guild_id: guild.id,
          ...(iconUrl ? { icon_url: iconUrl } : {}),
        }),
      });
```

- [ ] **Step 3: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/dashboard/onboarding/onboarding-client.tsx"
git commit -m "feat(web): send Discord server icon when creating a server"
```

---

## Task 3: Render the icon on `ServerCard`

**Files:**
- Modify: `apps/web/components/features/server-card.tsx`

- [ ] **Step 1: Rewrite `server-card.tsx`**

Replace the entire contents of `apps/web/components/features/server-card.tsx` with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ServerCardData {
  id: string;
  name: string;
  status: string;
  scheduleLabel: string;
  quotaLabel?: string;
  iconUrl?: string;
}

// Per-server avatar colour rotation, used as the fallback when the
// server has no Discord icon (or its icon URL fails to load).
const accents = [
  "var(--brand)",
  "var(--brand-discord)",
  "var(--brand-warm)",
  "var(--brand-bright)",
  "var(--brand-hot)",
  "var(--accent-5)",
];
function accentFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return accents[Math.abs(hash) % accents.length];
}

export function ServerCard({ server }: { server: ServerCardData }) {
  // Falls back to the letter avatar if the Discord CDN URL is absent
  // or fails to load (stale icon hash, deleted server, etc.).
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!server.iconUrl && !imgFailed;

  return (
    <Link href={`/dashboard/servers/${server.id}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {showImage ? (
                <img
                  src={server.iconUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-card object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-card text-sm font-black uppercase text-ink-inverted"
                  style={{ backgroundColor: accentFor(server.id) }}
                >
                  {server.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <CardTitle className="text-base truncate">
                {server.name}
              </CardTitle>
            </div>
            <Badge variant={server.status === "active" ? "default" : "secondary"}>
              {server.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-medium">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {server.scheduleLabel}
            </span>
            {server.quotaLabel && <span>{server.quotaLabel}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/features/server-card.tsx
git commit -m "feat(web): render Discord server icon on server card"
```

---

## Task 4: Pass `iconUrl` from the dashboard

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add `icon_url` to the `Server` interface**

In `apps/web/app/(app)/dashboard/page.tsx`, the interface is:
```tsx
interface Server {
  id: string;
  name: string;
  discord_guild_id: string;
  status: string;
  schedule_cron: string;
  community_type: string | null;
}
```
Add an `icon_url` field:
```tsx
interface Server {
  id: string;
  name: string;
  discord_guild_id: string;
  status: string;
  schedule_cron: string;
  community_type: string | null;
  icon_url?: string | null;
}
```

- [ ] **Step 2: Pass `iconUrl` into `ServerCardData`**

In the same file, find the `<ServerCard ... server={{ ... }}>` usage. The object literal currently has `id`, `name`, `status`, `scheduleLabel`, `quotaLabel`. Add an `iconUrl` line:
```tsx
                  server={{
                    id: server.id,
                    name: server.name,
                    status: server.status,
                    iconUrl: server.icon_url || undefined,
                    scheduleLabel: humanCron(server.schedule_cron),
                    quotaLabel: quota
```
(Keep the `quotaLabel` ternary and everything else exactly as-is — only the `iconUrl` line is added.)

- [ ] **Step 3: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds.

- [ ] **Step 4: Visual check**

Run `pnpm dev`, open `/dashboard`. A server whose `icon_url` is set shows the Discord image; one without shows the letter avatar.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(app)/dashboard/page.tsx"
git commit -m "feat(web): pass server icon URL to dashboard cards"
```

---

## Task 5: Create the shared `NewsletterMarkdown` component

**Files:**
- Create: `apps/web/components/features/newsletter-markdown.tsx`

- [ ] **Step 1: Create the component**

This holds the per-element markdown styling currently inline in the editor's `EmailFramePreview`. It adds `h3` and `blockquote` styling (the editor's new toolbar produces H3 and Quote, which the old inline map didn't cover). Create `apps/web/components/features/newsletter-markdown.tsx`:

```tsx
import ReactMarkdown from "react-markdown";

// NewsletterMarkdown renders newsletter draft markdown with the
// newsletter's typography — sans-serif headings, serif-friendly body
// spacing, styled links/lists/quotes. Shared by the editor's Preview
// tab and the Email-frame preview so both views render identically.
//
// The host element supplies the font-family / size / line-height
// context (the Email frame uses a serif body; the Preview tab inherits
// the app font) — this component only styles the block elements.
export function NewsletterMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h2: (props) => (
          <h2
            {...props}
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              fontSize: "22px",
              fontWeight: 600,
              marginTop: "32px",
              marginBottom: "12px",
              lineHeight: 1.3,
            }}
          />
        ),
        h3: (props) => (
          <h3
            {...props}
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              fontSize: "18px",
              fontWeight: 600,
              marginTop: "24px",
              marginBottom: "8px",
              lineHeight: 1.35,
            }}
          />
        ),
        p: (props) => (
          <p {...props} style={{ margin: "0 0 16px 0", color: "#1a1a1a" }} />
        ),
        a: (props) => (
          <a
            {...props}
            style={{ color: "#1d4ed8", textDecoration: "underline" }}
          />
        ),
        em: (props) => (
          <em {...props} style={{ color: "#4b5563", fontStyle: "italic" }} />
        ),
        strong: (props) => <strong {...props} style={{ color: "#0f172a" }} />,
        ul: (props) => (
          <ul {...props} style={{ paddingLeft: "24px", margin: "0 0 16px 0" }} />
        ),
        li: (props) => <li {...props} style={{ margin: "0 0 4px 0" }} />,
        blockquote: (props) => (
          <blockquote
            {...props}
            style={{
              borderLeft: "3px solid #d1d5db",
              paddingLeft: "16px",
              margin: "0 0 16px 0",
              color: "#4b5563",
              fontStyle: "italic",
            }}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 2: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds (the component is not yet imported anywhere — that is fine, Next.js compiles it).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/features/newsletter-markdown.tsx
git commit -m "feat(web): add shared NewsletterMarkdown render component"
```

---

## Task 6: Create the `MarkdownToolbar` component

**Files:**
- Create: `apps/web/components/features/markdown-toolbar.tsx`

- [ ] **Step 1: Create the toolbar**

A 7-button toolbar that edits a `<textarea>` (passed by ref) by inserting markdown at the cursor / around the selection. Create `apps/web/components/features/markdown-toolbar.tsx`:

```tsx
"use client";

import type { RefObject } from "react";
import { Bold, Italic, Heading2, Heading3, Link2, List, Quote } from "lucide-react";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

// Wrap-style actions surround the selection with markers; line-prefix
// actions prepend a marker to every line the selection touches.
type WrapAction = { kind: "wrap"; before: string; after: string };
type PrefixAction = { kind: "prefix"; prefix: string };
type Action = WrapAction | PrefixAction;

const ACTIONS: { label: string; icon: typeof Bold; action: Action }[] = [
  { label: "Bold", icon: Bold, action: { kind: "wrap", before: "**", after: "**" } },
  { label: "Italic", icon: Italic, action: { kind: "wrap", before: "*", after: "*" } },
  { label: "Heading 2", icon: Heading2, action: { kind: "prefix", prefix: "## " } },
  { label: "Heading 3", icon: Heading3, action: { kind: "prefix", prefix: "### " } },
  { label: "Link", icon: Link2, action: { kind: "wrap", before: "[", after: "](url)" } },
  { label: "List item", icon: List, action: { kind: "prefix", prefix: "- " } },
  { label: "Quote", icon: Quote, action: { kind: "prefix", prefix: "> " } },
];

export function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  const apply = (action: Action) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);

    let next: string;
    let nextStart: number;
    let nextEnd: number;

    if (action.kind === "wrap") {
      const { before, after } = action;
      next = value.slice(0, start) + before + selected + after + value.slice(end);
      if (selected) {
        // Keep the original text selected, now inside the markers.
        nextStart = start + before.length;
        nextEnd = nextStart + selected.length;
      } else {
        // No selection: drop the cursor between the markers.
        nextStart = start + before.length;
        nextEnd = nextStart;
      }
    } else {
      // Prefix every line the selection spans. lineStart is the start
      // of the first touched line; we only rewrite that slice.
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const region = value.slice(lineStart, end);
      const prefixed = region
        .split("\n")
        .map((line) => action.prefix + line)
        .join("\n");
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      // Select the whole prefixed region.
      nextStart = lineStart;
      nextEnd = lineStart + prefixed.length;
    }

    onChange(next);
    // Restore focus + selection after React applies the new value.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextStart, nextEnd);
    });
  };

  return (
    <div className="flex items-center gap-0.5">
      {ACTIONS.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => apply(action)}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-medium hover:bg-ink-lightest hover:text-ink transition-colors"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds. If lucide-react does not export `Heading2`/`Heading3`/`Link2`, run `grep -o "Heading2\|Heading3\|Link2" apps/web/node_modules/lucide-react/dist/lucide-react.d.ts | sort -u` to confirm the names; all three exist in lucide-react 0.562 (the installed version).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/features/markdown-toolbar.tsx
git commit -m "feat(web): add markdown-insert toolbar component"
```

---

## Task 7: Wire the editor — toolbar, shared preview, word count

**Files:**
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx`

- [ ] **Step 1: Read the file**

Run: `cat "apps/web/app/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx"`
Map: the `EmailFramePreview` function (~line 143), the imports, the `content`/`setContent` state (~line 270), the `<textarea>` (~line 692), the `Preview`-tab `<article className="prose ...">` block (~line 719), and the markdown-pane header (`Markdown`, ~line 690).

- [ ] **Step 2: Add imports + the textarea ref**

At the top of the file, add to the imports:
```tsx
import { useRef } from "react";
import { MarkdownToolbar } from "@/components/features/markdown-toolbar";
import { NewsletterMarkdown } from "@/components/features/newsletter-markdown";
```
(If the file already imports other hooks from `"react"` such as `useState`/`useEffect` on one line, add `useRef` to that existing import instead of a second `react` import.)

Inside the editor component, near the `content` state declaration, add:
```tsx
  const textareaRef = useRef<HTMLTextAreaElement>(null);
```

- [ ] **Step 3: Attach the ref to the `<textarea>`**

Find the markdown `<textarea>` (it has `value={content}` and `onChange={(e) => setContent(e.target.value)}`). Add `ref={textareaRef}`:
```tsx
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full p-4 font-mono text-sm leading-relaxed resize-none bg-transparent outline-none placeholder:text-ink-medium"
            placeholder="Write your newsletter in markdown..."
            spellCheck={false}
          />
```

- [ ] **Step 4: Add the toolbar to the markdown pane header**

Find the markdown-pane header — currently:
```tsx
          <div className="px-4 py-2 border-b border-ink-lighter text-[11px] font-bold uppercase tracking-widest text-ink-medium hidden md:block">
            Markdown
          </div>
```
Replace it with a header that keeps the label and adds the toolbar on the right:
```tsx
          <div className="flex items-center justify-between gap-2 px-4 py-1.5 border-b border-ink-lighter hidden md:flex">
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-medium">
              Markdown
            </span>
            <MarkdownToolbar
              textareaRef={textareaRef}
              value={content}
              onChange={setContent}
            />
          </div>
```

- [ ] **Step 5: Add the word count under the textarea**

Immediately AFTER the `<textarea ... />` element (still inside the editor pane `<div>`), add a word-count footer:
```tsx
          <div className="px-4 py-1.5 border-t border-ink-lighter text-[11px] text-ink-medium hidden md:block">
            {content.trim() ? content.trim().split(/\s+/).length : 0} words
          </div>
```

- [ ] **Step 6: Make the Preview tab use `NewsletterMarkdown`**

Find the `Preview`-tab render block — the `<article className="prose prose-sm dark:prose-invert ...">` wrapping `<ReactMarkdown>{content.replace(...)}</ReactMarkdown>`. Replace that whole `<article>...</article>` with:
```tsx
              <article className="mx-auto max-w-[680px] text-[15px] leading-relaxed text-ink">
                <NewsletterMarkdown
                  content={content.replace(/<!--\s*story:[^>]*-->\s*/g, "")}
                />
              </article>
```
This drops the weak `prose` classes; `NewsletterMarkdown` supplies the per-element styling. The wrapping `<article>` just sets width + base text context.

- [ ] **Step 7: Make `EmailFramePreview` use `NewsletterMarkdown`**

In the `EmailFramePreview` function, find the inline `<ReactMarkdown components={{ h2, p, a, em, strong, ul, li }}>{content}</ReactMarkdown>`. Replace that entire `<ReactMarkdown>...</ReactMarkdown>` element with:
```tsx
          <NewsletterMarkdown content={content} />
```
Leave the surrounding `<article className="email-preview-body" style={{...}}>` wrapper exactly as-is — it supplies the serif font context. The element-level styling now comes from `NewsletterMarkdown` (which reproduces the same h2/p/a/em/strong/ul/li styles and adds h3/blockquote).

- [ ] **Step 8: Remove the now-unused `ReactMarkdown` import if dead**

After Steps 6–7, the editor page may no longer reference `ReactMarkdown` directly. Run (from `apps/web/`): `pnpm build`. If the build warns/errors that `ReactMarkdown` is imported but unused, remove the `import ReactMarkdown from "react-markdown";` line. If `ReactMarkdown` is still used elsewhere in the file, leave the import.

- [ ] **Step 9: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds with no type errors.

- [ ] **Step 10: Visual check**

Run `pnpm dev`, open a newsletter draft:
- The markdown pane has a 7-button toolbar; selecting text and clicking **Bold** wraps it in `**…**`; clicking **H2** on a line prepends `## `; **Link** with no selection inserts `[](url)`.
- A word count shows under the textarea and updates as you type.
- The `Preview` tab renders headings/lists/quotes with the same typography as the `Email` tab.
- The `Email` tab still renders correctly (white frame, From/Subject header) — visually unchanged from before.
- Save, AI rewrite, view-sources, publish all still work.

- [ ] **Step 11: Commit**

```bash
git add "apps/web/app/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx"
git commit -m "feat(web): editor markdown toolbar, shared preview, word count"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run (from `apps/web/`): `rm -rf .next && pnpm build`
Expected: build succeeds, zero type errors.

- [ ] **Step 2: Full visual sweep**

Run `pnpm dev`:
- `/dashboard` — server cards show Discord icons where available, letter avatars otherwise.
- A newsletter editor — toolbar inserts markdown correctly for all 7 buttons; Preview matches Email typography; word count works; existing editor features unaffected.

- [ ] **Step 3: Final commit (only if cleanup was needed)**

```bash
git add -A apps/web
git commit -m "chore(web): server icons + editor verification cleanup"
```
If nothing changed, skip.

---

## Self-Review Notes

- **Spec coverage:** Part A — onboarding icon threading → Task 2; `ServerCard` render → Task 3; dashboard pass-through → Task 4. Part B — `NewsletterMarkdown` (B2 preview fidelity) → Task 5, wired in Task 7 Steps 6–7; `MarkdownToolbar` (B1) → Task 6, wired Task 7 Steps 2–4; word count (B3) → Task 7 Step 5. Baseline + final verification → Tasks 1, 8.
- **Placeholder scan:** every code step shows exact code. Task 7 Step 1 is a deliberate read-first step (the file is ~750 lines and the later steps reference specific blocks by their current content); Steps 8 is a compiler-driven conditional import removal — concrete, not vague.
- **Type consistency:** `ServerCardData.iconUrl?: string` (Task 3) is fed by `iconUrl: server.icon_url || undefined` (Task 4) — `string | null | undefined` narrowed to `string | undefined`, assignable. `DiscordGuild.icon?: string | null` (Task 2) is read as `guild.icon` truthy-check before building the URL. `MarkdownToolbar` props — `textareaRef: RefObject<HTMLTextAreaElement | null>`, `value: string`, `onChange: (next: string) => void` (Task 6) — match the `textareaRef`/`content`/`setContent` passed in Task 7 Step 4. `NewsletterMarkdown` takes `content: string` (Task 5), called with a `string` in both Task 7 Step 6 and Step 7.
