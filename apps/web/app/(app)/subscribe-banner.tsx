"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubscribeBanner({
  subscriptionStatus,
}: {
  subscriptionStatus?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/billing/checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return; // keep the button in its loading state through navigation
      }
      setError(
        data.error ||
          "Couldn't start checkout. Please try again in a moment.",
      );
    } catch {
      setError("Couldn't reach the server. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-card border border-brand-warm/40 bg-brand-warm/10 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-warm" />
        <div>
          <p className="text-sm font-medium text-ink">
            {subscriptionStatus === "past_due"
              ? "Your payment is past due"
              : "You're on the free plan"}
          </p>
          <p className="text-xs text-ink-dark">
            {subscriptionStatus === "past_due"
              ? "Your payment is past due — update your billing to keep Pro features."
              : "1 generation per server, no publishing. Subscribe to unlock weekly generations and publishing to Beehiiv, ConvertKit, or Ghost."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1 md:items-end">
        <Button
          variant="primary"
          onClick={handleSubscribe}
          disabled={loading}
          size="sm"
        >
          {loading
            ? "Redirecting..."
            : subscriptionStatus === "past_due"
              ? "Update billing"
              : "Subscribe — $49/mo"}
        </Button>
        {error && (
          <p className="text-xs text-negative md:text-right">{error}</p>
        )}
      </div>
    </div>
  );
}
