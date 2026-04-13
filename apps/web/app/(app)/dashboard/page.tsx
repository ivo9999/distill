"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Server {
  id: string;
  name: string;
  discord_guild_id: string;
  status: string;
  schedule_cron: string;
  community_type: string | null;
}

export default function DashboardPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: wire up to Go API via Next.js proxy
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Welcome to Distill</h2>
        <p className="text-gray-600 mb-8">
          Get started by connecting your Discord server.
        </p>
        <Link href="/dashboard/onboarding">
          <Button size="lg">Set up your first server</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Your Servers</h2>
      </div>
      <div className="grid gap-4">
        {servers.map((server) => (
          <Card key={server.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{server.name}</CardTitle>
              <Badge
                variant={
                  server.status === "active" ? "default" : "secondary"
                }
              >
                {server.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Schedule: {server.schedule_cron}
              </span>
              <div className="flex gap-2">
                <Link href={`/dashboard/servers/${server.id}`}>
                  <Button variant="outline" size="sm">
                    Settings
                  </Button>
                </Link>
                <Link href={`/dashboard/servers/${server.id}/newsletters`}>
                  <Button variant="outline" size="sm">
                    Newsletters
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
