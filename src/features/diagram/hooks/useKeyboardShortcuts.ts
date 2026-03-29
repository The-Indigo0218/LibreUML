import { useEffect } from "react";
import { useAutoLayout } from "./useAutoLayout";
import { useUiStore } from "../../../store/uiStore";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { useFileLifecycle } from "./actions/useFileLifecycle";

export const useKeyboardShortcuts = () => {
  const { runLayout } = useAutoLayout();
  const openOpenFileModal = useUiStore((s) => s.openOpenFileModal);
  const openExportModal = useUiStore((s) => s.openExportModal);
  const { createNewDiagram } = useFileLifecycle();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N / Cmd+N — blocked by Chromium on web; kept for Electron build
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        createNewDiagram();
        return;
      }

      // Alt+N / Option+N — web-safe alternative
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === "n") {
        e.preventDefault();
        createNewDiagram();
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      // Ctrl+Shift+Z / Cmd+Shift+Z — redo (check before plain Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        // Redo on both stores to keep VFS and Model in sync
        useVFSStore.temporal.getState().redo();
        useModelStore.temporal.getState().redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        // Undo on both stores to keep VFS and Model in sync
        useVFSStore.temporal.getState().undo();
        useModelStore.temporal.getState().undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        // Redo on both stores to keep VFS and Model in sync
        useVFSStore.temporal.getState().redo();
        useModelStore.temporal.getState().redo();
        return;
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
  }, [runLayout, openOpenFileModal, openExportModal, createNewDiagram]);
};
