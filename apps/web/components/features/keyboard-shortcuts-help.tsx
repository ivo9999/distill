"use client";

import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useIsMac } from "@/hooks/use-device-type";
import {
  getShortcutsByCategory,
  formatShortcutParts,
  categoryOrder,
} from "@/lib/keyboard-shortcuts";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) {
  const isMac = useIsMac();
  const shortcutsByCategory = getShortcutsByCategory();

  useKeyboardShortcut({
    key: "Escape",
    callback: () => onOpenChange(false),
    enabled: open,
    ignoreInInput: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5" />
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {categoryOrder.map((category) => {
            const shortcuts = shortcutsByCategory[category];
            if (shortcuts.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-medium mb-2">
                  {category}
                </h3>
                <div className="space-y-0.5">
                  {shortcuts.map((shortcut, index) => {
                    const keyParts = formatShortcutParts(shortcut, isMac);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-card hover:bg-ink-lightest/60"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {keyParts.map((part, partIndex) => (
                            <kbd
                              key={partIndex}
                              className="px-1.5 py-0.5 text-xs font-mono bg-canvas border border-ink-lighter rounded-card shadow-sm min-w-[24px] text-center"
                            >
                              {part}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-ink-medium text-center pt-3 border-t border-ink-lighter">
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-canvas border border-ink-lighter rounded-card text-xs">
            ?
          </kbd>{" "}
          anytime to view shortcuts
        </div>
      </DialogContent>
    </Dialog>
  );
}
