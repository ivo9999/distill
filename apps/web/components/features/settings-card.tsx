"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  action?: React.ReactNode;
  className?: string;
}

// Fizzy-style settings section. Renders as a flat section inside the surrounding
// panel — no nested bordered boxes — with a `divider` heading: title text on the
// left, rule fading to the right, optional action floating on the far right.
export function SettingsCard({
  title,
  description,
  children,
  collapsible = false,
  defaultCollapsed = false,
  action,
  className,
}: SettingsCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className={cn("py-1", className)}>
      <header
        className={cn(
          "flex items-center gap-3",
          collapsible && "cursor-pointer select-none",
        )}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        {collapsible && (
          <span className="text-ink-medium shrink-0">
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        )}
        <h2 className="text-base font-black tracking-tight text-ink whitespace-nowrap">
          {title}
        </h2>
        <span aria-hidden className="flex-1 h-px bg-ink-light" />
        {action && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {action}
          </div>
        )}
      </header>
      {description && (
        <p className="mt-2 text-sm text-ink-medium leading-relaxed">
          {description}
        </p>
      )}
      {!collapsed && <div className="mt-4">{children}</div>}
    </section>
  );
}
