"use client";

import { useRouter } from "next/navigation";
import { Server, Plug, User, Sparkles, LayoutGrid } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface PaletteServer {
  id: string;
  name: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: PaletteServer[];
}

export function CommandPalette({
  open,
  onOpenChange,
  servers,
}: CommandPaletteProps) {
  const router = useRouter();

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a server or page…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Servers
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/integrations")}>
            <Plug className="mr-2 h-4 w-4" />
            Integrations
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/profile")}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/onboarding")}>
            <Sparkles className="mr-2 h-4 w-4" />
            Add a server
          </CommandItem>
        </CommandGroup>
        {servers.length > 0 && (
          <CommandGroup heading="Servers">
            {servers.map((s) => (
              <CommandItem
                key={s.id}
                value={s.name}
                onSelect={() => go(`/dashboard/servers/${s.id}`)}
              >
                <Server className="mr-2 h-4 w-4" />
                {s.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
