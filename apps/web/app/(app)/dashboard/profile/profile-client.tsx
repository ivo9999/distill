"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/proxy/me", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.deleted) {
        // Account is gone — drop the session and leave.
        setDeleteOpen(false);
        window.location.href = "/api/auth/signout";
        return;
      }
      setDeleteError(data.error || "Failed to delete account. Please try again.");
    } catch {
      setDeleteError("Couldn't reach the server. Please try again.");
    }
    setDeleting(false);
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
        <div className="divide-y divide-ink-lighter">
          <div className="flex items-center justify-between pb-3">
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

          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-sm font-medium text-negative">Delete account</p>
              <p className="text-xs text-ink-medium">
                Permanently delete your account, servers, and newsletters. This
                cannot be undone.
              </p>
            </div>
            <Dialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) {
                  setDeleteConfirm("");
                  setDeleteError(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    This permanently deletes your account and every connected
                    Discord server, channel, and newsletter draft. Any active
                    subscription is cancelled. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <p className="text-sm text-ink-medium">
                    Type <span className="font-mono font-bold text-ink">delete</span> to confirm.
                  </p>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="delete"
                    autoComplete="off"
                  />
                  {deleteError && (
                    <p className="text-xs text-negative">{deleteError}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirm !== "delete"}
                  >
                    {deleting ? "Deleting..." : "Delete account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
