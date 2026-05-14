"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubscribeBanner() {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    const res = await fetch("/api/proxy/billing/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
    setLoading(false);
  };

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-card border border-accent-2/40 bg-accent-2/10 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-medium text-ink">
            You're on the free plan
          </p>
          <p className="text-xs text-ink-dark">
            1 generation per server, no publishing. Subscribe to unlock weekly
            generations and publishing to Beehiiv, ConvertKit, or Ghost.
          </p>
        </div>
      </div>
      <Button
        onClick={handleSubscribe}
        disabled={loading}
        size="sm"
        className="shrink-0"
      >
        {loading ? "Redirecting..." : "Subscribe — $49/mo"}
      </Button>
    </div>
  );
}
