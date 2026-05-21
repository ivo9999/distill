# Distill Server-Page Newsletters Section + List Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users reach a server's newsletters from its overview page (a "Newsletters" section showing the 5 most recent + a "View all" link), and paginate the full newsletters list page at 20 per page.

**Architecture:** Frontend only. The server overview page gains a newsletters fetch + a `SettingsCard` section rendering recent drafts via the existing `NewsletterFeed`. The newsletters list page gains client-side pagination (the API already returns the full sorted array; newsletters accrue ~weekly so no backend paging is needed).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, date-fns.

**Verification model:** `apps/web` has no test framework. Each task is verified by `pnpm build` (full type-check + compile) from `apps/web/`, plus a described visual check.

---

## File Structure

- `apps/web/app/(app)/dashboard/servers/[id]/page.tsx` — add a "Newsletters" `SettingsCard` section + the newsletters fetch.
- `apps/web/app/(app)/dashboard/servers/[id]/newsletters/page.tsx` — add client-side pagination.

No Go / API / DB / chart changes.

---

## Task 1: Baseline build

**Files:** none (verification)

- [ ] **Step 1: Baseline build**

Run (from `apps/web/`): `pnpm install && pnpm build`
Expected: build succeeds. If it fails, STOP and report BLOCKED.

---

## Task 2: Add the "Newsletters" section to the server overview page

**Files:**
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/page.tsx`

CONTEXT: This is a `"use client"` page. It has state including `serverName` and a `loading` flag, a `useEffect` with an inner `loadData` async function that fetches the server + channels, and a `return (...)` whose last `SettingsCard` is "Channels", closed by `</SettingsCard>` then `</div>` then `</div>` then `);`.

- [ ] **Step 1: Add imports**

In `apps/web/app/(app)/dashboard/servers/[id]/page.tsx`, the imports already include `PageHeader` and `SettingsCard` from `@/components/features/...`. Add these import lines after the `SettingsCard` import:
```tsx
import { NewsletterFeed } from "@/components/features/newsletter-feed";
import type { NewsletterFeedItem } from "@/components/features/newsletter-feed";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
```
(If `Link` or `formatDistanceToNow` is already imported in this file, do not duplicate — add only the missing ones. Check first.)

- [ ] **Step 2: Add a `Newsletter` type**

Near the top of the file, after the existing `interface Channel` declaration (or wherever interfaces are declared), add:
```tsx
interface Newsletter {
  id: string;
  status: string;
  created_at: string;
  draft_markdown: string;
  edited_markdown: string | null;
}

// Title for a newsletter draft — first ## heading of the (edited or
// raw) markdown. Mirrors the newsletters list page's extractTitle so
// both views label drafts identically.
function extractTitle(nl: Newsletter): string {
  const md = nl.edited_markdown || nl.draft_markdown || "";
  const match = md.match(/^##\s+(.+)$/m);
  return match ? match[1] : "Untitled Newsletter";
}
```

- [ ] **Step 3: Add newsletters state**

Alongside the other `useState` declarations (near `const [loading, setLoading] = useState(true)`), add:
```tsx
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [newslettersLoading, setNewslettersLoading] = useState(true);
```

- [ ] **Step 4: Fetch newsletters in the `useEffect`**

The page's `useEffect` runs an inner `loadData` async function. Add a SEPARATE newsletters fetch inside the same `useEffect` body, after the `loadData()` call. The `useEffect` currently looks roughly like:
```tsx
  useEffect(() => {
    const loadData = async () => {
      // ... fetches server + channels ...
    };
    loadData();
  }, [serverId]);
```
Change the body to also fetch newsletters:
```tsx
  useEffect(() => {
    const loadData = async () => {
      // ... existing body, unchanged ...
    };
    loadData();

    // Recent newsletters for the "Newsletters" section. A failed fetch
    // falls back to an empty list — non-fatal, the rest of the page
    // still works.
    fetch(`/api/proxy/servers/${serverId}/newsletters`)
      .then((r) => r.json())
      .then((data) => {
        setNewsletters(Array.isArray(data) ? data : []);
        setNewslettersLoading(false);
      })
      .catch(() => setNewslettersLoading(false));
  }, [serverId]);
```
Keep the existing `loadData` definition and its body exactly as-is — only add the `fetch(...)` chain after `loadData()`.

- [ ] **Step 5: Add the "Newsletters" `SettingsCard` section**

In the `return (...)`, find the closing of the "Channels" `SettingsCard` — the `</SettingsCard>` followed by `</div>` and `</div>`. Immediately AFTER that `</SettingsCard>` and BEFORE the wrapping `</div>`, add a new section. The recent-5 mapping and the section:
```tsx
        {/* Newsletters — recent drafts for this server, with a link to
            the full archive. */}
        <SettingsCard
          title="Newsletters"
          description="Recent newsletter drafts generated for this server."
          action={
            <Link
              href={`/dashboard/servers/${serverId}/newsletters`}
              className="text-sm font-semibold text-link hover:underline"
            >
              View all →
            </Link>
          }
        >
          {newslettersLoading ? (
            <p className="text-sm text-ink-medium">Loading…</p>
          ) : newsletters.length === 0 ? (
            <p className="text-sm text-ink-medium">
              No newsletters generated yet.
            </p>
          ) : (
            <NewsletterFeed
              items={newsletters.slice(0, 5).map(
                (nl): NewsletterFeedItem => ({
                  id: nl.id,
                  serverId,
                  serverName,
                  title: extractTitle(nl),
                  status: nl.status,
                  updatedLabel: formatDistanceToNow(
                    new Date(nl.created_at),
                    { addSuffix: true },
                  ),
                }),
              )}
            />
          )}
        </SettingsCard>
```
(`serverId` and `serverName` are existing values in this component — `serverId` from the route param, `serverName` from state.)

- [ ] **Step 6: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds, no type errors.

- [ ] **Step 7: Visual check**

Run `pnpm dev`, open a server page (`/dashboard/servers/<id>`). A "Newsletters" section appears after Channels, showing up to 5 recent drafts with a "View all →" link; a server with no drafts shows "No newsletters generated yet."

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(app)/dashboard/servers/[id]/page.tsx"
git commit -m "feat(web): show recent newsletters on the server overview page"
```

---

## Task 3: Paginate the newsletters list page

**Files:**
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/newsletters/page.tsx`

CONTEXT: This `"use client"` page fetches `newsletters` into state, builds a `feedItems: NewsletterFeedItem[]` array from ALL of them, and renders — when `newsletters.length > 0` — `<NewsletterFeed items={feedItems} />`. The empty case renders `<EmptyState .../>`. It already imports `useState` from `"react"`.

- [ ] **Step 1: Add a page-size constant and `page` state**

In `apps/web/app/(app)/dashboard/servers/[id]/newsletters/page.tsx`, add a module-level constant near the top (after the imports, before or alongside the `extractTitle` function):
```tsx
const PAGE_SIZE = 20;
```
Inside the component, alongside the other `useState` calls, add:
```tsx
  const [page, setPage] = useState(1);
```

- [ ] **Step 2: Paginate `feedItems`**

The component currently builds `feedItems` from all newsletters:
```tsx
  const feedItems: NewsletterFeedItem[] = newsletters.map((nl) => ({
    id: nl.id,
    serverId,
    serverName: "",
    title: extractTitle(nl),
    status: nl.status,
    updatedLabel: formatDistanceToNow(new Date(nl.created_at ?? ""), { addSuffix: true }),
  }));
```
Immediately AFTER that `feedItems` declaration, add the pagination math + slice:
```tsx
  const totalPages = Math.ceil(feedItems.length / PAGE_SIZE);
  const pageItems = feedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
```

- [ ] **Step 3: Render the page slice + a pager**

Find the non-empty render branch — currently `<NewsletterFeed items={feedItems} />`. Replace that single line with the page slice plus a Prev/Next pager:
```tsx
        <>
          <NewsletterFeed items={pageItems} />
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-ink-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
```
(`Button` is already imported in this file. The non-empty branch was a single element; wrapping it in a `<>...</>` fragment is required so the feed + pager are one expression.)

- [ ] **Step 4: Build**

Run (from `apps/web/`): `pnpm build`
Expected: succeeds, no type errors.

- [ ] **Step 5: Visual check**

Run `pnpm dev`, open a server's newsletters page. With ≤20 drafts: no pager (single scroll as before). With >20: 20 per page, Previous disabled on page 1, Next disabled on the last page, "Page X of Y" label correct.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(app)/dashboard/servers/[id]/newsletters/page.tsx"
git commit -m "feat(web): paginate the newsletters list page"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run (from `apps/web/`): `rm -rf .next && pnpm build`
Expected: build succeeds, zero type errors.

- [ ] **Step 2: Visual sweep**

Run `pnpm dev`:
- Server overview page (`/dashboard/servers/<id>`) — "Newsletters" section shows recent drafts + working "View all" link; empty-state line for a server with no drafts.
- Newsletters list page — paginates 20 per page; pager hidden for short lists; existing generate / empty-state behaviour unaffected.

- [ ] **Step 3: Final commit (only if cleanup was needed)**

```bash
git add -A apps/web
git commit -m "chore(web): server newsletters section verification cleanup"
```
If nothing changed, skip.

---

## Self-Review Notes

- **Spec coverage:** Part 1 (server-page Newsletters section, recent 5, View-all link, empty state, non-fatal failed fetch) → Task 2. Part 2 (client-side pagination, page size 20, Prev/Next, "Page X of Y", hidden when ≤1 page) → Task 3. Verification → Tasks 1, 4.
- **Placeholder scan:** every code step shows exact code. Task 2 Step 1 says "check first" before adding imports — that is a deliberate dedup guard (the file may already import `Link`), not a vague placeholder; the action is concrete.
- **Type consistency:** `Newsletter` (Task 2 Step 2) has `id`/`status`/`created_at`/`draft_markdown`/`edited_markdown` — matches the fields read in `extractTitle` and the feed mapping. `NewsletterFeedItem` is the existing exported type, mapped identically in Task 2 (`{id, serverId, serverName, title, status, updatedLabel}`) and unchanged in Task 3. `PAGE_SIZE = 20` (Task 3 Step 1) is used in `totalPages`/`pageItems` (Step 2) and the pager (Step 3). `page`/`setPage` consistent across Steps 1–3.
