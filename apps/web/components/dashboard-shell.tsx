"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { LogOut, User, Shield, Plug } from "lucide-react";

interface ShellUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  subscriptionStatus?: string;
  isAdmin?: boolean;
}

interface NavLink {
  href: string;
  label: string;
  icon?: React.ReactNode;
  matchExact?: boolean;
}

export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/dashboard", label: "Servers", matchExact: true },
    { href: "/dashboard/integrations", label: "Integrations", icon: <Plug className="h-3.5 w-3.5" /> },
  ];

  const initials = (user.name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const status = user.subscriptionStatus ?? "inactive";
  const statusColor =
    status === "active"
      ? "bg-positive"
      : status === "past_due"
        ? "bg-warning"
        : "bg-ink-medium";

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-ink-lighter/60 bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Logo />
            <span className="text-base">Distill</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const isActive = link.matchExact
                ? pathname === link.href
                : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-ink text-ink-inverted"
                      : "text-ink-dark hover:bg-ink-lightest",
                  )}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-ink-lighter px-2.5 py-1 text-xs text-ink-dark",
              )}
            >
              <span className={cn("inline-block h-1.5 w-1.5 rounded-full", statusColor)} />
              {status === "active" ? "Pro" : status === "past_due" ? "Past due" : "Free"}
            </span>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
                <Avatar className="h-8 w-8">
                  {user.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-medium">
                      {user.name ?? "Account"}
                    </span>
                    {user.email && (
                      <span className="truncate text-xs text-ink-dark">
                        {user.email}
                      </span>
                    )}
                  </div>
                  <Badge variant={status === "active" ? "default" : "secondary"}>
                    {status}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile">
                    <User className="mr-2 h-3.5 w-3.5" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/integrations">
                    <Plug className="mr-2 h-3.5 w-3.5" />
                    Integrations
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/admin">
                    <Shield className="mr-2 h-3.5 w-3.5" />
                    Admin
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-negative focus:text-negative"
                  onClick={() => {
                    window.location.href = "/api/auth/signout";
                  }}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2 scrollbar-hidden">
          {links.map((link) => {
            const isActive = link.matchExact
              ? pathname === link.href
              : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-ink text-ink-inverted"
                    : "text-ink-dark hover:bg-ink-lightest",
                )}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:py-8">
        {children}
      </main>

      <footer className="border-t border-ink-lighter/60 py-4 text-center text-xs text-ink-medium">
        Built by SisleLabs in Sofia · <Link href="/" className="hover:text-ink underline-offset-2 hover:underline">distill</Link>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <span className="relative inline-flex h-7 w-7 items-center justify-center">
      <span
        aria-hidden
        className="absolute inset-0 rounded-[40%_60%_55%_45%/_50%_55%_45%_50%] bg-accent-7"
        style={{ filter: "saturate(0.85)" }}
      />
      <span
        aria-hidden
        className="absolute inset-1 rounded-[55%_45%_60%_40%/_45%_55%_50%_50%] bg-accent-5/80"
      />
    </span>
  );
}
