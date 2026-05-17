"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [scheduleDay, setScheduleDay] = useState("0");
  const [scheduleHour, setScheduleHour] = useState("18");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [discordChannels, setDiscordChannels] = useState<{ id: string; name: string }[]>([]);
  const [addingChannel, setAddingChannel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{serverName}</h2>

      <Card>
        <CardHeader>
          <CardTitle>Server Settings</CardTitle>
          <CardDescription>
            Configure how Distill processes your Discord server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Community Type */}
          <div className="space-y-2">
            <Label htmlFor="community-type">Community Type</Label>
            <Input
              id="community-type"
              placeholder="e.g., Developer community, Gaming guild, Startup team"
              value={communityType}
              onChange={(e) => setCommunityType(e.target.value)}
            />
            <p className="text-xs text-ink-dark">
              Helps the AI understand the tone and context of your community.
            </p>
          </div>

          {/* Schedule — Day + Hour */}
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
            <p className="text-xs text-ink-dark">
              Distill will generate a newsletter draft every week on this day and time.
            </p>
          </div>

          {/* Monitored Channels */}
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <Label>Monitored Channels</Label>
              <p className="text-xs text-ink-dark">
                Mark each channel by signal — the AI weights stories accordingly.
              </p>
            </div>
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
                                <div className="text-xs text-ink-dark">{p.description}</div>
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
              <p className="text-sm text-ink-dark bg-ink-lightest px-3 py-4 rounded-md text-center">
                No channels monitored yet. Add channels below.
              </p>
            )}
            {discordChannels.length === 0 ? (
              <Button variant="outline" size="sm" onClick={loadDiscordChannels}>
                + Add channel
              </Button>
            ) : availableChannels.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-ink-dark">Select a channel to monitor:</p>
                {availableChannels.map((dc) => (
                  <button
                    key={dc.id}
                    disabled={addingChannel}
                    className="flex items-center gap-2 w-full text-left text-sm text-ink-dark hover:bg-ink-lightest px-3 py-2 rounded-md cursor-pointer disabled:opacity-50"
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

          {/* Save */}
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-positive">Saved!</span>}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
