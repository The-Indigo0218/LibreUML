import { useEffect } from "react";
import { useEditActions } from "./actions/useEditActions";
import { useLayoutActions } from "./actions/useLayoutActions";

/**
 * Keyboard shortcuts hook - SSOT Version
 * PHASE 7: Integrated with History (Undo/Redo)
 * 
 * Provides keyboard shortcuts for common operations:
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 * - Ctrl+L: Auto Layout
 */
export const useKeyboardShortcuts = () => {
  const { undo, redo, canUndo, canRedo } = useEditActions();
  const { applyAutoLayout } = useLayoutActions();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
      }

      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
      }

      // Auto Layout (Ctrl+L)
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        applyAutoLayout("TB");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo, applyAutoLayout]);
};

