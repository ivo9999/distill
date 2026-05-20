"use client";

import type { RefObject } from "react";
import { Bold, Italic, Heading2, Heading3, Link2, List, Quote } from "lucide-react";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

// Wrap-style actions surround the selection with markers; line-prefix
// actions prepend a marker to every line the selection touches.
type WrapAction = { kind: "wrap"; before: string; after: string };
type PrefixAction = { kind: "prefix"; prefix: string };
type Action = WrapAction | PrefixAction;

const ACTIONS: { label: string; icon: typeof Bold; action: Action }[] = [
  { label: "Bold", icon: Bold, action: { kind: "wrap", before: "**", after: "**" } },
  { label: "Italic", icon: Italic, action: { kind: "wrap", before: "*", after: "*" } },
  { label: "Heading 2", icon: Heading2, action: { kind: "prefix", prefix: "## " } },
  { label: "Heading 3", icon: Heading3, action: { kind: "prefix", prefix: "### " } },
  { label: "Link", icon: Link2, action: { kind: "wrap", before: "[", after: "](url)" } },
  { label: "List item", icon: List, action: { kind: "prefix", prefix: "- " } },
  { label: "Quote", icon: Quote, action: { kind: "prefix", prefix: "> " } },
];

export function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  const apply = (action: Action) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);

    let next: string;
    let nextStart: number;
    let nextEnd: number;

    if (action.kind === "wrap") {
      const { before, after } = action;
      next = value.slice(0, start) + before + selected + after + value.slice(end);
      if (selected) {
        // Keep the original text selected, now inside the markers.
        nextStart = start + before.length;
        nextEnd = nextStart + selected.length;
      } else {
        // No selection: drop the cursor between the markers.
        nextStart = start + before.length;
        nextEnd = nextStart;
      }
    } else {
      // Prefix every line the selection spans. lineStart is the start
      // of the first touched line; we only rewrite that slice.
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const region = value.slice(lineStart, end);
      const prefixed = region
        .split("\n")
        .map((line) => action.prefix + line)
        .join("\n");
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      // Select the whole prefixed region.
      nextStart = lineStart;
      nextEnd = lineStart + prefixed.length;
    }

    onChange(next);
    // Restore focus + selection after React applies the new value.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextStart, nextEnd);
    });
  };

  return (
    <div className="flex items-center gap-0.5">
      {ACTIONS.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => apply(action)}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-medium hover:bg-ink-lightest hover:text-ink transition-colors"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
