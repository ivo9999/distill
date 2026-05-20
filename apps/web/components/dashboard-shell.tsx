"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FizzyHeader, type HeaderServer } from "@/components/features/fizzy-header";
import { CommandPalette } from "@/components/features/command-palette";
import { KeyboardShortcutsHelp } from "@/components/features/keyboard-shortcuts-help";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

interface ShellUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  subscriptionStatus?: string;
}

export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [servers, setServers] = useState<HeaderServer[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/proxy/servers")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setServers(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
  }, []);

  useKeyboardShortcut({
    key: "k",
    modifiers: ["meta"],
    callback: () => setSearchOpen((o) => !o),
  });
  useKeyboardShortcut({
    key: "?",
    callback: () => setShortcutsOpen(true),
  });

  // Derive the current server id from /dashboard/servers/<id>/...
  const match = pathname.match(/^\/dashboard\/servers\/([^/]+)/);
  const currentServerId = match?.[1];

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <FizzyHeader
        user={user}
        servers={servers}
        currentServerId={currentServerId}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-ink-lighter/60 py-4 text-center text-xs text-ink-medium">
        Built by SisleLabs in Sofia ·{" "}
        <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
          distill
        </Link>
      </footer>

      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        servers={servers}
      />
      <KeyboardShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
