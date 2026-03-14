import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "../store/workspace.store";
import { useProjectStore } from "../store/project.store";
import { useSettingsStore } from "../store/settingsStore";

const STORAGE_KEY = 'libreuml-backup';
const BACKUP_DELAY = 3000; 

/**
 * TODO: SSOT Migration - AutoSave
 * 
 * This hook needs to be rewritten to save SSOT format:
 * - Save WorkspaceStore state (files, activeFileId)
 * - Save ProjectStore state (nodes, edges)
 * - Restore needs to reconstruct both stores
 * 
 * For now, disabled to prevent build errors.
 */
export const useAutoSave = () => {
  const autoSaveEnabled = useSettingsStore((s) => s.autoSave);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  
  const activeFile = activeFileId ? getFile(activeFileId) : undefined;
  const isDirty = activeFile?.isDirty ?? false;
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty) {
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      // TODO: Implement SSOT-compatible autosave
      // Need to serialize WorkspaceStore + ProjectStore state
      console.warn("[AutoSave] TODO: SSOT autosave not implemented");
    }, BACKUP_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, activeFileId, autoSaveEnabled]);
};
