"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, ArrowRight, Sparkles, Settings as SettingsIcon, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  GenerationError,
  type GenerationErrorState,
} from "@/components/generation-error";

function humanCron(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const hour = parseInt(parts[1], 10);
  const dow = parts[4];
  const dayNames: Record<string, string> = {
    "0": "Sunday",
    "1": "Monday",
    "2": "Tuesday",
    "3": "Wednesday",
    "4": "Thursday",
    "5": "Friday",
    "6": "Saturday",
    "*": "day",
  };
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const time = `${h}:00 ${ampm} UTC`;
  if (dow === "*") return `Every day at ${time}`;
  const days = dow.split(",").map((d) => dayNames[d] || d).join(", ");
  return `Every ${days} at ${time}`;
}

interface Server {
  id: string;
  name: string;
  discord_guild_id: string;
  status: string;
  schedule_cron: string;
  community_type: string | null;
}

interface Quota {
  used: number;
  limit: number;
  remaining: number;
  tier: string;
}

// Per-server avatar colour rotation. The first server a user adds gets the
// brand purple so their primary workspace reads as on-brand; the second
// gets Discord-blue (signalling the bot connection), then the reserved
// accent triad. Beyond six servers the rotation wraps — distinct enough
// to tell adjacent cards apart.
const accentByIndex = [
  "bg-brand",
  "bg-brand-discord",
  "bg-brand-warm",
  "bg-brand-bright",
  "bg-brand-hot",
  "bg-accent-5",
];

export default function DashboardPage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<
    (GenerationErrorState & { id: string }) | null
  >(null);
  const [quotas, setQuotas] = useState<Record<string, Quota>>({});

  useEffect(() => {
    fetch("/api/proxy/servers")
      .then((r) => r.json())
      .then((data) => {
        const s = Array.isArray(data) ? data : [];
        setServers(s);
        setLoading(false);
        s.forEach((server: Server) => {
          fetch(`/api/proxy/servers/${server.id}/generation-quota`)
            .then((r) => r.json())
            .then((q) => setQuotas((prev) => ({ ...prev, [server.id]: q })))
            .catch(() => {});
        });
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-brand-soft text-brand">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Welcome to Distill</h2>
            <p className="text-sm text-ink-dark">
              Connect your first Discord server to get started. Your first
              generation is free.
            </p>
          </div>
          <Link href="/dashboard/onboarding">
            <Button variant="primary" size="lg" className="rounded-pill">
              Set up your first server
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const handleGenerate = async (serverId: string) => {
    setGeneratingId(serverId);
    setGenerateError(null);
    let data: {
      saved?: boolean;
      id?: string;
      error?: string;
      tier?: string;
      category?: GenerationErrorState["category"];
    } = {};
    try {
      const res = await fetch(`/api/proxy/servers/${serverId}/generate-now`, {
        method: "POST",
      });
      try {
        data = await res.json();
      } catch {
        data = { error: "Unexpected response from server", category: "internal" };
      }
      if (res.ok && data.saved && data.id) {
        setGeneratingId(null);
        setQuotas((prev) => {
          const q = prev[serverId];
          if (q)
            return {
              ...prev,
              [serverId]: { ...q, used: q.used + 1, remaining: q.remaining - 1 },
            };
          return prev;
        });
        router.push(`/dashboard/servers/${serverId}/newsletters/${data.id}`);
        return;
      }
    } catch {
      data = {
        error: "Couldn't reach the generation service. Check your connection and try again.",
        category: "internal",
      };
    }
    setGeneratingId(null);
    setGenerateError({
      id: serverId,
      message: data.error || "Failed to generate. Please try again.",
      category: data.category,
      tier: data.tier,
      serverId,
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your servers</h1>
          <p className="mt-1 text-sm text-ink-dark">
            Generate weekly newsletter drafts from your Discord communities.
          </p>
        </div>
        <Link href="/dashboard/onboarding">
          <Button variant="outline" size="sm">
            Add another server
          </Button>
        </Link>
      </div>

      <div className="grid gap-3">
        {servers.map((server, i) => {
          const quota = quotas[server.id];
          const isGenerating = generatingId === server.id;
          const exhausted = quota && quota.remaining <= 0;
          const isFree = quota?.tier === "free";
          const accent = accentByIndex[i % accentByIndex.length];

          return (
            <Card key={server.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-sm font-bold text-ink-inverted",
                      accent,
                    )}
                  >
                    {server.name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{server.name}</h3>
                      <Badge variant={server.status === "active" ? "default" : "secondary"}>
                        {server.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-dark">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {humanCron(server.schedule_cron)}
                      </span>
                      {quota && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5",
                            isFree
                              ? exhausted
                                ? "border-warning/40 text-warning"
                                : "border-positive/40 text-positive"
                              : "border-ink-lighter",
                          )}
                        >
                          {isFree
                            ? exhausted
                              ? "Free generation used"
                              : "1 free generation available"
                            : `${quota.remaining}/${quota.limit} on-demand`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate(server.id)}
                    disabled={isGenerating || exhausted}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Generating
                      </>
                    ) : exhausted ? (
                      isFree ? "Subscribe to generate" : "Limit reached"
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        {isFree ? "Try free" : "Generate now"}
                      </>
                    )}
                  </Button>
                  <Link href={`/dashboard/servers/${server.id}/newsletters`}>
                    <Button variant="ghost" size="sm">
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      Drafts
                    </Button>
                  </Link>
                  <Link href={`/dashboard/servers/${server.id}`}>
                    <Button variant="ghost" size="sm">
                      <SettingsIcon className="mr-1.5 h-3.5 w-3.5" />
                      Settings
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
}
