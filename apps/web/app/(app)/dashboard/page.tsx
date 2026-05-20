"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Server as ServerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/features/page-header";
import { NewsletterFeed, type NewsletterFeedItem } from "@/components/features/newsletter-feed";
import { ServerCard } from "@/components/features/server-card";
import { EmptyState } from "@/components/features/empty-state";

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

type DraftWithDate = NewsletterFeedItem & { _ts: number };

export default function DashboardPage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotas, setQuotas] = useState<Record<string, Quota>>({});
  const [drafts, setDrafts] = useState<DraftWithDate[]>([]);

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
        s.forEach((server: Server) => {
          fetch(`/api/proxy/servers/${server.id}/newsletters`)
            .then((r) => r.json())
            .then((newsletters) => {
              if (!Array.isArray(newsletters)) return;
              const items: DraftWithDate[] = newsletters
                .slice(0, 3)
                .map((n: { id: string; subject?: string | null; status: string; updated_at?: string; created_at?: string }) => {
                  const dateStr = n.updated_at ?? n.created_at ?? new Date(0).toISOString();
                  const ts = Date.parse(dateStr);
                  return {
                    id: n.id,
                    serverId: server.id,
                    serverName: server.name,
                    title: n.subject ?? "Untitled draft",
                    status: n.status,
                    updatedLabel: formatDistanceToNow(new Date(dateStr), { addSuffix: true }),
                    _ts: isNaN(ts) ? 0 : ts,
                  };
                });
              setDrafts((prev) => {
                const map = new Map<string, DraftWithDate>();
                for (const item of [...prev, ...items]) {
                  const existing = map.get(item.id);
                  if (!existing || item._ts > existing._ts) map.set(item.id, item);
                }
                const deduped = Array.from(map.values());
                return deduped.sort((a, b) => b._ts - a._ts).slice(0, 8);
              });
            })
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
      <EmptyState
        icon={ServerIcon}
        title="Welcome to Distill"
        description="Connect your first Discord server to get started. Your first generation is free."
        actionLabel="Set up your first server"
        onAction={() => router.push("/dashboard/onboarding")}
      />
    );
  }

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
          <NewsletterFeed items={drafts.map(({ _ts: _ignored, ...rest }) => rest)} />
        </section>
        <aside>
          <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-ink-medium">
            Servers
          </h2>
          <div className="flex flex-col gap-3">
            {servers.map((server) => {
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
    </div>
  );
}
