import { useEffect } from "react";
import { useAutoLayout } from "./useAutoLayout";
import { useUiStore } from "../../../store/uiStore";

export const useKeyboardShortcuts = () => {
  const { runLayout } = useAutoLayout();
  const openOpenFileModal = useUiStore((s) => s.openOpenFileModal);
  const openExportModal = useUiStore((s) => s.openExportModal);

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

      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        openOpenFileModal();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        openExportModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runLayout, openOpenFileModal, openExportModal]);
};
