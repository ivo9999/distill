"use client";

import { useState, useEffect } from "react";
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

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [channels, setChannels] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [selectedServer, setSelectedServer] = useState<any>(null);
  const [savingChannels, setSavingChannels] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);

  const handleBotAdded = async () => {
    const res = await fetch("/api/proxy/servers");
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      setSelectedServer(data[0]);
    }
    setStep(2);
  };

  const handleChannelsContinue = async () => {
    if (!selectedServer || !channels.trim()) {
      setStep(3);
      return;
    }
    setSavingChannels(true);
    const channelNames = channels.split(",").map((c) => c.trim()).filter(Boolean);
    for (const name of channelNames) {
      await fetch(`/api/proxy/servers/${selectedServer.id}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-gray-950 text-white"
                  : s < step
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {s < step ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                s
              )}
            </div>
            {s < 4 && (
              <div
                className={`w-12 h-0.5 ${
                  s < step ? "bg-green-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-500 text-center mb-6">
        Step {step} of 4
      </p>

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
              Enter the Discord channel names you want Distill to read.
              Separate multiple channels with commas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channels">Channel names</Label>
              <Input
                id="channels"
                placeholder="general, dev-talk, announcements"
                value={channels}
                onChange={(e) => setChannels(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Don&apos;t include the # symbol. We&apos;ll match these to your
                server channels.
              </p>
            </div>
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
                      selectedPlatform === platform.id ? null : platform.id
                    )
                  }
                  className={`text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedPlatform === platform.id
                      ? "border-gray-950 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold">{platform.name}</div>
                  <div className="text-sm text-gray-500">
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
