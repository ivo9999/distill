# Distill Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Distill web frontend (`apps/web`) to adopt jira-clone's app shell, component patterns, and page composition, while keeping Distill's brand purple and its Discord-server / newsletter domain.

**Architecture:** Distill and jira-clone already share Next.js 16, Tailwind v4, shadcn (new-york), the Fizzy OKLCH token system, and a near-identical `ui/` primitive set. This plan ports jira-clone's `FizzyHeader`-based shell, command palette, and keyboard infrastructure; rebuilds jira's domain-specific feature components (`project-card` → `server-card`, `dashboard-feed` → `newsletter-feed`) for Distill's data; and recomposes every page. No backend, auth, or data-fetching changes. No kanban/backlog/issues/teams/docs.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, lucide-react, cmdk.

**Verification model:** `apps/web` has no test framework. Each task is verified by `pnpm build` (type + compile check), `pnpm lint`, and a described visual check via `pnpm dev`. Run all `pnpm` commands from `apps/web/`.

---

## File Structure

Files created:
- `apps/web/hooks/use-device-type.ts` — mobile/Mac detection (shared by shortcut infra).
- `apps/web/hooks/use-keyboard-shortcut.ts` — keyboard shortcut hook.
- `apps/web/lib/keyboard-shortcuts.ts` — shortcut registry for the help dialog.
- `apps/web/components/features/fizzy-header.tsx` — centered pill popover-nav + framed title row.
- `apps/web/components/features/command-palette.tsx` — `⌘K` palette (servers + pages).
- `apps/web/components/features/keyboard-shortcuts-help.tsx` — `?` help dialog.
- `apps/web/components/features/notification-bell.tsx` — cosmetic bell + empty popover.
- `apps/web/components/features/server-card.tsx` — Discord server card.
- `apps/web/components/features/newsletter-feed.tsx` — recent newsletter drafts feed.
- `apps/web/components/features/empty-state.tsx` — generic empty state.
- `apps/web/components/features/settings-card.tsx` — flat settings section with divider heading.
- `apps/web/components/features/page-header.tsx` — eyebrow + black title + subtitle header.

Files modified:
- `apps/web/components/dashboard-shell.tsx` — rewritten to host FizzyHeader + palette + dialogs.
- `apps/web/app/(app)/dashboard/page.tsx` — two-column layout (feed + server rail).
- `apps/web/app/(app)/dashboard/servers/[id]/page.tsx` — server overview restyle.
- `apps/web/app/(app)/dashboard/servers/[id]/newsletters/page.tsx` — newsletter list restyle.
- `apps/web/app/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx` — editor restyle.
- `apps/web/app/(app)/dashboard/integrations/page.tsx` — settings-card layout.
- `apps/web/app/(app)/dashboard/profile/profile-client.tsx` — settings-card layout.
- `apps/web/app/(app)/dashboard/admin/page.tsx` — restyle.
- `apps/web/app/(marketing)/page.tsx` — landing restyle.
- `apps/web/app/(marketing)/_components/faq.tsx` — FAQ restyle.

Files unchanged: `globals.css`, all `ui/` primitives (already match — see Task 1), all `app/api/*`, `lib/auth.ts`, `lib/api.ts`, server actions.

---

## Task 1: Verify ui/ primitives & baseline build

**Files:**
- Inspect only: `apps/web/components/ui/*`, `apps/web/components/ui/button.tsx`

- [ ] **Step 1: Confirm baseline build passes**

Run (from `apps/web/`): `pnpm install && pnpm build`
Expected: build succeeds. If it fails, stop and report — the redesign must start from a green build.

- [ ] **Step 2: Diff ui/ primitives against jira-clone**

Run:
```bash
for f in button card badge dialog dropdown-menu popover input textarea select tabs avatar separator; do
  echo "=== $f ==="
  diff /Users/sisle/code/work/jira-clone/src/components/ui/$f.tsx /Users/sisle/code/work/distill/apps/web/components/ui/$f.tsx
done
```
Expected: `button.tsx` differs (distill adds `brand` + `discord` variants — KEEP distill's version, do not overwrite). Others should be identical or trivially different. If any other primitive shows a meaningful jira-clone refinement, copy *only that refinement* into distill's file, preserving distill imports. Do not touch `button.tsx`.

- [ ] **Step 3: Commit (only if a primitive was changed)**

```bash
git add apps/web/components/ui
git commit -m "chore(web): sync ui primitive refinements from jira-clone"
```
If nothing changed, skip this commit.

---

## Task 2: Port keyboard + device hooks

**Files:**
- Create: `apps/web/hooks/use-device-type.ts`
- Create: `apps/web/hooks/use-keyboard-shortcut.ts`

- [ ] **Step 1: Create `use-device-type.ts`**

Copy verbatim from `/Users/sisle/code/work/jira-clone/src/hooks/use-device-type.ts`. The file has no project-specific imports — it is portable as-is. It exports `useDeviceType()` (returns `{ isMobile, isDesktop, isTouchDevice }`) and `useIsMac()`.

- [ ] **Step 2: Create `use-keyboard-shortcut.ts`**

Copy verbatim from `/Users/sisle/code/work/jira-clone/src/hooks/use-keyboard-shortcut.ts`. Its only import is `./use-device-type` (created in Step 1). It exports `useKeyboardShortcut(options)` and `useKeyboardShortcuts(list)` plus the `ShortcutOptions` interface.

- [ ] **Step 3: Verify TypeScript compiles**

Run (from `apps/web/`): `pnpm exec tsc --noEmit`
Expected: no errors referencing the two new files.

- [ ] **Step 4: Commit**

```bash
git add apps/web/hooks
git commit -m "feat(web): port keyboard shortcut + device-type hooks"
```

---

## Task 3: Keyboard shortcuts registry

**Files:**
- Create: `apps/web/lib/keyboard-shortcuts.ts`

- [ ] **Step 1: Create the registry**

Create `apps/web/lib/keyboard-shortcuts.ts` with Distill-appropriate shortcuts (no "Issues" category — Distill has none):

```ts
/**
 * Central registry of keyboard shortcuts for the application.
 * Used for the shortcuts help overlay and consistent shortcut handling.
 */

type ModifierKey = "meta" | "ctrl" | "shift" | "alt";

export type ShortcutCategory = "General" | "Navigation" | "Help";

export interface ShortcutDefinition {
  key: string;
  modifiers: ModifierKey[];
  description: string;
  category: ShortcutCategory;
}

export const KEYBOARD_SHORTCUTS: Record<string, ShortcutDefinition> = {
  SEARCH: {
    key: "k",
    modifiers: ["meta"],
    description: "Open command palette",
    category: "Navigation",
  },
  NAV: {
    key: "j",
    modifiers: ["meta"],
    description: "Open navigation menu",
    category: "Navigation",
  },
  HELP: {
    key: "?",
    modifiers: [],
    description: "Show keyboard shortcuts",
    category: "Help",
  },
  CLOSE: {
    key: "Escape",
    modifiers: [],
    description: "Close dialog or palette",
    category: "General",
  },
} as const;

const categoryOrder: ShortcutCategory[] = ["General", "Navigation", "Help"];

export function getShortcutsByCategory(): Record<ShortcutCategory, ShortcutDefinition[]> {
  const grouped: Record<ShortcutCategory, ShortcutDefinition[]> = {
    General: [],
    Navigation: [],
    Help: [],
  };
  for (const shortcut of Object.values(KEYBOARD_SHORTCUTS)) {
    grouped[shortcut.category].push(shortcut);
  }
  return grouped;
}

export { categoryOrder };

/** Formats a shortcut into display key parts, e.g. ["⌘", "K"]. */
export function formatShortcutParts(
  shortcut: ShortcutDefinition,
  isMac: boolean,
): string[] {
  const parts: string[] = [];
  for (const mod of shortcut.modifiers) {
    if (mod === "meta") parts.push(isMac ? "⌘" : "Ctrl");
    else if (mod === "ctrl") parts.push("Ctrl");
    else if (mod === "shift") parts.push("⇧");
    else if (mod === "alt") parts.push(isMac ? "⌥" : "Alt");
  }
  parts.push(shortcut.key === "Escape" ? "Esc" : shortcut.key.toUpperCase());
  return parts;
}
```

- [ ] **Step 2: Verify compile**

Run (from `apps/web/`): `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/keyboard-shortcuts.ts
git commit -m "feat(web): add keyboard shortcuts registry"
```

---

## Task 4: Keyboard shortcuts help dialog

**Files:**
- Create: `apps/web/components/features/keyboard-shortcuts-help.tsx`

- [ ] **Step 1: Create the dialog**

Create `apps/web/components/features/keyboard-shortcuts-help.tsx`. Adapted from jira-clone (its version imported `getShortcutsByCategory`, `formatShortcutParts`, `categoryOrder` — all now provided by Task 3):

```tsx
"use client";

import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useIsMac } from "@/hooks/use-device-type";
import {
  getShortcutsByCategory,
  formatShortcutParts,
  categoryOrder,
} from "@/lib/keyboard-shortcuts";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) {
  const isMac = useIsMac();
  const shortcutsByCategory = getShortcutsByCategory();

  useKeyboardShortcut({
    key: "Escape",
    callback: () => onOpenChange(false),
    enabled: open,
    ignoreInInput: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5" />
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {categoryOrder.map((category) => {
            const shortcuts = shortcutsByCategory[category];
            if (shortcuts.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-medium mb-2">
                  {category}
                </h3>
                <div className="space-y-0.5">
                  {shortcuts.map((shortcut, index) => {
                    const keyParts = formatShortcutParts(shortcut, isMac);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-card hover:bg-ink-lightest/60"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {keyParts.map((part, partIndex) => (
                            <kbd
                              key={partIndex}
                              className="px-1.5 py-0.5 text-xs font-mono bg-canvas border border-ink-lighter rounded-card shadow-sm min-w-[24px] text-center"
                            >
                              {part}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-ink-medium text-center pt-3 border-t border-ink-lighter">
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-canvas border border-ink-lighter rounded-card text-xs">
            ?
          </kbd>{" "}
          anytime to view shortcuts
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify compile**

Run (from `apps/web/`): `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/features/keyboard-shortcuts-help.tsx
git commit -m "feat(web): add keyboard shortcuts help dialog"
```

---

## Task 5: Notification bell (cosmetic)

**Files:**
- Create: `apps/web/components/features/notification-bell.tsx`

- [ ] **Step 1: Create the cosmetic bell**

Distill has no notifications backend. This is a static UI placeholder — no polling, no server actions. Create `apps/web/components/features/notification-bell.tsx`:

```tsx
"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  className?: string;
  iconClassName?: string;
}

// Cosmetic only: Distill has no notifications backend. Renders a bell that
// opens an empty "No notifications" popover. Kept for visual parity with the
// jira-clone shell.
export function NotificationBell({
  className,
  iconClassName,
}: NotificationBellProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 relative", className)}
        >
          <Bell className={cn("h-4 w-4", iconClassName)} />
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-sm font-medium">Notifications</h3>
        </div>
        <p className="py-10 text-center text-xs text-ink-medium">
          You&rsquo;re all caught up.
        </p>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify compile**

Run (from `apps/web/`): `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/features/notification-bell.tsx
git commit -m "feat(web): add cosmetic notification bell"
```

---

## Task 6: Command palette

**Files:**
- Create: `apps/web/components/features/command-palette.tsx`

- [ ] **Step 1: Create the palette**

Adapted from jira-clone's `bottom-bar.tsx`. Jira searched issues via a server action; Distill instead offers static navigation entries plus the user's servers (passed as a prop). Uses the already-installed `cmdk`-based `components/ui/command.tsx`. Create `apps/web/components/features/command-palette.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Server, Plug, User, Sparkles, LayoutGrid } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface PaletteServer {
  id: string;
  name: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: PaletteServer[];
}

export function CommandPalette({
  open,
  onOpenChange,
  servers,
}: CommandPaletteProps) {
  const router = useRouter();

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a server or page…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Servers
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/integrations")}>
            <Plug className="mr-2 h-4 w-4" />
            Integrations
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/profile")}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/onboarding")}>
            <Sparkles className="mr-2 h-4 w-4" />
            Add a server
          </CommandItem>
        </CommandGroup>
        {servers.length > 0 && (
          <CommandGroup heading="Servers">
            {servers.map((s) => (
              <CommandItem
                key={s.id}
                value={s.name}
                onSelect={() => go(`/dashboard/servers/${s.id}`)}
              >
                <Server className="mr-2 h-4 w-4" />
                {s.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2: Verify `command.tsx` exports the named parts**

Run: `grep -E "export (function|const) (CommandDialog|CommandInput|CommandList|CommandEmpty|CommandGroup|CommandItem)" apps/web/components/ui/command.tsx`
Expected: all six names appear. If `CommandDialog` is missing, copy it from `/Users/sisle/code/work/jira-clone/src/components/ui/command.tsx` into distill's `command.tsx`.

- [ ] **Step 3: Verify compile**

Run (from `apps/web/`): `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/features/command-palette.tsx apps/web/components/ui/command.tsx
git commit -m "feat(web): add command palette"
```

---

## Task 7: Page header component

**Files:**
- Create: `apps/web/components/features/page-header.tsx`

- [ ] **Step 1: Create the header**

Reusable jira-style page header (uppercase eyebrow + black title + subtitle), extracted so every page uses one component. Create `apps/web/components/features/page-header.tsx`:

```tsx
interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-medium">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-ink-medium">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
```

- [ ] **Step 2: Verify compile + commit**

Run (from `apps/web/`): `pnpm exec tsc --noEmit` (expect no errors), then:
```bash
git add apps/web/components/features/page-header.tsx
git commit -m "feat(web): add page-header component"
```

---

## Task 8: Empty state + settings card

**Files:**
- Create: `apps/web/components/features/empty-state.tsx`
- Create: `apps/web/components/features/settings-card.tsx`

- [ ] **Step 1: Create `empty-state.tsx`**

Adapted from jira-clone (jira's version embedded a `CreateProjectDialog`; Distill's is generic — caller supplies the action). The `icon` prop takes a lucide component directly:

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="grid place-items-center w-16 h-16 rounded-full bg-ink-lightest mb-4">
        <Icon className="h-8 w-8 text-ink-medium" />
      </div>
      <h3 className="text-lg font-bold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-medium mb-6 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `settings-card.tsx`**

Copy verbatim from `/Users/sisle/code/work/jira-clone/src/components/features/settings/settings-card.tsx` to `apps/web/components/features/settings-card.tsx`. Its only imports are `react`, `lucide-react`, and `@/lib/utils` — all available in Distill. Do not change the path inside the file; it has no internal feature imports.

- [ ] **Step 3: Verify compile + commit**

Run (from `apps/web/`): `pnpm exec tsc --noEmit` (expect no errors), then:
```bash
git add apps/web/components/features/empty-state.tsx apps/web/components/features/settings-card.tsx
git commit -m "feat(web): add empty-state and settings-card components"
```

---

## Task 9: Server card

**Files:**
- Create: `apps/web/components/features/server-card.tsx`

- [ ] **Step 1: Create the server card**

Distill equivalent of jira's `project-card`, built with the same Card composition and accent-chip pattern, using Distill's `brand-*` palette. Create `apps/web/components/features/server-card.tsx`:

```tsx
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
}

// Per-server avatar colour rotation. Mirrors the dashboard's existing
// accentByIndex: brand purple first, then Discord-blue, then accents.
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
  return (
    <Link href={`/dashboard/servers/${server.id}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-card text-sm font-black uppercase text-ink-inverted"
                style={{ backgroundColor: accentFor(server.id) }}
              >
                {server.name?.[0]?.toUpperCase() ?? "?"}
              </div>
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

- [ ] **Step 2: Verify compile + commit**

Run (from `apps/web/`): `pnpm exec tsc --noEmit` (expect no errors), then:
```bash
git add apps/web/components/features/server-card.tsx
git commit -m "feat(web): add server-card component"
```

---

## Task 10: Newsletter feed

**Files:**
- Create: `apps/web/components/features/newsletter-feed.tsx`

- [ ] **Step 1: Create the feed**

Distill equivalent of jira's `dashboard-feed` "What's moving" list, restyled as a vertical list of recent newsletter drafts. Pure presentational component — caller supplies data. Create `apps/web/components/features/newsletter-feed.tsx`:

```tsx
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface NewsletterFeedItem {
  id: string;
  serverId: string;
  serverName: string;
  title: string;
  status: string;
  updatedLabel: string;
}

export function NewsletterFeed({ items }: { items: NewsletterFeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-ink-light px-4 py-10 text-center text-sm text-ink-medium">
        No newsletter drafts yet. Generate one from a server.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/dashboard/servers/${item.serverId}/newsletters/${item.id}`}
            className="group flex items-center gap-3 rounded-card border border-ink-lighter bg-canvas px-4 py-3 transition-shadow hover:shadow-card"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-card bg-brand-soft text-brand">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-darker group-hover:text-link transition-colors">
                {item.title}
              </p>
              <p className="text-xs text-ink-medium">
                {item.serverName} · {item.updatedLabel}
              </p>
            </div>
            <Badge variant={item.status === "published" ? "default" : "secondary"}>
              {item.status}
            </Badge>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-medium opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Verify compile + commit**

Run (from `apps/web/`): `pnpm exec tsc --noEmit` (expect no errors), then:
```bash
git add apps/web/components/features/newsletter-feed.tsx
git commit -m "feat(web): add newsletter-feed component"
```

---

## Task 11: FizzyHeader

**Files:**
- Create: `apps/web/components/features/fizzy-header.tsx`

- [ ] **Step 1: Create the header**

Adapted from jira-clone's `fizzy-header.tsx`. Changes from jira's version: nav targets are Distill routes; "projects" become "servers"; logout uses Distill's signout URL (`window.location.href = "/api/auth/signout"`, matching the current `dashboard-shell.tsx`); the theme toggle is added to the user dropdown; the bell is the cosmetic one from Task 5. Create `apps/web/components/features/fizzy-header.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Home,
  Plug,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationBell } from "@/components/features/notification-bell";

export interface HeaderServer {
  id: string;
  name: string;
}

interface HeaderUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface FizzyHeaderProps {
  user: HeaderUser;
  servers: HeaderServer[];
  currentServerId?: string;
  onOpenSearch?: () => void;
}

function deriveTitle(
  pathname: string,
  currentServer?: HeaderServer,
): string {
  if (pathname === "/dashboard") return "Servers";
  if (pathname === "/dashboard/integrations") return "Integrations";
  if (pathname === "/dashboard/profile") return "Profile";
  if (pathname === "/dashboard/admin") return "Admin";
  if (pathname === "/dashboard/onboarding") return "Add a server";
  if (pathname.startsWith("/dashboard/servers/") && currentServer) {
    if (pathname.includes("/newsletters")) return `${currentServer.name} · Newsletters`;
    return currentServer.name;
  }
  return "Distill";
}

export function FizzyHeader({
  user,
  servers,
  currentServerId,
  onOpenSearch,
}: FizzyHeaderProps) {
  const pathname = usePathname() ?? "";
  const currentServer = servers.find((s) => s.id === currentServerId);
  const title = deriveTitle(pathname, currentServer);
  const [navOpen, setNavOpen] = useState(false);

  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-pill hover:bg-ink-lightest transition-colors sm:h-12 sm:w-12"
          aria-label="User menu"
        >
          <Avatar className="h-9 w-9 sm:h-11 sm:w-11">
            <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
            <AvatarFallback className="bg-ink text-ink-inverted text-xs font-bold sm:text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
            <AvatarFallback className="bg-ink text-ink-inverted text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink-darker">
              {user.name}
            </p>
            <p className="truncate text-xs text-ink-medium">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <User /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/integrations">
            <Plug /> Integrations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/admin">
            <Shield /> Admin
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            window.location.href = "/api/auth/signout";
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header
      className="relative z-30 grid items-center gap-y-1 bg-canvas px-3 py-2"
      style={{
        gridTemplateColumns: "1fr auto 1fr",
        gridTemplateAreas: '"nav nav nav" "left title right"',
      }}
    >
      {/* Row 1: centered nav trigger */}
      <Popover open={navOpen} onOpenChange={setNavOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mx-auto inline-flex items-center gap-2.5 rounded-pill border border-ink-lighter bg-canvas px-5 py-2.5 text-sm font-semibold text-ink-darker transition-colors hover:bg-ink-lightest"
            style={{ gridArea: "nav" }}
            aria-haspopup="menu"
            aria-expanded={navOpen}
          >
            <BrandMark className="h-5 w-auto" />
            <span className="font-black tracking-tight">
              {currentServer?.name ?? "Distill"}
            </span>
            <ChevronDown className="h-4 w-4 text-ink-medium" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          sideOffset={6}
          className="flex w-[min(45ch,calc(100vw-2rem))] max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-3xl border-ink-lighter p-0"
        >
          <button
            type="button"
            onClick={() => {
              setNavOpen(false);
              onOpenSearch?.();
            }}
            className="flex items-center gap-2 px-4 pt-4 pb-2 text-xs font-medium text-ink-medium transition-colors hover:text-ink"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search servers and pages…</span>
            <kbd className="ml-auto inline-flex h-4 items-center rounded border border-ink-light px-1 text-[9px] font-mono">
              ⌘K
            </kbd>
          </button>

          <div className="grid grid-cols-3 gap-2 px-4 pb-3">
            <QuickTile href="/dashboard" icon={Home} label="Servers" isActive={pathname === "/dashboard"} onNavigate={() => setNavOpen(false)} />
            <QuickTile href="/dashboard/integrations" icon={Plug} label="Integrations" isActive={pathname === "/dashboard/integrations"} onNavigate={() => setNavOpen(false)} />
            <QuickTile href="/dashboard/profile" icon={User} label="Profile" isActive={pathname === "/dashboard/profile"} onNavigate={() => setNavOpen(false)} />
          </div>

          <div className="flex-1 overflow-y-auto border-t border-ink-lighter">
            <NavSection title="Servers" defaultOpen>
              {servers.map((s) => (
                <NavLink
                  key={s.id}
                  href={`/dashboard/servers/${s.id}`}
                  onNavigate={() => setNavOpen(false)}
                  isActive={pathname.startsWith(`/dashboard/servers/${s.id}`)}
                  leading={<Server className="h-4 w-4 shrink-0" />}
                >
                  {s.name}
                </NavLink>
              ))}
              <Link
                href="/dashboard/onboarding"
                onClick={() => setNavOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-semibold text-ink-medium transition-colors hover:bg-ink-lightest hover:text-ink"
              >
                <Plus className="h-4 w-4 shrink-0" />
                Add a server
              </Link>
            </NavSection>
            <NavSection title="Settings">
              <NavLink href="/dashboard/admin" onNavigate={() => setNavOpen(false)} isActive={pathname === "/dashboard/admin"} leading={<Shield className="h-4 w-4 shrink-0" />}>
                Admin
              </NavLink>
            </NavSection>
          </div>
        </PopoverContent>
      </Popover>

      {/* Row 2: bell + framed title + avatar */}
      <div
        className="mx-auto mt-3 flex w-full flex-col items-stretch gap-2 sm:mt-6 sm:w-[80%]"
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="flex w-full items-center gap-2">
          <NotificationBell
            className="h-10 w-10 rounded-full bg-ink text-ink-inverted hover:bg-ink hover:text-ink-inverted hover:brightness-110 sm:h-12 sm:w-12"
            iconClassName="h-4 w-4 sm:h-5 sm:w-5"
          />
          <span aria-hidden className="h-px flex-1 bg-ink-lighter" />
          <h1 className="truncate px-2 text-center text-lg font-black tracking-tight text-ink sm:px-3 sm:text-3xl">
            {title}
          </h1>
          <span aria-hidden className="h-px flex-1 bg-ink-lighter" />
          {userMenu}
        </div>
      </div>
    </header>
  );
}

function NavSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group/section border-t border-ink-lighter first:border-t-0"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer list-none select-none items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-ink-darker transition-colors hover:bg-ink-lightest/50">
        <ChevronRight className="h-3 w-3 text-ink-medium transition-transform group-open/section:rotate-90" />
        {title}
      </summary>
      <div className="flex flex-col gap-px px-2 pb-2">{children}</div>
    </details>
  );
}

function QuickTile({
  href,
  icon: Icon,
  label,
  isActive,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-[11px] font-bold transition-colors",
        isActive
          ? "bg-selected text-link"
          : "bg-ink-lightest/60 text-ink-darker hover:bg-ink-lightest",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center leading-tight">{label}</span>
    </Link>
  );
}

function NavLink({
  href,
  children,
  isActive,
  leading,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
  leading: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
        isActive
          ? "bg-ink text-ink-inverted"
          : "text-ink-darker hover:bg-ink-lightest hover:text-ink",
      )}
    >
      {leading}
      <span className="truncate">{children}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Confirm `theme-toggle.tsx` renders inside a dropdown**

Run: `cat apps/web/components/theme-toggle.tsx`
Expected: it is a self-contained client component. If it is icon-only with no label, that is fine inside the dropdown row. No change required unless it throws — if it does, wrap its usage so it renders a simple button.

- [ ] **Step 3: Verify compile**

Run (from `apps/web/`): `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/features/fizzy-header.tsx
git commit -m "feat(web): add FizzyHeader nav component"
```

---

## Task 12: Rewrite DashboardShell

**Files:**
- Modify: `apps/web/components/dashboard-shell.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the shell**

The shell must know the user's servers (for the nav popover + palette). It currently does not fetch them. Fetch them client-side on mount via the existing `/api/proxy/servers` endpoint (same call `dashboard/page.tsx` already uses). Replace the entire contents of `apps/web/components/dashboard-shell.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FizzyHeader, type HeaderServer } from "@/components/features/fizzy-header";
import { CommandPalette } from "@/components/features/command-palette";
import { KeyboardShortcutsHelp } from "@/components/features/keyboard-shortcuts-help";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

interface ShellUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  subscriptionStatus?: string;
}

export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [servers, setServers] = useState<HeaderServer[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/proxy/servers")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setServers(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
  }, []);

  useKeyboardShortcut({
    key: "k",
    modifiers: ["meta"],
    callback: () => setSearchOpen((o) => !o),
  });
  useKeyboardShortcut({
    key: "?",
    callback: () => setShortcutsOpen(true),
  });

  // Derive the current server id from /dashboard/servers/<id>/...
  const match = pathname.match(/^\/dashboard\/servers\/([^/]+)/);
  const currentServerId = match?.[1];

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <FizzyHeader
        user={user}
        servers={servers}
        currentServerId={currentServerId}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-ink-lighter/60 py-4 text-center text-xs text-ink-medium">
        Built by SisleLabs in Sofia ·{" "}
        <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
          distill
        </Link>
      </footer>

      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        servers={servers}
      />
      <KeyboardShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
```

- [ ] **Step 2: Verify the layout still passes the right props**

Run: `grep -n "DashboardShell" apps/web/app/\(app\)/layout.tsx`
Expected: `layout.tsx` passes `user={{ name, email, image, subscriptionStatus }}`. The new shell accepts exactly those fields. No layout change needed.

- [ ] **Step 3: Build**

Run (from `apps/web/`): `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Visual check**

Run (from `apps/web/`): `pnpm dev`, open `/dashboard`.
Expected: centered pill nav at top; clicking it opens the popover with Servers/Integrations/Profile tiles and a Servers list; `⌘K` opens the palette; `?` opens the shortcuts dialog; avatar dropdown shows Profile/Integrations/Admin/theme toggle/Sign out.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/dashboard-shell.tsx
git commit -m "feat(web): rewrite DashboardShell around FizzyHeader"
```

---

## Task 13: Restyle Servers dashboard (two-column)

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Recompose the dashboard**

Keep all existing data fetching and the `handleGenerate` logic. Replace the rendered JSX so the page is a two-column layout: a `NewsletterFeed` hero on the left and a server list (using `ServerCard`) on the right. The page must also fetch recent newsletters per server. Modify `apps/web/app/(app)/dashboard/page.tsx`:

  - Keep the `Server`, `Quota`, `humanCron`, `accentByIndex` declarations and the `useEffect` that loads servers + quotas and the `handleGenerate` function unchanged.
  - Add state: `const [drafts, setDrafts] = useState<NewsletterFeedItem[]>([]);`
  - In the servers `useEffect`, after servers load, for each server also `fetch('/api/proxy/servers/${server.id}/newsletters')`, take the most recent 3, and merge into `drafts` mapped to `NewsletterFeedItem` shape (`{ id, serverId: server.id, serverName: server.name, title: n.subject ?? 'Untitled draft', status: n.status, updatedLabel: <relative date via date-fns formatDistanceToNow> }`). Sort the merged list by date descending and cap at 8.
  - Replace the outer returned JSX (the `<div>` with the header + `grid gap-3`) with:

```tsx
import { PageHeader } from "@/components/features/page-header";
import { NewsletterFeed, type NewsletterFeedItem } from "@/components/features/newsletter-feed";
import { ServerCard } from "@/components/features/server-card";
import { EmptyState } from "@/components/features/empty-state";
import { ServerIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ... inside the component's return, for the non-empty, non-loading case:
return (
  <div>
    <PageHeader
      eyebrow="Dashboard"
      title="What's moving"
      description="Recent newsletter drafts across your Discord servers."
      action={
        <Link href="/dashboard/onboarding">
          <Button variant="outline" size="sm">Add another server</Button>
        </Link>
      }
    />
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <NewsletterFeed items={drafts} />
      </section>
      <aside>
        <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-ink-medium">
          Servers
        </h2>
        <div className="flex flex-col gap-3">
          {servers.map((server, i) => {
            const quota = quotas[server.id];
            return (
              <ServerCard
                key={server.id}
                server={{
                  id: server.id,
                  name: server.name,
                  status: server.status,
                  scheduleLabel: humanCron(server.schedule_cron),
                  quotaLabel: quota
                    ? quota.tier === "free"
                      ? quota.remaining > 0
                        ? "1 free generation"
                        : "Free generation used"
                      : `${quota.remaining}/${quota.limit} on-demand`
                    : undefined,
                }}
              />
            );
          })}
        </div>
      </aside>
    </div>
    {generateError && (
      <GenerationError
        error={generateError}
        onRetry={
          generateError.category === "timeout" || generateError.category === "internal"
            ? () => handleGenerate(generateError.id)
            : undefined
        }
        onDismiss={() => setGenerateError(null)}
      />
    )}
  </div>
);
```

  - For the empty-servers branch, replace the existing `<Card>` block with:

```tsx
return (
  <EmptyState
    icon={ServerIcon}
    title="Welcome to Distill"
    description="Connect your first Discord server to get started. Your first generation is free."
    actionLabel="Set up your first server"
    onAction={() => router.push("/dashboard/onboarding")}
  />
);
```

  - The per-server "Generate now" button moved off the card. Keep `handleGenerate` reachable: the server overview page (Task 14) carries the Generate action. Remove the now-unused `accentByIndex` only if nothing else references it; otherwise leave it.

- [ ] **Step 2: Build**

Run (from `apps/web/`): `pnpm build`
Expected: build succeeds. If `accentByIndex`, `Calendar`, `Badge`, `Skeleton`, or other imports are now unused, remove them to keep lint clean.

- [ ] **Step 3: Lint**

Run (from `apps/web/`): `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Visual check**

Run `pnpm dev`, open `/dashboard`. Expected: two-column layout — newsletter feed left, server cards right; empty state shows when there are no servers.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/page.tsx
git commit -m "feat(web): restyle servers dashboard as two-column feed"
```

---

## Task 14: Restyle server overview page

**Files:**
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/page.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat apps/web/app/\(app\)/dashboard/servers/\[id\]/page.tsx`
Note its data fetching and existing controls (channel config, schedule, generate).

- [ ] **Step 2: Restyle**

Keep all data fetching, state, and handlers unchanged. Wrap the page content in a `PageHeader` (eyebrow `"Server"`, title = server name, description = its schedule) and group settings into `SettingsCard` sections (e.g. "Channels", "Schedule", "Generation"). Move the "Generate now" button (the `handleGenerate` flow from the old dashboard, if present here) into a `SettingsCard` action or a primary `Button` in the header `action` slot. Use `Card`/`CardContent` for grouped content. Do not change endpoint calls.

- [ ] **Step 3: Build + lint**

Run (from `apps/web/`): `pnpm build && pnpm lint`
Expected: both pass; remove any now-unused imports.

- [ ] **Step 4: Visual check**

Run `pnpm dev`, open a server page. Expected: framed page title, settings grouped into divider-headed sections.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/servers/\[id\]/page.tsx
git commit -m "feat(web): restyle server overview page"
```

---

## Task 15: Restyle newsletters list page

**Files:**
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/newsletters/page.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat apps/web/app/\(app\)/dashboard/servers/\[id\]/newsletters/page.tsx`

- [ ] **Step 2: Restyle**

Keep data fetching unchanged. Add a `PageHeader` (eyebrow = server name, title `"Newsletters"`). Render the list of drafts with `NewsletterFeed` (map each draft to `NewsletterFeedItem`). If the list is empty, render `EmptyState` with `icon={FileText}`, title "No newsletters yet", description about generating one, and an action that triggers generation or links to the server page.

- [ ] **Step 3: Build + lint**

Run (from `apps/web/`): `pnpm build && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Visual check**

Run `pnpm dev`, open a server's newsletters page. Expected: framed title, feed-style list, empty state when none.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/servers/\[id\]/newsletters/page.tsx
git commit -m "feat(web): restyle newsletters list page"
```

---

## Task 16: Restyle newsletter editor page

**Files:**
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/newsletters/[nid]/page.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat apps/web/app/\(app\)/dashboard/servers/\[id\]/newsletters/\[nid\]/page.tsx`
This is the largest page (editor, per-section rewrite, view-sources, publish dialog). Map its sections before editing.

- [ ] **Step 2: Restyle, not rewire**

Keep ALL editor logic, state, AI-rewrite handlers, publish dialog, and data calls exactly as-is. Only change presentational markup: add a `PageHeader` at the top (eyebrow = server name, title = newsletter subject, `action` = the publish button), wrap section blocks in `Card`/`CardContent`, and apply jira-clone spacing/typography (`text-ink-medium` for secondary text, divider headings via `SettingsCard` where a section grouping fits). Do not move logic between components.

- [ ] **Step 3: Build + lint**

Run (from `apps/web/`): `pnpm build && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Visual check**

Run `pnpm dev`, open a newsletter draft. Expected: editor still functions (section rewrite, view sources, preview tab, publish dialog all work); restyled chrome.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/servers/\[id\]/newsletters/\[nid\]/page.tsx
git commit -m "feat(web): restyle newsletter editor page"
```

---

## Task 17: Restyle integrations page

**Files:**
- Modify: `apps/web/app/(app)/dashboard/integrations/page.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat apps/web/app/\(app\)/dashboard/integrations/page.tsx`

- [ ] **Step 2: Restyle**

Keep data fetching and connect/disconnect handlers unchanged. Add a `PageHeader` (eyebrow `"Settings"`, title `"Integrations"`, description about connecting newsletter platforms). Group each platform (Ghost, Beehiiv, ConvertKit) into a `SettingsCard` section with its connect/disconnect controls as the section `action` or body.

- [ ] **Step 3: Build + lint**

Run (from `apps/web/`): `pnpm build && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Visual check**

Run `pnpm dev`, open `/dashboard/integrations`. Expected: framed title, each platform a divider-headed section.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/integrations/page.tsx
git commit -m "feat(web): restyle integrations page"
```

---

## Task 18: Restyle profile page

**Files:**
- Modify: `apps/web/app/(app)/dashboard/profile/profile-client.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat apps/web/app/\(app\)/dashboard/profile/profile-client.tsx`

- [ ] **Step 2: Restyle**

Keep all form state and submit handlers unchanged. Add a `PageHeader` (eyebrow `"Settings"`, title `"Profile"`). Group fields into `SettingsCard` sections (e.g. "Account", "Subscription"). Use `Card`/`CardContent` for grouped form blocks.

- [ ] **Step 3: Build + lint**

Run (from `apps/web/`): `pnpm build && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Visual check**

Run `pnpm dev`, open `/dashboard/profile`. Expected: framed title, divider-headed sections; form still saves.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/profile/profile-client.tsx
git commit -m "feat(web): restyle profile page"
```

---

## Task 19: Restyle admin page

**Files:**
- Modify: `apps/web/app/(app)/dashboard/admin/page.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat apps/web/app/\(app\)/dashboard/admin/page.tsx`

- [ ] **Step 2: Restyle**

Keep data fetching unchanged. Add a `PageHeader` (eyebrow `"Admin"`, title from the page's purpose). Render metrics/lists with `Card`/`CardContent` and jira-clone typography. If there are stat tiles, use a `grid gap-3 sm:grid-cols-3` of small cards.

- [ ] **Step 3: Build + lint**

Run (from `apps/web/`): `pnpm build && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/admin/page.tsx
git commit -m "feat(web): restyle admin page"
```

---

## Task 20: Restyle marketing landing page

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat apps/web/app/\(marketing\)/page.tsx`

- [ ] **Step 2: Restyle**

Keep all copy, links, and structure. Apply jira-clone's visual language: `font-black tracking-tight` headings, `text-ink-medium` body text, generous section spacing, `Card`/`shadow-card` for feature blocks, pill `Button`s. The hero CTA and primary buttons MUST use Distill's brand purple — use `variant="primary"` on `Button` (already brand-purple) or `bg-brand text-brand-foreground`. Do not introduce blue.

- [ ] **Step 3: Build + lint**

Run (from `apps/web/`): `pnpm build && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Visual check**

Run `pnpm dev`, open `/`. Expected: polished landing page, brand purple CTAs, jira-clone typography. Check light and dark mode.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat(web): restyle marketing landing page"
```

---

## Task 21: Restyle FAQ

**Files:**
- Modify: `apps/web/app/(marketing)/_components/faq.tsx`

- [ ] **Step 1: Read + restyle**

Run: `cat apps/web/app/\(marketing\)/_components/faq.tsx`. Keep all questions/answers and any accordion logic. Apply jira-clone styling: `border-ink-lighter` dividers, `font-semibold` questions, `text-ink-medium` answers, `rounded-card` containers.

- [ ] **Step 2: Build + lint + commit**

Run (from `apps/web/`): `pnpm build && pnpm lint` (expect both pass), then:
```bash
git add apps/web/app/\(marketing\)/_components/faq.tsx
git commit -m "feat(web): restyle marketing FAQ"
```

---

## Task 22: Final full-app verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run (from `apps/web/`): `rm -rf .next && pnpm build`
Expected: build succeeds with zero type errors.

- [ ] **Step 2: Lint**

Run (from `apps/web/`): `pnpm lint`
Expected: zero errors.

- [ ] **Step 3: Full visual sweep**

Run `pnpm dev` and visit each route, in light AND dark mode:
- `/` (landing), FAQ section
- `/dashboard` (servers dashboard — two-column, empty state)
- a server overview page
- a server's newsletters list
- a newsletter editor (verify section rewrite, view-sources, preview, publish dialog still work)
- `/dashboard/integrations`
- `/dashboard/profile`
- `/dashboard/admin`
- `⌘K` palette, `?` shortcuts dialog, nav popover, avatar dropdown, theme toggle, notification bell

Expected: every route renders with the FizzyHeader shell and jira-clone styling; brand purple is the CTA/link color; no console errors; no broken layouts.

- [ ] **Step 4: Confirm no jira-domain code leaked**

Run: `grep -rl -E "kanban|backlog|sprint|issueStatus" apps/web/components apps/web/app 2>/dev/null`
Expected: no output (Distill must contain no issue/kanban code).

- [ ] **Step 5: Final commit (if any cleanup was needed)**

```bash
git add -A apps/web
git commit -m "chore(web): final redesign cleanup and verification"
```
If nothing changed, skip.

---

## Self-Review Notes

- **Spec coverage:** Section 1 (style/ui) → Task 1. Section 2 (shell: header, palette, shortcuts, bell, theme toggle) → Tasks 2–6, 11–12. Section 3 (feature components) → Tasks 7–10 + restyle tasks. Section 4 (pages: app + marketing) → Tasks 13–21. Section 5 (risks) → addressed in Task 1 (ui diff not overwrite), Task 5 (cosmetic bell), Task 22 Step 4 (no jira-domain leak). Success criteria → Task 22.
- **Type consistency:** `HeaderServer` (Task 11) is the type consumed by `DashboardShell` and `FizzyHeader` (Task 12). `PaletteServer` (Task 6) and `HeaderServer` are structurally identical (`{id,name}`) — `DashboardShell` passes the same `servers` array to both, which is assignable. `NewsletterFeedItem` (Task 10) is reused unchanged in Tasks 13 and 15. `ServerCardData` (Task 9) is constructed in Task 13. `getShortcutsByCategory`/`formatShortcutParts`/`categoryOrder` (Task 3) are consumed in Task 4.
- **No placeholders:** all component code is given in full; restyle tasks (14–21) intentionally describe markup changes rather than dumping full files, because each depends on reading the current file first (Step 1 of each) and the logic must be preserved verbatim — the restyle is scoped to "wrap in PageHeader / group into SettingsCard / apply listed classes," which is concrete.
