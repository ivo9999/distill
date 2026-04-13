"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";

interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  apiKey: string;
  publicationId: string;
}

const defaultIntegrations: Integration[] = [
  {
    id: "beehiiv",
    name: "Beehiiv",
    description:
      "Modern newsletter platform with built-in growth tools, referral programs, and analytics.",
    connected: false,
    apiKey: "",
    publicationId: "",
  },
  {
    id: "convertkit",
    name: "ConvertKit",
    description:
      "Email marketing platform designed for creators with automation, landing pages, and subscriber tagging.",
    connected: false,
    apiKey: "",
    publicationId: "",
  },
  {
    id: "ghost",
    name: "Ghost",
    description:
      "Open-source publishing platform for professional blogs and newsletters with membership support.",
    connected: false,
    apiKey: "",
    publicationId: "",
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] =
    useState<Integration[]>(defaultIntegrations);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proxy/integrations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setIntegrations((prev) =>
            prev.map((i) => {
              const existing = data.find((d: any) => d.platform === i.id);
              return existing
                ? { ...i, connected: true, publicationId: existing.publication_id || "" }
                : i;
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  const updateIntegration = (id: string, updates: Partial<Integration>) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
    );
  };

  const handleConnect = async (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return;
    setSaving(id);
    const res = await fetch(`/api/proxy/integrations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: integration.apiKey,
        publication_id: integration.publicationId,
      }),
    });
    if (res.ok) {
      updateIntegration(id, { connected: true });
    }
    setSaving(null);
  };

  const handleDisconnect = async (id: string) => {
    setSaving(id);
    const res = await fetch(`/api/proxy/integrations/${id}`, { method: "DELETE" });
    if (res.ok) {
      updateIntegration(id, { connected: false, apiKey: "", publicationId: "" });
    }
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-gray-600 mt-1">
          Connect your newsletter platform to publish directly from Distill.
        </p>
      </div>

      <div className="grid gap-4">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">{integration.name}</CardTitle>
                <CardDescription className="mt-1">
                  {integration.description}
                </CardDescription>
              </div>
              <Badge
                variant={integration.connected ? "default" : "secondary"}
              >
                {integration.connected ? "Connected" : "Not connected"}
              </Badge>
            </CardHeader>
            <CardContent>
              {integration.connected ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Your {integration.name} account is connected and ready to
                    publish.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => handleDisconnect(integration.id)}
                    disabled={saving === integration.id}
                  >
                    {saving === integration.id
                      ? "Disconnecting..."
                      : "Disconnect"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${integration.id}-api-key`}>
                        API Key
                      </Label>
                      <Input
                        id={`${integration.id}-api-key`}
                        type="password"
                        placeholder="Enter your API key"
                        value={integration.apiKey}
                        onChange={(e) =>
                          updateIntegration(integration.id, {
                            apiKey: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${integration.id}-pub-id`}>
                        Publication ID
                      </Label>
                      <Input
                        id={`${integration.id}-pub-id`}
                        placeholder="Enter your publication ID"
                        value={integration.publicationId}
                        onChange={(e) =>
                          updateIntegration(integration.id, {
                            publicationId: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleConnect(integration.id)}
                      disabled={
                        saving === integration.id ||
                        !integration.apiKey ||
                        !integration.publicationId
                      }
                    >
                      {saving === integration.id
                        ? "Connecting..."
                        : "Connect"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
