import { useEffect } from "react";
import { useDiagramStore } from "../../../store/diagramStore";

export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const temporal = useDiagramStore.temporal.getState();
      const { applyAutoLayout } = useDiagramStore.getState();

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          temporal.redo();
        } else {
          temporal.undo();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        temporal.redo();
      }

      // Magic Layout (Ctrl+L or Cmd+L)
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        applyAutoLayout("TB");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};