"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/features/page-header";
import { SettingsCard } from "@/components/features/settings-card";
import { NewsletterFeed } from "@/components/features/newsletter-feed";
import type { NewsletterFeedItem } from "@/components/features/newsletter-feed";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

const dayOptions = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

const hourOptions = [
  { label: "6am UTC", value: "6" },
  { label: "9am UTC", value: "9" },
  { label: "12pm UTC", value: "12" },
  { label: "3pm UTC", value: "15" },
  { label: "6pm UTC", value: "18" },
];

function parseCron(cron: string): { day: string; hour: string } {
  const parts = cron.split(" ");
  if (parts.length !== 5) return { day: "0", hour: "18" };
  return { day: parts[4], hour: parts[1] };
}

function buildCron(day: string, hour: string): string {
  return `0 ${hour} * * ${day}`;
}

interface Channel {
  id: string;
  name: string;
  discord_channel_id: string;
  weight?: number;
}

interface Newsletter {
  id: string;
  status: string;
  created_at: string;
  draft_markdown: string;
  edited_markdown: string | null;
}

// Title for a newsletter draft — first ## heading of the (edited or
// raw) markdown. Mirrors the newsletters list page's extractTitle so
// both views label drafts identically.
function extractTitle(nl: Newsletter): string {
  const md = nl.edited_markdown || nl.draft_markdown || "";
  const match = md.match(/^##\s+(.+)$/m);
  return match ? match[1] : "Untitled Newsletter";
}

// Three weight presets the UI exposes. The API accepts any value in
// [0.1, 5.0], but presets keep the dashboard a 3-way decision rather
// than a knob. Choices were tuned to be obviously different at Pass1
// rank-time without being so extreme that a single "high-signal"
// channel drowns out everything else.
const WEIGHT_PRESETS = [
  { value: "0.5", label: "Low signal", description: "Background noise — only exceptional moments surface" },
  { value: "1.0", label: "Normal", description: "Default — included on merit" },
  { value: "2.0", label: "High signal", description: "Stories from here float to the top" },
] as const;

// Closest-preset lookup: rows from the DB may carry historical values
// (1.5, 0.75) that don't snap to the three presets. We display them as
// the nearest preset so the select stays usable; saving snaps to the
// preset value, which is fine since we don't expose finer control.
function weightToPreset(w: number | undefined): string {
  const target = typeof w === "number" && w > 0 ? w : 1.0;
  let best: string = WEIGHT_PRESETS[1].value;
  let bestDiff = Math.abs(parseFloat(WEIGHT_PRESETS[1].value) - target);
  for (const p of WEIGHT_PRESETS) {
    const diff = Math.abs(parseFloat(p.value) - target);
    if (diff < bestDiff) {
      best = p.value;
      bestDiff = diff;
    }
  }
  return best;
}

export default function ServerSettingsPage() {
  const params = useParams();
  const serverId = params.id as string;

  const [serverName, setServerName] = useState("");
  const [guildId, setGuildId] = useState("");
  const [communityType, setCommunityType] = useState("");
  const [voiceSample, setVoiceSample] = useState("");
  const [scheduleDay, setScheduleDay] = useState("0");
  const [scheduleHour, setScheduleHour] = useState("18");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [discordChannels, setDiscordChannels] = useState<{ id: string; name: string }[]>([]);
  const [addingChannel, setAddingChannel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [newslettersLoading, setNewslettersLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [serverRes, channelsRes] = await Promise.all([
          fetch(`/api/proxy/servers/${serverId}`),
          fetch(`/api/proxy/servers/${serverId}/channels`),
        ]);
        const server = await serverRes.json();
        const chs = await channelsRes.json();
        setServerName(server.name || "");
        setGuildId(server.discord_guild_id || "");
        setCommunityType(server.community_type || "");
        setVoiceSample(server.voice_sample || "");
        const { day, hour } = parseCron(server.schedule_cron || "0 18 * * 0");
        setScheduleDay(day);
        setScheduleHour(hour);
        setChannels(Array.isArray(chs) ? chs : []);
      } catch {
        // ignore
      }
      setLoading(false);
    };
    loadData();

    // Recent newsletters for the "Newsletters" section. A failed fetch
    // falls back to an empty list — non-fatal, the rest of the page
    // still works.
    fetch(`/api/proxy/servers/${serverId}/newsletters`)
      .then((r) => r.json())
      .then((data) => {
        setNewsletters(Array.isArray(data) ? data : []);
        setNewslettersLoading(false);
      })
      .catch(() => setNewslettersLoading(false));
  }, [serverId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/proxy/servers/${serverId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        community_type: communityType,
        schedule_cron: buildCron(scheduleDay, scheduleHour),
        // Send "" to explicitly clear the field; the server sentinel
        // translates that to SQL NULL. Always sending (even when
        // unchanged) is cheap and avoids tracking dirty state.
        voice_sample: voiceSample,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const loadDiscordChannels = async () => {
    if (!guildId || discordChannels.length > 0) return;
    const res = await fetch(`/api/proxy/discord/guilds/${guildId}/channels`);
    const data = await res.json();
    if (Array.isArray(data)) setDiscordChannels(data);
  };

  const handleAddChannel = async (discordCh: { id: string; name: string }) => {
    setAddingChannel(true);
    const res = await fetch(`/api/proxy/servers/${serverId}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discord_channel_id: discordCh.id, name: discordCh.name }),
    });
    if (res.ok) {
      const added = await res.json();
      setChannels((prev) => [...prev, added]);
    }
    setAddingChannel(false);
  };

  if (loading) {
    return <div className="text-ink-dark">Loading...</div>;
  }

  const monitoredIds = new Set(channels.map((c) => c.discord_channel_id));
  const availableChannels = discordChannels.filter((dc) => !monitoredIds.has(dc.id));

  const dayLabel = dayOptions.find((d) => d.value === scheduleDay)?.label ?? "Sunday";
  const hourLabel = hourOptions.find((h) => h.value === scheduleHour)?.label ?? "6pm UTC";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Server"
        title={serverName}
        description={`Newsletter every ${dayLabel} at ${hourLabel}`}
        action={
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-positive">Saved!</span>}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        }
      />

      <div className="space-y-8">
        {/* Voice & Identity */}
        <SettingsCard
          title="Voice & Identity"
          description="Help the AI understand your community and match its writing style."
        >
          <div className="space-y-6">
            {/* Community Type */}
            <div className="space-y-2">
              <Label htmlFor="community-type">Community Type</Label>
              <Input
                id="community-type"
                placeholder="e.g., Developer community, Gaming guild, Startup team"
                value={communityType}
                onChange={(e) => setCommunityType(e.target.value)}
              />
              <p className="text-xs text-ink-medium">
                Helps the AI understand the tone and context of your community.
              </p>
            </div>

            {/* Voice sample — paste a past newsletter for the AI to
                mirror. Optional; if blank, Pass2 falls back to its
                default voice rules. This is the single biggest
                perceived-quality lever on first run, so we surface it
                with a longer help line than the other fields. */}
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <Label htmlFor="voice-sample">Voice sample (optional)</Label>
                <span className="text-xs text-ink-medium">
                  {voiceSample.length}/5000
                </span>
              </div>
              <Textarea
                id="voice-sample"
                placeholder={`Paste a past newsletter, blog post, or anything you've written for this audience. The AI will match its rhythm and warmth — without copying phrases.\n\nLeave blank for default voice.`}
                value={voiceSample}
                onChange={(e) => setVoiceSample(e.target.value.slice(0, 5000))}
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-ink-medium">
                The AI mirrors voice from concrete examples better than from
                descriptions. One or two paragraphs of your own writing is plenty.
              </p>
            </div>
          </div>
        </SettingsCard>

        {/* Schedule */}
        <SettingsCard
          title="Schedule"
          description="Distill will generate a newsletter draft every week on this day and time."
        >
          <div className="space-y-2">
            <Label>Newsletter Schedule</Label>
            <div className="flex gap-3">
              <Select value={scheduleDay} onValueChange={(v) => { if (v) setScheduleDay(v); }}>
                <SelectTrigger className="w-full">
                  <SelectValue>{dayLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={scheduleHour} onValueChange={(v) => { if (v) setScheduleHour(v); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue>{hourLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {hourOptions.map((h) => (
                    <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsCard>

        {/* Channels */}
        <SettingsCard
          title="Channels"
          description="Mark each channel by signal — the AI weights stories accordingly."
        >
          <div className="space-y-3">
            {channels.length > 0 ? (
              <ul className="space-y-1">
                {channels.map((channel) => (
                  <li
                    key={channel.id}
                    className="flex items-center justify-between gap-3 text-sm text-ink bg-ink-lightest px-3 py-2 rounded-md"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-ink-medium">#</span>
                      <span className="truncate">{channel.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Select
                        value={weightToPreset(channel.weight)}
                        onValueChange={async (v) => {
                          if (!v) return;
                          const w = parseFloat(v);
                          // Optimistic update so the dropdown doesn't feel
                          // sluggish; the PATCH below reconciles or fails.
                          setChannels((prev) =>
                            prev.map((c) => (c.id === channel.id ? { ...c, weight: w } : c)),
                          );
                          await fetch(
                            `/api/proxy/servers/${serverId}/channels/${channel.discord_channel_id}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ weight: w }),
                            },
                          );
                        }}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs">
                          <SelectValue>
                            {WEIGHT_PRESETS.find((p) => p.value === weightToPreset(channel.weight))?.label ?? "Normal"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {WEIGHT_PRESETS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              <div>
                                <div className="text-sm">{p.label}</div>
                                <div className="text-xs text-ink-medium">{p.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        className="text-xs text-negative hover:text-negative cursor-pointer"
                        onClick={async () => {
                          await fetch(
                            `/api/proxy/servers/${serverId}/channels/${channel.discord_channel_id}`,
                            { method: "DELETE" }
                          );
                          setChannels((prev) => prev.filter((c) => c.id !== channel.id));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-medium bg-ink-lightest px-3 py-4 rounded-md text-center">
                No channels monitored yet. Add channels below.
              </p>
            )}
            {discordChannels.length === 0 ? (
              <Button variant="outline" size="sm" onClick={loadDiscordChannels}>
                + Add channel
              </Button>
            ) : availableChannels.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-ink-medium">Select a channel to monitor:</p>
                {availableChannels.map((dc) => (
                  <button
                    key={dc.id}
                    disabled={addingChannel}
                    className="flex items-center gap-2 w-full text-left text-sm text-ink-medium hover:bg-ink-lightest px-3 py-2 rounded-md cursor-pointer disabled:opacity-50"
                    onClick={() => handleAddChannel(dc)}
                  >
                    <span className="text-ink-medium">#</span>
                    {dc.name}
                    <span className="ml-auto text-xs text-link">+ Add</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-medium">All channels are already monitored.</p>
            )}
          </div>
        </SettingsCard>

        {/* Newsletters — recent drafts for this server, with a link to
            the full archive. */}
        <SettingsCard
          title="Newsletters"
          description="Recent newsletter drafts generated for this server."
          action={
            <Link
              href={`/dashboard/servers/${serverId}/newsletters`}
              className="text-sm font-semibold text-link hover:underline"
            >
              View all →
            </Link>
          }
        >
          {newslettersLoading ? (
            <p className="text-sm text-ink-medium">Loading…</p>
          ) : newsletters.length === 0 ? (
            <p className="text-sm text-ink-medium">
              No newsletters generated yet.
            </p>
          ) : (
            <NewsletterFeed
              items={newsletters.slice(0, 5).map(
                (nl): NewsletterFeedItem => ({
                  id: nl.id,
                  serverId,
                  serverName,
                  title: extractTitle(nl),
                  status: nl.status,
                  updatedLabel: formatDistanceToNow(
                    new Date(nl.created_at),
                    { addSuffix: true },
                  ),
                }),
              )}
            />
          )}
        </SettingsCard>
      </div>
    </div>
  );
}
