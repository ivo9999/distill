import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface NewsletterFeedItem {
  id: string;
  serverId: string;
  serverName: string;
  title: string;
  status: string;
  updatedLabel: string;
}

export function NewsletterFeed({ items }: { items: NewsletterFeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-ink-light px-4 py-10 text-center text-sm text-ink-medium">
        No newsletter drafts yet. Generate one from a server.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/dashboard/servers/${item.serverId}/newsletters/${item.id}`}
            className="group flex items-center gap-3 rounded-card border border-ink-lighter bg-canvas px-4 py-3 transition-shadow hover:shadow-card"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-card bg-brand-soft text-brand">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-darker group-hover:text-link transition-colors">
                {item.title}
              </p>
              <p className="text-xs text-ink-medium">
                {item.serverName} · {item.updatedLabel}
              </p>
            </div>
            <Badge variant={item.status === "published" ? "default" : "secondary"}>
              {item.status}
            </Badge>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-medium opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
