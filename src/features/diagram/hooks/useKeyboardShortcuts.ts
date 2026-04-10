import { useEffect } from "react";
import { useKonvaAutoLayout } from "../../../canvas/hooks/useKonvaAutoLayout";
import { useUiStore } from "../../../store/uiStore";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { getUndoManager } from "../../../core/undo/undoBridge";
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

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const activeTabId = useWorkspaceStore.getState().activeTabId;
        getUndoManager()?.redo(activeTabId ?? undefined);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        const activeTabId = useWorkspaceStore.getState().activeTabId;
        getUndoManager()?.undo(activeTabId ?? undefined);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        const activeTabId = useWorkspaceStore.getState().activeTabId;
        getUndoManager()?.redo(activeTabId ?? undefined);
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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        openWiki();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        openExportModal();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();

        if (hasVFSProject) {
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
