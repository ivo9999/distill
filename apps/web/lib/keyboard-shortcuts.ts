/**
 * Central registry of keyboard shortcuts for the application.
 * Used for the shortcuts help overlay and consistent shortcut handling.
 */

type ModifierKey = "meta" | "ctrl" | "shift" | "alt";

export type ShortcutCategory = "General" | "Navigation" | "Help";

export interface ShortcutDefinition {
  key: string;
  modifiers: ModifierKey[];
  description: string;
  category: ShortcutCategory;
}

export const KEYBOARD_SHORTCUTS: Record<string, ShortcutDefinition> = {
  SEARCH: {
    key: "k",
    modifiers: ["meta"],
    description: "Open command palette",
    category: "Navigation",
  },
  HELP: {
    key: "?",
    modifiers: [],
    description: "Show keyboard shortcuts",
    category: "Help",
  },
  CLOSE: {
    key: "Escape",
    modifiers: [],
    description: "Close dialog or palette",
    category: "General",
  },
} as const;

const categoryOrder: ShortcutCategory[] = ["General", "Navigation", "Help"];

export function getShortcutsByCategory(): Record<ShortcutCategory, ShortcutDefinition[]> {
  const grouped: Record<ShortcutCategory, ShortcutDefinition[]> = {
    General: [],
    Navigation: [],
    Help: [],
  };
  for (const shortcut of Object.values(KEYBOARD_SHORTCUTS)) {
    grouped[shortcut.category].push(shortcut);
  }
  return grouped;
}

export { categoryOrder };

/** Formats a shortcut into display key parts, e.g. ["⌘", "K"]. */
export function formatShortcutParts(
  shortcut: ShortcutDefinition,
  isMac: boolean,
): string[] {
  const parts: string[] = [];
  for (const mod of shortcut.modifiers) {
    if (mod === "meta") parts.push(isMac ? "⌘" : "Ctrl");
    else if (mod === "ctrl") parts.push("Ctrl");
    else if (mod === "shift") parts.push("⇧");
    else if (mod === "alt") parts.push(isMac ? "⌥" : "Alt");
  }
  parts.push(shortcut.key === "Escape" ? "Esc" : shortcut.key.toUpperCase());
  return parts;
}
