"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  className?: string;
  iconClassName?: string;
}

// Cosmetic only: Distill has no notifications backend. Renders a bell that
// opens an empty "No notifications" popover. Kept for visual parity with the
// jira-clone shell.
export function NotificationBell({
  className,
  iconClassName,
}: NotificationBellProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 relative", className)}
        >
          <Bell className={cn("h-4 w-4", iconClassName)} />
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-sm font-medium">Notifications</h3>
        </div>
        <p className="py-10 text-center text-xs text-ink-medium">
          You&rsquo;re all caught up.
        </p>
      </PopoverContent>
    </Popover>
  );
}
