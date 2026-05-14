"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Newsletter {
  id: string;
  status: string;
  created_at: string;
  draft_markdown: string;
  edited_markdown: string | null;
}

function extractTitle(nl: Newsletter): string {
  const md = nl.edited_markdown || nl.draft_markdown || "";
  const match = md.match(/^##\s+(.+)$/m);
  return match ? match[1] : "Untitled Newsletter";
}

interface Quota {
  used: number;
  limit: number;
  remaining: number;
  tier: string;
}

export default function NewslettersPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);

  const fetchNewsletters = () => {
    fetch(`/api/proxy/servers/${serverId}/newsletters`)
      .then((r) => r.json())
      .then((data) => {
        setNewsletters(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchNewsletters();
    fetch(`/api/proxy/servers/${serverId}/generation-quota`)
      .then((r) => r.json())
      .then((q) => setQuota(q))
      .catch(() => {});
  }, [serverId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/proxy/servers/${serverId}/generate-now`, { method: "POST" });
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = { error: "Unexpected response from server" };
    }
    setGenerating(false);
    if (res.ok && data.saved && data.id) {
      setQuota((prev) => prev ? { ...prev, used: prev.used + 1, remaining: prev.remaining - 1 } : prev);
      router.push(`/dashboard/servers/${serverId}/newsletters/${data.id}`);
    } else {
      setError(data.error || "Failed to generate. Please try again.");
    }
  };

  if (loading) {
    return <div className="text-ink-dark">Loading...</div>;
  }

  const quotaExhausted = quota && quota.remaining <= 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Newsletters</h2>
          {quota && (
            <p className="text-xs text-ink-medium mt-1">
              {quota.remaining}/{quota.limit} on-demand generations left this month ({quota.tier})
            </p>
          )}
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || !!quotaExhausted}
        >
          {generating ? "Generating..." : quotaExhausted ? "Limit reached" : "Generate now"}
        </Button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-negative bg-negative/10 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {newsletters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-ink-dark mb-4">
              No newsletters yet. Generate your first one!
            </p>
            <Button
              onClick={handleGenerate}
              disabled={generating || !!quotaExhausted}
            >
              {generating ? "Generating..." : "Generate now"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {newsletters.map((nl) => (
            <Card key={nl.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {extractTitle(nl)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(nl.created_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={nl.status === "published" ? "default" : "secondary"}
                  >
                    {nl.status}
                  </Badge>
                  <Link href={`/dashboard/servers/${serverId}/newsletters/${nl.id}`}>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
