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
