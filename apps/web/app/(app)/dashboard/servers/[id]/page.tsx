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

const scheduleOptions = [
  { label: "Sunday 6pm", value: "0 18 * * 0" },
  { label: "Sunday 9am", value: "0 9 * * 0" },
  { label: "Monday 9am", value: "0 9 * * 1" },
  { label: "Monday 6pm", value: "0 18 * * 1" },
  { label: "Friday 9am", value: "0 9 * * 5" },
  { label: "Friday 6pm", value: "0 18 * * 5" },
];

interface ServerSettings {
  id: string;
  name: string;
  community_type: string;
  schedule_cron: string;
  channels: string[];
}

export default function ServerSettingsPage() {
  const params = useParams();
  const serverId = params.id as string;

  const [server, setServer] = useState<ServerSettings>({
    id: serverId,
    name: "My Server",
    community_type: "",
    schedule_cron: "0 18 * * 0",
    channels: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    // TODO: fetch server settings from Go API
    setLoading(false);
  }, [serverId]);

  const handleSave = async () => {
    setSaving(true);
    // TODO: save to Go API
    setTimeout(() => setSaving(false), 500);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    // TODO: trigger generation via Go API
    setTimeout(() => setGenerating(false), 2000);
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{server.name}</h2>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate Now"}
        </Button>
      </div>

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
              value={server.community_type}
              onChange={(e) =>
                setServer({ ...server, community_type: e.target.value })
              }
            />
            <p className="text-xs text-gray-500">
              Helps the AI understand the tone and context of your community.
            </p>
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label>Schedule</Label>
            <Select
              value={server.schedule_cron}
              onValueChange={(value) => {
                if (value) setServer({ ...server, schedule_cron: value });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select schedule" />
              </SelectTrigger>
              <SelectContent>
                {scheduleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              When Distill should generate your weekly newsletter draft.
            </p>
          </div>

          {/* Monitored Channels */}
          <div className="space-y-2">
            <Label>Monitored Channels</Label>
            {server.channels.length > 0 ? (
              <ul className="space-y-1">
                {server.channels.map((channel) => (
                  <li
                    key={channel}
                    className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-md"
                  >
                    <span className="text-gray-400">#</span>
                    {channel}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 px-3 py-4 rounded-md text-center">
                No channels configured yet. Channels will appear here once the
                bot is added to your server.
              </p>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
