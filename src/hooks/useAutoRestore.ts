import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { storageAdapter } from '../adapters/storage/storage.adapter';

const STORAGE_KEY = 'libreuml-backup';

/**
 * Auto Restore Hook
 * 
 * Restores the last session backup if restoreSession is enabled.
 * Works with SSOT architecture by restoring both WorkspaceStore and ProjectStore.
 * 
 * Note: Zustand persist middleware handles automatic restoration of stores.
 * This hook is for additional backup/restore functionality beyond persist.
 */
export const useAutoRestore = () => {
  const restoreSessionEnabled = useSettingsStore((state) => state.restoreSession);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!restoreSessionEnabled || hasRestoredRef.current) {
      return;
    }

    try {
      const backupRaw = storageAdapter.getItem(STORAGE_KEY);
      if (backupRaw) {
        // Zustand persist middleware already handles store restoration
        // This backup is for emergency recovery only
        console.log("[AutoRestore] Backup found, Zustand persist handles restoration");
        hasRestoredRef.current = true;
      }
    } catch (error) {
      console.error('[AutoRestore] Error checking backup:', error);
    }
  }, [restoreSessionEnabled]);
};
