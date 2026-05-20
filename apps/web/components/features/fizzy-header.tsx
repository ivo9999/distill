"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Home,
  Plug,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  User,
  LogOut,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface HeaderServer {
  id: string;
  name: string;
}

interface HeaderUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface FizzyHeaderProps {
  user: HeaderUser;
  servers: HeaderServer[];
  currentServerId?: string;
  onOpenSearch?: () => void;
}

function deriveTitle(
  pathname: string,
  currentServer?: HeaderServer,
): string {
  if (pathname === "/dashboard") return "Servers";
  if (pathname === "/dashboard/integrations") return "Integrations";
  if (pathname === "/dashboard/profile") return "Profile";
  if (pathname === "/dashboard/admin") return "Admin";
  if (pathname === "/dashboard/onboarding") return "Add a server";
  if (pathname.startsWith("/dashboard/servers/") && currentServer) {
    if (pathname.includes("/newsletters")) return `${currentServer.name} · Newsletters`;
    return currentServer.name;
  }
  // Fallback: unknown route, or a server path whose server has not loaded yet.
  return "Distill";
}

export function FizzyHeader({
  user,
  servers,
  currentServerId,
  onOpenSearch,
}: FizzyHeaderProps) {
  const pathname = usePathname() ?? "";
  const currentServer = servers.find((s) => s.id === currentServerId);
  const title = deriveTitle(pathname, currentServer);
  const [navOpen, setNavOpen] = useState(false);
  const { setTheme } = useTheme();

  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-pill hover:bg-ink-lightest transition-colors sm:h-12 sm:w-12"
          aria-label="User menu"
        >
          <Avatar className="h-9 w-9 sm:h-11 sm:w-11">
            <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
            <AvatarFallback className="bg-ink text-ink-inverted text-xs font-bold sm:text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
            <AvatarFallback className="bg-ink text-ink-inverted text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink-darker">
              {user.name}
            </p>
            <p className="truncate text-xs text-ink-medium">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <User /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/integrations">
            <Plug /> Integrations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/admin">
            <Shield /> Admin
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor /> System
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            window.location.href = "/api/auth/signout";
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header
      className="relative z-30 grid items-center gap-y-1 bg-canvas px-3 py-2"
      style={{
        gridTemplateColumns: "1fr auto 1fr",
        gridTemplateAreas: '"nav nav nav" "left title right"',
      }}
    >
      {/* Row 1: centered nav trigger */}
      <Popover open={navOpen} onOpenChange={setNavOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mx-auto inline-flex items-center gap-2.5 rounded-pill border border-ink-lighter bg-canvas px-5 py-2.5 text-sm font-semibold text-ink-darker transition-colors hover:bg-ink-lightest"
            style={{ gridArea: "nav" }}
            aria-haspopup="menu"
            aria-expanded={navOpen}
          >
            <BrandMark className="h-5 w-auto" />
            <span className="font-black tracking-tight">
              {currentServer?.name ?? "Distill"}
            </span>
            <ChevronDown className="h-4 w-4 text-ink-medium" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          sideOffset={6}
          className="flex w-[min(45ch,calc(100vw-2rem))] max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-3xl border-ink-lighter p-0"
        >
          <button
            type="button"
            onClick={() => {
              setNavOpen(false);
              onOpenSearch?.();
            }}
            className="flex items-center gap-2 px-4 pt-4 pb-2 text-xs font-medium text-ink-medium transition-colors hover:text-ink"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search servers and pages…</span>
            <kbd aria-hidden className="ml-auto inline-flex h-4 items-center rounded border border-ink-light px-1 text-[9px] font-mono">
              ⌘K
            </kbd>
          </button>

          <div className="grid grid-cols-3 gap-2 px-4 pb-3">
            <QuickTile href="/dashboard" icon={Home} label="Servers" isActive={pathname === "/dashboard"} onNavigate={() => setNavOpen(false)} />
            <QuickTile href="/dashboard/integrations" icon={Plug} label="Integrations" isActive={pathname === "/dashboard/integrations"} onNavigate={() => setNavOpen(false)} />
            <QuickTile href="/dashboard/profile" icon={User} label="Profile" isActive={pathname === "/dashboard/profile"} onNavigate={() => setNavOpen(false)} />
          </div>

          <div className="flex-1 overflow-y-auto border-t border-ink-lighter">
            <NavSection title="Servers" defaultOpen>
              {servers.map((s) => (
                <NavLink
                  key={s.id}
                  href={`/dashboard/servers/${s.id}`}
                  onNavigate={() => setNavOpen(false)}
                  isActive={pathname.startsWith(`/dashboard/servers/${s.id}`)}
                  leading={<Server className="h-4 w-4 shrink-0" />}
                >
                  {s.name}
                </NavLink>
              ))}
              <Link
                href="/dashboard/onboarding"
                onClick={() => setNavOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-semibold text-ink-medium transition-colors hover:bg-ink-lightest hover:text-ink"
              >
                <Plus className="h-4 w-4 shrink-0" />
                Add a server
              </Link>
            </NavSection>
            <NavSection title="Settings">
              <NavLink href="/dashboard/admin" onNavigate={() => setNavOpen(false)} isActive={pathname === "/dashboard/admin"} leading={<Shield className="h-4 w-4 shrink-0" />}>
                Admin
              </NavLink>
            </NavSection>
          </div>
        </PopoverContent>
      </Popover>

      {/* Row 2: framed title + avatar. A spacer mirrors the avatar's
          width on the left so the rule—title—rule framing stays
          centered. */}
      <div
        className="mx-auto mt-3 flex w-full flex-col items-stretch gap-2 sm:mt-6 sm:w-[80%]"
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="flex w-full items-center gap-2">
          <span aria-hidden className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
          <span aria-hidden className="h-px flex-1 bg-ink-lighter" />
          <h1 className="truncate px-2 text-center text-lg font-black tracking-tight text-ink sm:px-3 sm:text-3xl">
            {title}
          </h1>
          <span aria-hidden className="h-px flex-1 bg-ink-lighter" />
          {userMenu}
        </div>
      </div>
    </header>
  );
}

function NavSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group/section border-t border-ink-lighter first:border-t-0"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer list-none select-none items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-ink-darker transition-colors hover:bg-ink-lightest/50">
        <ChevronRight className="h-3 w-3 text-ink-medium transition-transform group-open/section:rotate-90" />
        {title}
      </summary>
      <div className="flex flex-col gap-px px-2 pb-2">{children}</div>
    </details>
  );
}

function QuickTile({
  href,
  icon: Icon,
  label,
  isActive,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-[11px] font-bold transition-colors",
        isActive
          ? "bg-selected text-link"
          : "bg-ink-lightest/60 text-ink-darker hover:bg-ink-lightest",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center leading-tight">{label}</span>
    </Link>
  );
}

function NavLink({
  href,
  children,
  isActive,
  leading,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
  leading: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
        isActive
          ? "bg-ink text-ink-inverted"
          : "text-ink-darker hover:bg-ink-lightest hover:text-ink",
      )}
    >
      {leading}
      <span className="truncate">{children}</span>
    </Link>
  );
}
