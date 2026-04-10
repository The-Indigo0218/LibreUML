import { useEffect, useRef, useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';

/**
 * VFS Auto-Save Hook (MAG-01.9 + MAG-01.22 Fix)
 *
 * Monitors VFS project changes and provides save feedback.
 * Actual persistence is handled by Zustand's persist middleware.
 *
 * Usage:
 * - Call useVFSAutoSave() in DiagramEditor
 * - Call flushSave() from Ctrl+S handler for instant feedback
 */

const DEBOUNCE_DELAY = 2000; // 2 seconds (increased from 500ms per MAG-01.22)

export interface UseVFSAutoSaveResult {
  flushSave: () => Promise<boolean>;
  isSaving: boolean;
}

let globalFlushSave: (() => Promise<boolean>) | null = null;

export async function flushVFSSave(): Promise<boolean> {
  if (globalFlushSave) {
    return globalFlushSave();
  }
  console.warn('[VFSAutoSave] flushVFSSave called but no active auto-save hook');
  return false;
}

export function useVFSAutoSave(): UseVFSAutoSaveResult {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdatedAtRef = useRef<number>(0);

  const provideSaveFeedback = useCallback((): boolean => {
    const project = useVFSStore.getState().project;
    if (!project) {
      console.log('[VFSAutoSave] No active project');
      return false;
    }

    if (project.updatedAt === lastUpdatedAtRef.current) {
      console.log('[VFSAutoSave] No changes since last save feedback');
      return false;
    }

    lastUpdatedAtRef.current = project.updatedAt;
    console.log(`[VFSAutoSave] ✓ Project "${project.projectName}" persisted (Zustand middleware)`);
    return true;
  }, []);

  const debouncedSaveFeedback = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      provideSaveFeedback();
    }, DEBOUNCE_DELAY);
  }, [provideSaveFeedback]);

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const success = provideSaveFeedback();
    return success;
  }, [provideSaveFeedback]);

  useEffect(() => {
    globalFlushSave = flushSave;

    const unsubscribe = useVFSStore.subscribe((state, prevState) => {
      const updatedAt = state.project?.updatedAt;
      const prevUpdatedAt = prevState.project?.updatedAt;
      if (updatedAt === undefined) return; 
      if (updatedAt === prevUpdatedAt) return; 

      console.log('[VFSAutoSave] Project updated (auto-persisted by Zustand)');
      debouncedSaveFeedback();
    });

    return () => {
      unsubscribe();
      // Unregister global flushSave
      globalFlushSave = null;
      // Cancel pending feedback on unmount
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [debouncedSaveFeedback, flushSave]);

  return {
    flushSave,
    isSaving: false, 
  };
}
