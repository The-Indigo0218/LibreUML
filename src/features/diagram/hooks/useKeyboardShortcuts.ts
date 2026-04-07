import { useEffect } from "react";
import { useKonvaAutoLayout } from "../../../canvas/hooks/useKonvaAutoLayout";
import { useUiStore } from "../../../store/uiStore";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { useFileLifecycle } from "./actions/useFileLifecycle";
import { useToastStore } from "../../../store/toast.store";
import { flushVFSSave } from "../../../hooks/actions/useVFSAutoSave";

export const useKeyboardShortcuts = () => {
  const { runLayout } = useKonvaAutoLayout();
  const openOpenFileModal = useUiStore((s) => s.openOpenFileModal);
  const openExportModal = useUiStore((s) => s.openExportModal);
  const openWiki = useUiStore((s) => s.openWiki);
  const { createNewDiagram, saveDiagram } = useFileLifecycle();
  const showToast = useToastStore((s) => s.show);
  const hasVFSProject = useVFSStore((s) => !!s.project);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        createNewDiagram();
        return;
      }

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
        useVFSStore.temporal.getState().redo();
        useModelStore.temporal.getState().redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        useVFSStore.temporal.getState().undo();
        useModelStore.temporal.getState().undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
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

      // Ctrl+H / Cmd+H — Open Wiki
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        openWiki();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        openExportModal();
      }

      // Ctrl+S / Cmd+S — Save current diagram
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        
        // Route to appropriate save mechanism based on project type
        if (hasVFSProject) {
          // VFS project: use auto-save flush for immediate save
          flushVFSSave().then((success) => {
            if (success) {
              showToast("Saved");
            }
          });
        } else {
          saveDiagram().then((success) => {
            if (success) {
              showToast("Saved");
            }
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runLayout, openOpenFileModal, openExportModal, openWiki, createNewDiagram, saveDiagram, showToast, hasVFSProject]);
};
