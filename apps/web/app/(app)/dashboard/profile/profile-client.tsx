"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/features/page-header";
import { SettingsCard } from "@/components/features/settings-card";

interface Server {
  id: string;
  name: string;
  status: string;
  schedule_cron: string;
}

interface ProfileClientProps {
  name: string;
  email: string;
  avatar: string | null;
  subscriptionStatus: string;
}

export function ProfileClient({ name, email, avatar, subscriptionStatus }: ProfileClientProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  useEffect(() => {
    fetch("/api/proxy/servers")
      .then((r) => r.json())
      .then((data) => {
        setServers(Array.isArray(data) ? data : []);
        setLoadingServers(false);
      })
      .catch(() => setLoadingServers(false));
  }, []);

  const [portalError, setPortalError] = useState<string | null>(null);

  const handleManageBilling = async () => {
    setLoadingPortal(true);
    setPortalError(null);
    const res = await fetch("/api/proxy/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setPortalError(data.error || "Unable to open billing portal.");
    }
    setLoadingPortal(false);
  };

  const handleSubscribe = async () => {
    setLoadingCheckout(true);
    const res = await fetch("/api/proxy/billing/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
    setLoadingCheckout(false);
  };

  const isActive = subscriptionStatus === "active";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Settings" title="Profile" />

      <SettingsCard title="Account" description="Your Discord account details">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img src={avatar} alt={name} className="h-16 w-16 rounded-full" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-lightest text-xl font-bold text-ink-dark">
              {name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold">{name}</p>
            <p className="text-sm text-ink-medium">{email}</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Subscription"
        description={
          isActive
            ? "Your subscription is active. You have full access to Distill."
            : "Subscribe to start generating newsletters from your Discord."
        }
        action={
          <Badge variant={isActive ? "default" : "secondary"}>
            {subscriptionStatus}
          </Badge>
        }
      >
        <div className="space-y-2">
          {isActive ? (
            <>
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={loadingPortal}
              >
                {loadingPortal ? "Loading..." : "Manage subscription"}
              </Button>
              {portalError && (
                <p className="text-xs text-negative">{portalError}</p>
              )}
            </>
          ) : (
            <Button onClick={handleSubscribe} disabled={loadingCheckout}>
              {loadingCheckout ? "Redirecting..." : "Subscribe now"}
            </Button>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Your Servers" description="Discord servers connected to Distill">
        {loadingServers ? (
          <p className="text-sm text-ink-medium">Loading...</p>
        ) : servers.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-ink-medium mb-3">No servers connected yet</p>
            <Link href="/dashboard/onboarding">
              <Button variant="outline" size="sm">Connect a server</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{server.name}</span>
                  <Badge
                    variant={server.status === "active" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {server.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/servers/${server.id}`}>
                    <Button variant="outline" size="sm">Settings</Button>
                  </Link>
                  <Link href={`/dashboard/servers/${server.id}/newsletters`}>
                    <Button variant="outline" size="sm">Newsletters</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Danger Zone">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sign out</p>
            <p className="text-xs text-ink-medium">Sign out of your Distill account</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = "/api/auth/signout"; }}
          >
            Sign out
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
