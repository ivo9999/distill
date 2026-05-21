# Distill — Server-Page Newsletters Section + List Pagination — Design

**Date:** 2026-05-21
**Status:** Approved
**Repo:** distill (`/Users/sisle/code/work/distill`)

Small frontend-only change. Two files, no Go / API / DB work.

## Problem

A newsletters list page already exists at
`/dashboard/servers/<id>/newsletters` (`PageHeader` + `NewsletterFeed`).
But:
1. The server **overview** page (`servers/[id]/page.tsx` — Voice /
   Schedule / Channels sections) has **no link** to it. From a server
   page you cannot reach that server's newsletters.
2. The list page renders every draft in one unbroken scroll — no
   pagination.

## Part 1 — "Newsletters" section on the server overview page

Add a `SettingsCard` titled **"Newsletters"** to
`apps/web/app/(app)/dashboard/servers/[id]/page.tsx`, rendered after the
existing `SettingsCard` sections (Voice & Identity, Schedule, Channels).

- The page already fetches server + channel data in a `useEffect`. Add a
  parallel fetch of `/api/proxy/servers/${serverId}/newsletters` into new
  state (`newsletters`, `newslettersLoading`). A failed fetch sets an
  empty list (the section just shows the empty state — non-fatal; the
  rest of the page works).
- Each newsletter object has: `id`, `status` (string),
  `created_at` (ISO date), `draft_markdown`, `edited_markdown` (string |
  null). Title is derived from the first `## ` heading of
  `edited_markdown || draft_markdown`, falling back to
  `"Untitled Newsletter"` — reuse the exact `extractTitle` logic the
  newsletters list page already uses (`/^##\s+(.+)$/m`).
- Render the **5 most recent** (the API returns them already sorted
  `created_at DESC`, so slice `.slice(0, 5)`) via the existing
  `NewsletterFeed` component. Map each to a `NewsletterFeedItem`:
  `{ id, serverId, serverName, title, status, updatedLabel }` where
  `updatedLabel = formatDistanceToNow(new Date(created_at), { addSuffix: true })`
  (`date-fns`, already a dependency) and `serverName` is the page's
  `serverName` state.
- The `SettingsCard`'s `action` slot holds a **"View all →"** link
  (`next/link`) to `/dashboard/servers/${serverId}/newsletters`.
- Empty state: when the server has no newsletters, render a short
  `text-sm text-ink-medium` line ("No newsletters generated yet.")
  instead of the feed. While loading, a "Loading…" line.

All existing Voice / Schedule / Channels state and handlers are
untouched — this only adds new state + one new section.

## Part 2 — Pagination on the newsletters list page

Add client-side pagination to
`apps/web/app/(app)/dashboard/servers/[id]/newsletters/page.tsx`.

The Go API's `ListNewslettersByServerID` returns the full array sorted
`created_at DESC` with no `LIMIT`/`OFFSET`. Newsletters accrue ~weekly,
so the payload stays small for years — pagination is purely client-side,
no backend change.

- Page size constant: `20`.
- Add a `page` state, default `1`.
- Compute `totalPages = Math.ceil(newsletters.length / 20)`.
- Slice the fetched `newsletters` to the current page —
  `newsletters.slice((page - 1) * 20, page * 20)` — and render that
  slice through `NewsletterFeed` (instead of the whole array).
- Below the feed, render a Prev / Next control with a "Page X of Y"
  label. Prev disabled on page 1; Next disabled on the last page.
- The whole control is hidden when `totalPages <= 1`.
- Pagination is local UI state only — no URL query param. Navigating
  away and back resets to page 1, which is acceptable for a
  weekly-cadence archive.
- The empty-state branch (no newsletters at all) is unchanged.

## Files

- Modify: `apps/web/app/(app)/dashboard/servers/[id]/page.tsx`
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/newsletters/page.tsx`

No Go / API / DB / chart changes.

## Testing

`apps/web` has no test framework. Verification is `pnpm build` (full
type-check) plus a visual check via `pnpm dev`:
- Server overview page shows a "Newsletters" section with up to 5 recent
  drafts and a working "View all" link; a server with no drafts shows
  the empty line.
- The newsletters list page paginates 20 per page with working
  Prev/Next; the control is hidden when there are ≤20 newsletters.

## Risks & Mitigations

- **Two components map newsletters to `NewsletterFeedItem`** — the
  server page and the list page both do the `extractTitle` +
  `formatDistanceToNow` mapping. They must agree. Mitigation: the
  server-page mapping copies the list page's existing `extractTitle`
  regex verbatim; both feed the same `NewsletterFeed` component.
- **Failed newsletters fetch on the server page** — handled as an empty
  list, not an error that breaks the Voice/Schedule/Channels page.

## Success Criteria

- From a server overview page, the user sees recent newsletters and can
  reach the full list.
- The newsletters list page paginates at 20 per page; the control hides
  for short lists.
- `apps/web` builds with no type errors; existing server-page and
  list-page functionality is unaffected.
