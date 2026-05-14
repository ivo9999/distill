"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UserStats {
  total_users: number;
  active_users: number;
  trialing_users: number;
  inactive_users: number;
  new_users_7d: number;
  new_users_30d: number;
}

interface NewsletterStats {
  total_newsletters: number;
  draft_count: number;
  published_count: number;
  error_count: number;
  on_demand_count: number;
  scheduled_count: number;
  total_cost_usd: string;
  total_tokens: number;
  newsletters_7d: number;
  newsletters_30d: number;
}

interface ServerStats {
  total_servers: number;
  active_servers: number;
  removed_servers: number;
}

interface MessageStats {
  total_messages: number;
  messages_7d: number;
  messages_30d: number;
}

interface RecentUser {
  id: string;
  discord_username: string;
  email: string;
  subscription_status: string;
  trial_ends_at: string;
  created_at: string;
  server_count: number;
  newsletter_count: number;
}

interface RecentNewsletter {
  id: string;
  status: string;
  cost_usd: string;
  is_on_demand: boolean;
  created_at: string;
  pass1_tokens_in: number;
  pass1_tokens_out: number;
  pass2_tokens_in: number;
  pass2_tokens_out: number;
  server_name: string;
  discord_username: string;
}

interface CostByDay {
  day: string;
  newsletter_count: number;
  cost_usd: string;
}

interface AdminData {
  users: UserStats;
  newsletters: NewsletterStats;
  servers: ServerStats;
  messages: MessageStats;
  recent_users: RecentUser[];
  recent_newsletters: RecentNewsletter[];
  cost_by_day: CostByDay[];
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-ink-dark">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-ink-dark mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "default" as const;
    case "trialing":
      return "secondary" as const;
    case "published":
      return "default" as const;
    case "draft":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCost(cost: string | number) {
  const n = typeof cost === "string" ? parseFloat(cost) : cost;
  return `$${n.toFixed(4)}`;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proxy/admin/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "Not authorized" : "Failed to load");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-ink-dark">Loading...</div>;
  if (error)
    return (
      <div className="text-negative bg-negative/10 rounded-lg px-4 py-3">
        {error}
      </div>
    );
  if (!data) return null;

  const { users, newsletters, servers, messages } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* KPI Cards */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={users.total_users}
            sub={`+${users.new_users_7d} this week`}
          />
          <StatCard
            title="Active Subscribers"
            value={users.active_users}
            sub={`${users.trialing_users} trialing`}
          />
          <StatCard
            title="Total Newsletters"
            value={newsletters.total_newsletters}
            sub={`+${newsletters.newsletters_7d} this week`}
          />
          <StatCard
            title="LLM Cost (Total)"
            value={formatCost(newsletters.total_cost_usd)}
            sub={`${newsletters.total_tokens.toLocaleString()} tokens`}
          />
        </div>
      </section>

      {/* Detailed Stats */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Active Servers"
            value={servers.active_servers}
            sub={`${servers.removed_servers} removed`}
          />
          <StatCard
            title="Published"
            value={newsletters.published_count}
            sub={`${newsletters.draft_count} draft, ${newsletters.error_count} error`}
          />
          <StatCard
            title="On-Demand"
            value={newsletters.on_demand_count}
            sub={`${newsletters.scheduled_count} scheduled`}
          />
          <StatCard
            title="Messages Tracked"
            value={messages.total_messages.toLocaleString()}
            sub={`+${messages.messages_7d.toLocaleString()} this week`}
          />
        </div>
      </section>

      {/* Cost by Day */}
      {data.cost_by_day.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Cost (Last 30 Days)</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-ink-dark">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium text-right">
                        Newsletters
                      </th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cost_by_day.map((row) => (
                      <tr key={row.day} className="border-b last:border-0">
                        <td className="py-2">{formatDate(row.day)}</td>
                        <td className="py-2 text-right">
                          {row.newsletter_count}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCost(row.cost_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Recent Users */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Users</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-ink-dark">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Servers</th>
                    <th className="pb-2 font-medium text-right">
                      Newsletters
                    </th>
                    <th className="pb-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">
                        {u.discord_username}
                      </td>
                      <td className="py-2 text-ink-dark">{u.email}</td>
                      <td className="py-2">
                        <Badge variant={statusColor(u.subscription_status)}>
                          {u.subscription_status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">{u.server_count}</td>
                      <td className="py-2 text-right">
                        {u.newsletter_count}
                      </td>
                      <td className="py-2 text-ink-dark">
                        {formatDate(u.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent Newsletters */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Newsletters</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-ink-dark">
                    <th className="pb-2 font-medium">Server</th>
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                    <th className="pb-2 font-medium text-right">Tokens</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_newsletters.map((n) => (
                    <tr key={n.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{n.server_name}</td>
                      <td className="py-2 text-ink-dark">
                        {n.discord_username}
                      </td>
                      <td className="py-2">
                        <Badge variant={statusColor(n.status)}>
                          {n.status}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {n.is_on_demand ? "on-demand" : "scheduled"}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {formatCost(n.cost_usd)}
                      </td>
                      <td className="py-2 text-right">
                        {(
                          n.pass1_tokens_in +
                          n.pass1_tokens_out +
                          n.pass2_tokens_in +
                          n.pass2_tokens_out
                        ).toLocaleString()}
                      </td>
                      <td className="py-2 text-ink-dark">
                        {formatDate(n.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
