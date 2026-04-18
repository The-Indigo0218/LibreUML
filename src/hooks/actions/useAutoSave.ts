import { useEffect, useRef, useCallback } from "react";
import { useWorkspaceStore } from "../../store/workspace.store";
import { useProjectStore } from "../../store/project.store";
import { useSettingsStore } from "../../store/settingsStore";
import { storageAdapter } from "../../adapters/storage/storage.adapter";

const BACKUP_KEY = 'libreuml-backup';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const DEBOUNCE_DELAY = 2000; // 2 seconds after last change

/**
 * Auto-Save Hook
 *
 * Monitors dirty state and saves to backup storage with debouncing.
 * Does not trigger file system saves; respects autoSave setting toggle.
 */
export const useAutoSave = () => {
  const autoSaveEnabled = useSettingsStore((s) => s.autoSave);
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  const markFileClean = useWorkspaceStore((s) => s.markFileClean);
  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false);

  const performSave = useCallback(async () => {
    if (isSavingRef.current) return;

    const activeFile = getActiveFile();
    if (!activeFile) return;
    if (!activeFile.isDirty) return;

    try {
      isSavingRef.current = true;
      const nodes = getNodes(activeFile.nodeIds);
      const edges = getEdges(activeFile.edgeIds);

      const backupData = {
        version: 1,
        timestamp: Date.now(),
        activeFile: {
          id: activeFile.id,
          name: activeFile.name,
          diagramType: activeFile.diagramType,
          nodeIds: activeFile.nodeIds,
          edgeIds: activeFile.edgeIds,
          viewport: activeFile.viewport,
          metadata: activeFile.metadata,
        },
        nodes,
        edges,
      };

      const backupJson = JSON.stringify(backupData);
      storageAdapter.setItem(BACKUP_KEY, backupJson);

      markFileClean(activeFile.id);

      lastSaveTimeRef.current = Date.now();

    } catch (error) {
      console.error("[AutoSave] Error saving backup:", error);
    } finally {
      isSavingRef.current = false;
    }
  }, [getActiveFile, getNodes, getEdges, markFileClean]);

  /**
   * Debounced save - waits for user to stop making changes
   */
  const debouncedSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSave();
    }, DEBOUNCE_DELAY);
  }, [performSave]);

  const checkAndSave = useCallback(() => {
    if (!autoSaveEnabled) return;

    const activeFile = getActiveFile();
    if (!activeFile || !activeFile.isDirty) return;

    // Avoid saving too frequently
    const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
    if (timeSinceLastSave < DEBOUNCE_DELAY) {
      return;
    }

    debouncedSave();
  }, [autoSaveEnabled, getActiveFile, debouncedSave]);

  /**
   * Set up periodic check interval
   */
  useEffect(() => {
    if (!autoSaveEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      checkAndSave();
    }, AUTO_SAVE_INTERVAL);


    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [autoSaveEnabled, checkAndSave]);

  /**
   * Monitor dirty state changes and trigger debounced save
   */
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const activeFile = getActiveFile();
    if (activeFile?.isDirty) {
      debouncedSave();
    }
  }, [autoSaveEnabled, getActiveFile, debouncedSave]);

  return {
    performSave,
    isAutoSaveEnabled: autoSaveEnabled,
  };
};
