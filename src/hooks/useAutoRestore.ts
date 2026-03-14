import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';

const STORAGE_KEY = 'libreuml-backup';

/**
 * TODO: SSOT Migration - AutoRestore
 * 
 * This hook needs to be rewritten to restore SSOT format:
 * - Restore WorkspaceStore state (files, activeFileId)
 * - Restore ProjectStore state (nodes, edges)
 * - Handle viewport restoration per file
 * 
 * For now, disabled to prevent build errors.
 */
export const useAutoRestore = () => {
  const restoreSessionEnabled = useSettingsStore((state) => state.restoreSession);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!restoreSessionEnabled || hasRestoredRef.current) {
      return;
    }

    try {
      const backupRaw = localStorage.getItem(STORAGE_KEY);
      if (backupRaw) {
        // TODO: Implement SSOT-compatible restore
        // Need to deserialize and populate WorkspaceStore + ProjectStore
        console.warn("[AutoRestore] TODO: SSOT restore not implemented");
        hasRestoredRef.current = true;
      }
    } catch (error) {
      console.error('[AutoRestore] Error restoring backup:', error);
    }
  }, [restoreSessionEnabled]);
};
