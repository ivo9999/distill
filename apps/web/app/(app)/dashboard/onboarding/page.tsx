"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const DISCORD_BOT_URL = `https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=274877925376&scope=bot+applications.commands`;

const platforms = [
  {
    id: "beehiiv",
    name: "Beehiiv",
    description: "Modern newsletter platform with growth tools.",
  },
  {
    id: "convertkit",
    name: "ConvertKit",
    description: "Email marketing for creators.",
  },
  {
    id: "ghost",
    name: "Ghost",
    description: "Open-source publishing platform.",
  },
];

interface DiscordChannel {
  id: string;
  name: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [selectedServer, setSelectedServer] = useState<any>(null);
  const [savingChannels, setSavingChannels] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);

  const handleBotAdded = async () => {
    setLoadingChannels(true);
    setStep(2);

    // 1. Get guilds the bot is in
    const botGuildsRes = await fetch("/api/proxy/discord/bot-guilds");
    const botGuilds = await botGuildsRes.json();
    if (!Array.isArray(botGuilds) || botGuilds.length === 0) {
      setLoadingChannels(false);
      return;
    }

    // 2. Check if we already have a server record, if not create one
    const serversRes = await fetch("/api/proxy/servers");
    const servers = await serversRes.json();
    let server = Array.isArray(servers)
      ? servers.find((s: any) => botGuilds.some((g: any) => g.id === s.discord_guild_id))
      : null;

    if (!server) {
      // Auto-create server from the first bot guild
      const guild = botGuilds[0];
      const createRes = await fetch("/api/proxy/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guild.name,
          discord_guild_id: guild.id,
        }),
      });
      if (createRes.ok) {
        server = await createRes.json();
      }
    }

    if (server) {
      setSelectedServer(server);
      // 3. Fetch channels from Discord
      const chRes = await fetch(
        `/api/proxy/discord/guilds/${server.discord_guild_id}/channels`,
      );
      if (chRes.ok) {
        const channels = await chRes.json();
        setDiscordChannels(channels);
      }
    }
    setLoadingChannels(false);
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  const handleChannelsContinue = async () => {
    if (!selectedServer || selectedChannels.size === 0) {
      setStep(3);
      return;
    }
    setSavingChannels(true);
    const channelsToSave = discordChannels.filter((ch) =>
      selectedChannels.has(ch.id),
    );
    for (const ch of channelsToSave) {
      await fetch(`/api/proxy/servers/${selectedServer.id}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_channel_id: ch.id, name: ch.name }),
      });
    }
    setSavingChannels(false);
    setStep(3);
  };

  const handleIntegrationContinue = async () => {
    if (!selectedPlatform || !apiKey || !publicationId) {
      setStep(4);
      return;
    }
    setSavingIntegration(true);
    await fetch(`/api/proxy/integrations/${selectedPlatform}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, publication_id: publicationId }),
    });
    setSavingIntegration(false);
    setStep(4);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                s === step
                  ? "bg-ink text-ink-inverted"
                  : s < step
                    ? "bg-positive text-ink-inverted"
                    : "bg-ink-lightest text-ink-medium",
              )}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={cn(
                  "h-0.5 w-12",
                  s < step ? "bg-positive" : "bg-ink-lighter",
                )}
              />
            )}
          </div>
        ))}
      </div>

      <p className="mb-6 text-center text-sm text-ink-medium">Step {step} of 4</p>

      {/* Step 1: Add bot */}
      {step === 1 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              Add Distill to your Discord server
            </CardTitle>
            <CardDescription>
              Click the button below to invite the Distill bot to your Discord
              server. You&apos;ll need the &quot;Manage Server&quot; permission.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <a href={DISCORD_BOT_URL} target="_blank" rel="noopener noreferrer">
              <Button size="lg">Add Distill Bot to Discord</Button>
            </a>
            <Button variant="outline" onClick={handleBotAdded}>
              I&apos;ve added the bot
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Pick channels */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Pick channels to monitor
            </CardTitle>
            <CardDescription>
              Select the Discord channels you want Distill to read.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingChannels ? (
              <p className="text-sm text-ink-medium">Loading channels...</p>
            ) : discordChannels.length > 0 ? (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-card border border-ink-lighter p-2">
                {discordChannels.map((ch) => (
                  <label
                    key={ch.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors",
                      selectedChannels.has(ch.id)
                        ? "bg-ink-lightest"
                        : "hover:bg-ink-lightest/50",
                    )}
                  >
                    <Checkbox
                      checked={selectedChannels.has(ch.id)}
                      onCheckedChange={() => toggleChannel(ch.id)}
                    />
                    <span className="text-sm text-ink-medium">#</span>
                    <span className="text-sm font-medium">{ch.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-medium">
                No channels found. Make sure the bot has been added to your
                server.
              </p>
            )}
            {selectedChannels.size > 0 && (
              <p className="text-xs text-ink-medium">
                {selectedChannels.size} channel
                {selectedChannels.size !== 1 ? "s" : ""} selected
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleChannelsContinue} disabled={savingChannels}>
                {savingChannels ? "Saving..." : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Connect newsletter platform */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Connect your newsletter platform
            </CardTitle>
            <CardDescription>
              Choose a platform and enter your API credentials. You can also skip
              this and set it up later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() =>
                    setSelectedPlatform(
                      selectedPlatform === platform.id ? null : platform.id,
                    )
                  }
                  className={cn(
                    "rounded-card border-2 p-4 text-left transition-colors",
                    selectedPlatform === platform.id
                      ? "border-ink bg-ink-lightest"
                      : "border-ink-lighter hover:border-ink-light",
                  )}
                >
                  <div className="font-semibold">{platform.name}</div>
                  <div className="text-sm text-ink-dark">
                    {platform.description}
                  </div>
                </button>
              ))}
            </div>

            {selectedPlatform && (
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pub-id">Publication ID</Label>
                  <Input
                    id="pub-id"
                    placeholder="Enter your publication ID"
                    value={publicationId}
                    onChange={(e) => setPublicationId(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)}>
                  Skip for now
                </Button>
                <Button
                  onClick={handleIntegrationContinue}
                  disabled={
                    savingIntegration ||
                    (selectedPlatform !== null && (!apiKey || !publicationId))
                  }
                >
                  {savingIntegration ? "Saving..." : "Continue"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: All set */}
      {step === 4 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">You&apos;re all set!</CardTitle>
            <CardDescription>
              Distill will start monitoring your Discord channels and deliver
              your first newsletter draft on Sunday.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/dashboard">
              <Button size="lg">Go to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
