import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { storageAdapter } from '../adapters/storage/storage.adapter';

const STORAGE_KEY = 'libreuml-backup';

/**
 * Auto Restore Hook
 *
 * Restores the last session backup if restoreSession is enabled.
 * Zustand persist middleware handles automatic restoration of stores.
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
        hasRestoredRef.current = true;
      }
    } catch (error) {
      console.error('[AutoRestore] Error checking backup:', error);
    }
  }, [restoreSessionEnabled]);
};
