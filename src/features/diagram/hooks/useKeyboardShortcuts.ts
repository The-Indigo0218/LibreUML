import { useEffect } from "react";
import { useAutoLayout } from "./useAutoLayout";

export const useKeyboardShortcuts = () => {
  const { runLayout } = useAutoLayout();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        runLayout();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runLayout]);
};
