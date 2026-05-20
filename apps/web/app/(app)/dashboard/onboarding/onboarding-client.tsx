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

interface DiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
}

interface Server {
  id: string;
  name: string;
  discord_guild_id: string;
}

export function OnboardingClient({ discordBotUrl }: { discordBotUrl: string }) {
  const [step, setStep] = useState(1);
  const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [savingChannels, setSavingChannels] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  // Bot guilds that don't yet have a server record. When >1, step 2
  // shows a picker before the channel list; when exactly 1 it's
  // auto-selected. Empty once a server is chosen.
  const [guildCandidates, setGuildCandidates] = useState<DiscordGuild[]>([]);
  // Existing servers captured at handleBotAdded time, consumed by the
  // picker's onClick so selectGuild can dedupe without a refetch.
  const [pickServers, setPickServers] = useState<Server[]>([]);
  // Non-null when step 2 failed (no bot guild, or server creation
  // errored) — drives the fallback card's message.
  const [setupError, setSetupError] = useState<string | null>(null);

  // Resolve a guild into a server record (reuse an existing one for that
  // guild, else create it), then load that server's Discord channels.
  const selectGuild = async (guild: DiscordGuild, existing: Server[]) => {
    setLoadingChannels(true);
    setGuildCandidates([]);
    setSetupError(null);
    let server = existing.find((s) => s.discord_guild_id === guild.id) ?? null;
    if (!server) {
      const iconUrl = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
        : undefined;
      const createRes = await fetch("/api/proxy/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guild.name,
          discord_guild_id: guild.id,
          ...(iconUrl ? { icon_url: iconUrl } : {}),
        }),
      });
      if (createRes.ok) {
        server = await createRes.json();
      } else {
        setSetupError(
          `Couldn't add "${guild.name}". Please try again in a moment.`,
        );
      }
    }
    if (server) {
      setSelectedServer(server);
      setSelectedChannels(new Set());
      const chRes = await fetch(
        `/api/proxy/discord/guilds/${server.discord_guild_id}/channels`,
      );
      if (chRes.ok) {
        setDiscordChannels(await chRes.json());
      } else {
        setDiscordChannels([]);
      }
    }
    setLoadingChannels(false);
  };

  const handleBotAdded = async () => {
    setLoadingChannels(true);
    setSelectedServer(null);
    setGuildCandidates([]);
    setSetupError(null);
    setStep(2);

    // 1. Guilds the bot is in.
    let botGuilds: unknown;
    try {
      const botGuildsRes = await fetch("/api/proxy/discord/bot-guilds");
      botGuilds = await botGuildsRes.json();
    } catch {
      botGuilds = null;
    }
    if (!Array.isArray(botGuilds) || botGuilds.length === 0) {
      // No guilds, or the lookup failed. The empty-state card renders.
      setLoadingChannels(false);
      return;
    }

    // 2. Existing server records. A FAILED fetch must NOT be treated as
    //    "zero servers" — that would make every bot guild look
    //    unconfigured and surface already-set-up servers in the picker.
    //    Abort with an error instead.
    let servers: Server[];
    try {
      const serversRes = await fetch("/api/proxy/servers");
      const serversRaw = await serversRes.json();
      if (!serversRes.ok || !Array.isArray(serversRaw)) {
        throw new Error("bad response");
      }
      servers = serversRaw;
    } catch {
      setSetupError(
        "Couldn't load your existing servers. Please try again in a moment.",
      );
      setLoadingChannels(false);
      return;
    }

    // 3. Prefer guilds that aren't set up yet — that's the one the user
    //    just added. If every bot guild already has a server, fall back
    //    to letting them pick from all bot guilds (re-configure flow).
    const configuredGuildIds = new Set(servers.map((s) => s.discord_guild_id));
    const unconfigured = botGuilds.filter(
      (g: DiscordGuild) => !configuredGuildIds.has(g.id),
    );
    const choices: DiscordGuild[] =
      unconfigured.length > 0 ? unconfigured : botGuilds;

    if (choices.length === 1) {
      await selectGuild(choices[0], servers);
    } else {
      // Multiple candidates — show the picker. Stash the existing
      // servers so the picker's onClick can dedupe without a refetch.
      setPickServers(servers);
      setGuildCandidates(choices);
      setLoadingChannels(false);
    }
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
        {[1, 2, 3, 4].map((s) => {
          // Three states, each needs to read in both light + dark mode:
          //   past    — green-filled circle with a check
          //   current — brand-filled circle with the step number,
          //             slightly larger so it draws the eye
          //   future  — bordered transparent circle (the previous
          //             bg-ink-lightest fill disappeared into canvas
          //             on dark mode and into near-white in light)
          const isPast = s < step;
          const isCurrent = s === step;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isPast && "bg-positive text-ink-inverted",
                  isCurrent && "bg-brand text-brand-foreground ring-2 ring-brand/30",
                  !isPast && !isCurrent && "border border-ink-light text-ink-medium",
                )}
              >
                {isPast ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={cn(
                    "h-0.5 w-12 transition-colors",
                    isPast ? "bg-positive" : "bg-ink-lighter",
                  )}
                />
              )}
            </div>
          );
        })}
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
            <a href={discordBotUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg">Add Distill Bot to Discord</Button>
            </a>
            <Button variant="outline" onClick={handleBotAdded}>
              I&apos;ve added the bot
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Pick a server (when the bot is in several) then its
          channels. The picker shows only when there's an ambiguous set
          of candidate guilds and none is selected yet. */}
      {step === 2 && guildCandidates.length > 0 && !selectedServer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Choose a server</CardTitle>
            <CardDescription>
              The Distill bot is in more than one Discord server. Pick the
              one you want to set up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 rounded-card border border-ink-lighter p-2">
              {guildCandidates.map((guild) => (
                <button
                  key={guild.id}
                  onClick={() => selectGuild(guild, pickServers)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-ink-lightest"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-card bg-brand text-sm font-bold text-brand-foreground">
                    {guild.name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="text-sm font-medium">{guild.name}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: no guilds found at all — the bot isn't in any server. */}
      {step === 2 &&
        !loadingChannels &&
        !selectedServer &&
        guildCandidates.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {setupError ? "Something went wrong" : "No server found"}
              </CardTitle>
              <CardDescription>
                {setupError ??
                  "We couldn't find a Discord server with the Distill bot. Add the bot to a server, then try again."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleBotAdded}>Retry</Button>
            </CardContent>
          </Card>
        )}

      {/* Step 2: Pick channels — shown once a server is resolved (or
          while channels load for it). */}
      {step === 2 && (selectedServer !== null || loadingChannels) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Pick channels to monitor
            </CardTitle>
            <CardDescription>
              {selectedServer
                ? `Select the channels Distill should read in ${selectedServer.name}.`
                : "Select the Discord channels you want Distill to read."}
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
