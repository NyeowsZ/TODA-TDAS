"use client";

import { useEffect, useCallback } from "react";

/**
 * Global keyboard navigation hook for the controller terminal.
 * Handles keyboard shortcuts for fast dispatch entry.
 */
export function useKeyboardNav(handlers: {
  onEnter?: () => void;
  onEscape?: () => void;
  onTab?: () => void;
  onDigit?: (digit: number) => void;
  enabled?: boolean;
}) {
  const { onEnter, onEscape, onTab, onDigit, enabled = true } = handlers;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't intercept if user is in an input that isn't our body number field
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      const isBodyNumberInput =
        isInput && (target as HTMLInputElement).name === "body_number";
      const isLaunchInput =
        isInput && (target as HTMLInputElement).name === "launch_count";

      switch (event.key) {
        case "Enter":
          if (onEnter && !event.repeat) {
            event.preventDefault();
            onEnter();
          }
          break;
        case "Escape":
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          break;
        case "Tab":
          // Only handle Tab in body number input to move to launch count
          if (isBodyNumberInput && onTab) {
            event.preventDefault();
            onTab();
          }
          break;
        default:
          // Handle digit keys for quick preset selection
          if (
            onDigit &&
            !isInput &&
            event.key >= "1" &&
            event.key <= "9"
          ) {
            onDigit(parseInt(event.key));
          }
          break;
      }
    },
    [onEnter, onEscape, onTab, onDigit, enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
