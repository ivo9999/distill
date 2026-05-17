"use client";

import Link from "next/link";
import {
  AlertCircle,
  Clock,
  Coffee,
  CreditCard,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// GenerationError — surfaces a failed generate-now response in a way
// that's actually useful to the user. The /api/proxy/.../generate-now
// route already classifies failures into one of five categories; this
// component renders the right icon, message, and recovery action for
// each. Without this, every failure looked identical (red banner, same
// text) and the user couldn't tell "wait an hour" from "your week was
// quiet, that's fine" from "subscribe to keep going" — which is the
// difference between churn and patience.
export type GenerationErrorCategory =
  | "thin_week"
  | "timeout"
  | "rate_limit"
  | "quota"
  | "internal";

export interface GenerationErrorState {
  message: string;
  category?: GenerationErrorCategory;
  // Subscribe CTA target. Free-tier users see /dashboard?subscribe=1; paid
  // users hitting monthly limits see /dashboard/billing (no path yet, so
  // we fall back to the subscribe banner).
  tier?: string;
  serverId?: string;
}

interface Props {
  error: GenerationErrorState;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function GenerationError({ error, onRetry, onDismiss }: Props) {
  const cat = error.category ?? "internal";
  const meta = CATEGORY_META[cat];

  return (
    <div
      className={`mt-4 flex items-start gap-3 rounded-card border px-4 py-3 ${meta.toneClass}`}
      role="alert"
    >
      <meta.Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 space-y-2">
        <div>
          <p className="text-sm font-medium">{meta.title}</p>
          <p className="mt-0.5 text-sm opacity-90">{error.message}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cat === "thin_week" && error.serverId && (
            <Link href={`/dashboard/servers/${error.serverId}`}>
              <Button size="sm" variant="outline">
                Add more channels
              </Button>
            </Link>
          )}

          {(cat === "timeout" || cat === "internal") && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try again
            </Button>
          )}

          {cat === "quota" && (
            <Link href="/dashboard?subscribe=1">
              <Button size="sm" variant="primary">
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                {error.tier === "free" ? "Subscribe" : "Upgrade plan"}
              </Button>
            </Link>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="opacity-80 hover:opacity-100"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

// CATEGORY_META — visual + copy for each failure category. Kept inline
// since the variants are small and tightly coupled to the component.
const CATEGORY_META: Record<
  GenerationErrorCategory,
  {
    Icon: typeof AlertCircle;
    title: string;
    toneClass: string;
  }
> = {
  // Quiet week — model honestly found nothing. We frame this as a
  // feature ("we don't pad") not a failure, because that's the
  // marketing promise. The CTA points at adding more channels, since
  // that's the only real fix.
  thin_week: {
    Icon: Coffee,
    title: "This week was quiet",
    toneClass:
      "border-ink-lighter bg-ink-lightest/40 text-ink-dark dark:bg-ink-lightest/10",
  },
  // Transient timeout — retry usually clears it. No catastrophizing
  // copy; this should feel like a hiccup not a system failure.
  timeout: {
    Icon: Clock,
    title: "Generation timed out",
    toneClass: "border-warning/30 bg-warning/10 text-ink-dark",
  },
  // Rate-limited by the model provider. The user can't do anything
  // except wait, so retry is hidden — the only honest CTA is dismiss.
  rate_limit: {
    Icon: Clock,
    title: "Model is rate-limited",
    toneClass: "border-warning/30 bg-warning/10 text-ink-dark",
  },
  // Paid feature exhausted. Different copy for free vs paid users —
  // free → "subscribe", paid → "you'll get more next month."
  quota: {
    Icon: CreditCard,
    title: "Generation limit reached",
    toneClass: "border-brand/30 bg-brand-soft text-ink-dark",
  },
  // Catch-all. Red so the user knows it's not the same as the others;
  // retry surfaced because retries do sometimes work after a deploy.
  internal: {
    Icon: AlertCircle,
    title: "Generation failed",
    toneClass: "border-negative/30 bg-negative/10 text-negative",
  },
};
