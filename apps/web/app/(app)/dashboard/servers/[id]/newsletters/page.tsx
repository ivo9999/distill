"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/features/page-header";
import { NewsletterFeed } from "@/components/features/newsletter-feed";
import type { NewsletterFeedItem } from "@/components/features/newsletter-feed";
import { EmptyState } from "@/components/features/empty-state";

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

const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);

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

  const generateButton = (
    <Button
      onClick={handleGenerate}
      disabled={generating || !!quotaExhausted}
    >
      {generating
        ? "Generating..."
        : quotaExhausted
          ? quota?.tier === "free"
            ? "Subscribe to generate"
            : "Limit reached"
          : quota?.tier === "free"
            ? "Try free"
            : "Generate now"}
    </Button>
  );

  const feedItems: NewsletterFeedItem[] = newsletters.map((nl) => ({
    id: nl.id,
    serverId,
    serverName: "",
    title: extractTitle(nl),
    status: nl.status,
    updatedLabel: formatDistanceToNow(new Date(nl.created_at ?? ""), { addSuffix: true }),
  }));
  const totalPages = Math.ceil(feedItems.length / PAGE_SIZE);
  const pageItems = feedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader
        eyebrow="Server"
        title="Newsletters"
        description={
          quota
            ? quota.tier === "free"
              ? quota.remaining > 0
                ? "1 free generation available for this server"
                : "Free generation used — subscribe to keep going"
              : `${quota.remaining}/${quota.limit} on-demand generations left this month (${quota.tier})`
            : undefined
        }
        action={generateButton}
      />

      {error && (
        <p className="mb-4 text-sm text-negative bg-negative/10 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {newsletters.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No newsletters yet"
          description="Generate a newsletter draft from this server's recent Discord activity."
          actionLabel="Generate now"
          onAction={handleGenerate}
          actionDisabled={generating || !!quotaExhausted}
        />
      ) : (
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
      )}
    </div>
  );
}
