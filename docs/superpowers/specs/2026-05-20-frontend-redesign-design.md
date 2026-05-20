# Distill Frontend Redesign — Design

**Date:** 2026-05-20
**Status:** Approved

## Overview

Redesign the Distill web frontend (`apps/web`) to adopt the look and feel of
the `jira-clone` project, while keeping Distill's brand colors and domain.

Distill and jira-clone already share the same foundation: Next.js 16,
Tailwind v4, shadcn (new-york style), the Fizzy OKLCH token system, and a
near-identical `ui/` primitive set. Distill's `globals.css` is jira-clone's
file plus a `--brand` purple block. This work is therefore a **presentation
layer redesign**, not a framework migration: adopt jira-clone's app shell,
feature-component patterns, and page composition; keep Distill's brand purple
and its real domain (Discord servers / channels / newsletters / integrations).

**Guiding rule:** port jira-clone's full design language and every reusable
component; rebuild jira's domain-specific feature components as Distill
equivalents using identical styling patterns. No dead code — no kanban,
backlog, sprints, issues, teams, or docs editor, since Distill has no data
model for them.

## Scope

In scope:
- App shell (header, command palette, shortcuts help, notification bell UI).
- `ui/` primitive sync from jira-clone (refinements only, brand variant preserved).
- Feature components rebuilt for Distill's domain.
- All logged-in app pages restyled.
- Marketing pages (landing, FAQ) restyled.

Out of scope:
- API routes, auth, data fetching, server actions — untouched.
- No new backend functionality. The notification bell is cosmetic only.
- Any jira-specific feature with no Distill data model (kanban, backlog,
  sprints, issues, teams, docs editor).

## Section 1 — Style System & `ui/` Primitives

- **`globals.css`:** keep Distill's file unchanged. Its `--brand`
  (`#3C116E` light / `#8B5CF6` dark) and `brand-discord` / `brand-warm` /
  `brand-hot` / `brand-bright` palette is the definition of "keep Distill's
  colors." Token architecture already matches jira-clone.
- **`ui/` primitives:** diff each file against jira-clone's version and pull
  in jira's refinements (button, card, badge, dialog, dropdown-menu, etc.).
  Do **not** blindly overwrite — Distill's `button.tsx` has a `brand` variant
  that must survive. Each primitive is reviewed individually.
- **Fonts:** both use Adwaita Sans via `@fontsource`. No change.

## Section 2 — App Shell (FizzyHeader port)

Replace Distill's current `components/dashboard-shell.tsx` and its simple
header with a port of jira-clone's shell, adapted to Distill's routes.

- **`DashboardShell`** — wraps the app; hosts header, command palette,
  shortcuts dialog. Retains Distill's footer ("Built by SisleLabs in Sofia").
- **`FizzyHeader`** — centered pill popover-nav plus a big framed page-title
  row. Adaptations:
  - Quick tiles: **Servers**, **Integrations**, **Profile**.
  - Popover nav: a **Servers** section listing the user's Discord servers
    with per-server accent chips (hash-based, drawn from Distill's
    `brand-*` / `accent-*` palette), plus an "Add server" action; a
    **Settings** section (Integrations, Profile, Admin).
  - `deriveTitle()` rewritten for Distill routes: `Servers`, server name,
    `<Server> · Newsletters`, `<Server> · Settings`, `Integrations`,
    `Profile`, `Admin`.
  - Per-server nav bubbles (Overview / Newsletters / Settings) on server
    pages, mirroring jira's project bubbles.
- **Command palette (`⌘K`)** — cmdk-based (already a Distill dependency);
  jumps to servers and pages. Adapted from jira's `BottomBar`.
- **Keyboard shortcuts help (`?`)** — ported; content updated for Distill
  routes.
- **Notification bell** — ported as cosmetic UI only. Renders an empty
  "No notifications" popover. No backend.
- **Theme toggle** — Distill's existing `ThemeToggle` folded into the user
  dropdown menu (jira-clone has no theme toggle; Distill needs one).

Dropped from jira's shell: `PinnedIssuesStack`, `ClaudeCodeProgressWrapper`
(issue-specific, no Distill equivalent).

## Section 3 — Feature Components (adapted to Distill's domain)

Rebuilt using jira-clone's styling patterns — card composition, accent chips,
empty-state, badges, typography:

| jira-clone component        | Distill equivalent                                                            |
|-----------------------------|-------------------------------------------------------------------------------|
| `project-card`              | `server-card` — accent chip, name, status badge, cron schedule, quota pill    |
| `dashboard-feed`            | `newsletter-feed` — recent newsletter drafts across all servers               |
| `empty-state`               | ported as-is (generic) — used for no-servers, no-newsletters                  |
| `issue-detail-view`         | restyle Distill's existing newsletter editor with jira's detail-view layout   |
| `settings-*` tabs           | restyle server settings & integrations with jira's `settings-card` + tabs     |
| `create-project-dialog`     | `add-server-dialog` — wraps Distill's existing onboarding flow                |

Reused directly: `empty-state`, `keyboard-shortcuts-help`, command palette,
`notification-bell`.

## Section 4 — Pages Restyled

App pages (`app/(app)/dashboard/*`), each recomposed with the new shell and
jira-style headers (uppercase eyebrow + black title + subtitle):

- **Servers (dashboard)** — becomes a richer two-column layout, mirroring
  jira's homepage: a `newsletter-feed` hero ("What's moving" → recent
  newsletter drafts) plus a right rail with `server-card`s / server list.
- **Server overview** — server detail with nav bubbles, channel config,
  schedule, quota.
- **Newsletters list** — card grid of newsletter drafts for a server.
- **Newsletter editor** — restyled with jira's detail-view layout patterns.
- **Integrations** — jira `settings-card` + tabbed layout.
- **Profile** — jira `settings-card` layout.
- **Admin** — restyled dashboard.

Marketing pages (`app/(marketing)/*`): landing page and FAQ restyled with
jira-clone's typography scale, spacing, card, and button treatments — keeping
Distill's brand purple as the hero / CTA color.

## Section 5 — Risks & Mitigations

- **`ui/` divergence:** jira's primitives may have subtly diverged from
  Distill's. Mitigation: diff each primitive individually; preserve Distill's
  `brand` button variant; never blind-overwrite.
- **Notification bell:** intentionally cosmetic. Documented so no one wires a
  backend expecting one.
- **Data fetching untouched:** all restyled pages keep their existing data
  loading; only JSX/markup and class names change.

## Success Criteria

- `apps/web` builds with no type or lint errors.
- Every app page and the marketing pages render with the new shell and
  jira-clone styling.
- Distill's brand purple is the primary CTA/link/hero color throughout.
- No kanban/backlog/issues/teams/docs code is introduced.
- Distill's `brand` button variant still works.
- Light and dark mode both render correctly.
