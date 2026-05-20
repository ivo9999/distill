"use client";

import { useEffect, useCallback, useRef } from "react";
import { useDeviceType } from "./use-device-type";

type ModifierKey = "meta" | "ctrl" | "shift" | "alt";

export interface ShortcutOptions {
  /** The key to listen for (e.g., 'n', 'k', '/', 'Escape') */
  key: string;
  /** Modifier keys required (meta = Cmd on Mac, Ctrl on Windows) */
  modifiers?: ModifierKey[];
  /** Callback function when shortcut is triggered */
  callback: () => void;
  /** Whether the shortcut is currently enabled */
  enabled?: boolean;
  /** Whether to prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Whether to ignore the shortcut when focus is in input fields (default: true) */
  ignoreInInput?: boolean;
  /** Description of the shortcut for help overlay */
  description?: string;
}

/**
 * Checks if the event target is an input field where we shouldn't trigger shortcuts.
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

/**
 * Checks if the required modifiers match the event.
 * 'meta' modifier is treated as platform-aware: metaKey on Mac, ctrlKey on Windows/Linux.
 */
function modifiersMatch(
  event: KeyboardEvent,
  modifiers: ModifierKey[] = []
): boolean {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

  // Check if the primary modifier (Cmd/Ctrl) is required
  const requiresPrimaryModifier = modifiers.includes("meta") || modifiers.includes("ctrl");

  // On Mac, use metaKey for primary modifier; on Windows/Linux, use ctrlKey
  const primaryModifierPressed = isMac ? event.metaKey : event.ctrlKey;

  // Check if primary modifier matches requirement
  if (requiresPrimaryModifier && !primaryModifierPressed) return false;
  if (!requiresPrimaryModifier && primaryModifierPressed) return false;

  // Check shift modifier
  const requiresShift = modifiers.includes("shift");
  if (requiresShift !== event.shiftKey) return false;

  // Check alt modifier
  const requiresAlt = modifiers.includes("alt");
  if (requiresAlt !== event.altKey) return false;

  return true;
}

/**
 * Hook to handle keyboard shortcuts with platform-aware modifier keys.
 * Automatically disables on mobile devices and ignores shortcuts in input fields.
 */
export function useKeyboardShortcut({
  key,
  modifiers = [],
  callback,
  enabled = true,
  preventDefault = true,
  ignoreInInput = true,
}: ShortcutOptions): void {
  const { isMobile } = useDeviceType();
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip on mobile devices
      if (isMobile) return;

      // Skip if disabled
      if (!enabled) return;

      // Skip if in input field and ignoreInInput is true
      if (ignoreInInput && isInputElement(event.target)) return;

      // Check if the key matches (case-insensitive)
      const eventKey = event.key.toLowerCase();
      const targetKey = key.toLowerCase();

      if (eventKey !== targetKey) return;

      // Check if modifiers match
      if (!modifiersMatch(event, modifiers)) return;

      // All conditions met - trigger the callback
      if (preventDefault) {
        event.preventDefault();
      }

      callbackRef.current();
    },
    [key, modifiers, enabled, preventDefault, ignoreInInput, isMobile]
  );

  useEffect(() => {
    // Don't attach listeners on mobile
    if (isMobile) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, isMobile]);
}

/**
 * Hook to handle multiple keyboard shortcuts at once.
 * Useful for components that need to register several shortcuts.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutOptions[]): void {
  const { isMobile } = useDeviceType();
  const shortcutsRef = useRef(shortcuts);

  // Keep shortcuts ref updated
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    // Don't attach listeners on mobile
    if (isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current) {
        const {
          key,
          modifiers = [],
          callback,
          enabled = true,
          preventDefault = true,
          ignoreInInput = true,
        } = shortcut;

        // Skip if disabled
        if (!enabled) continue;

        // Skip if in input field and ignoreInInput is true
        if (ignoreInInput && isInputElement(event.target)) continue;

        // Check if the key matches
        const eventKey = event.key.toLowerCase();
        const targetKey = key.toLowerCase();

        if (eventKey !== targetKey) continue;

        // Check if modifiers match
        if (!modifiersMatch(event, modifiers)) continue;

        // All conditions met - trigger the callback
        if (preventDefault) {
          event.preventDefault();
        }

        callback();
        return; // Only trigger one shortcut per keypress
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobile]);
}
