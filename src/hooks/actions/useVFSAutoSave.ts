import { useEffect, useRef, useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { downloadProject } from '../../services/projectIO.service';
import { useToastStore } from '../../store/toast.store';

/**
 * VFS Auto-Save Hook (MAG-01.9)
 *
 * Implements debounced auto-save for VFS projects:
 * - Monitors VFSStore.project.updatedAt changes
 * - Debounces saves to 500ms after last change
 * - Persists to disk via downloadProject()
 * - Exposes flushSave() for immediate Ctrl+S saves
 *
 * Architecture:
 * - Position changes wrapped in withoutUndo() don't pollute undo history
 * - Semantic changes (create/delete) trigger normal saves with undo
 * - Debounce prevents excessive disk writes during rapid edits
 * - Save indicator shows when saving (optional, nice to have)
 *
 * Usage:
 * - Call useVFSAutoSave() in DiagramEditor or KonvaCanvas
 * - Call flushSave() from Ctrl+S handler for immediate save
 */

const DEBOUNCE_DELAY = 500; // 500ms as per MAG-01.9 spec

export interface UseVFSAutoSaveResult {
  /** Immediately flushes pending debounced save and triggers a new save */
  flushSave: () => Promise<boolean>;
  /** Whether a save is currently in progress */
  isSaving: boolean;
}

// Global ref to store the flushSave function for keyboard shortcuts
let globalFlushSave: (() => Promise<boolean>) | null = null;

/**
 * Standalone function to trigger immediate VFS save from anywhere.
 * Used by keyboard shortcuts (Ctrl+S) to bypass debounce.
 */
export async function flushVFSSave(): Promise<boolean> {
  if (globalFlushSave) {
    return globalFlushSave();
  }
  console.warn('[VFSAutoSave] flushVFSSave called but no active auto-save hook');
  return false;
}

export function useVFSAutoSave(): UseVFSAutoSaveResult {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const lastSaveTimeRef = useRef<number>(0);
  const lastUpdatedAtRef = useRef<number>(0);

  const showToast = useToastStore((s) => s.show);

  /**
   * Performs the actual save operation.
   * Downloads the project as .luml.zip to the user's downloads folder.
   */
  const performSave = useCallback(async (): Promise<boolean> => {
    if (isSavingRef.current) {
      console.log('[VFSAutoSave] Save already in progress, skipping');
      return false;
    }

    const project = useVFSStore.getState().project;
    if (!project) {
      console.log('[VFSAutoSave] No active project, skipping');
      return false;
    }

    // Check if there are actual changes since last save
    if (project.updatedAt === lastUpdatedAtRef.current) {
      console.log('[VFSAutoSave] No changes since last save, skipping');
      return false;
    }

    try {
      isSavingRef.current = true;
      const startTime = Date.now();

      await downloadProject();

      const duration = Date.now() - startTime;
      lastSaveTimeRef.current = Date.now();
      lastUpdatedAtRef.current = project.updatedAt;

      console.log(
        `[VFSAutoSave] ✓ Saved project "${project.projectName}" (${duration}ms)`,
      );
      return true;
    } catch (error) {
      console.error('[VFSAutoSave] Error saving project:', error);
      showToast('⚠️ Save failed');
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [showToast]);

  /**
   * Debounced save - waits for user to stop making changes.
   * Cancels previous pending save and schedules a new one.
   */
  const debouncedSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSave();
    }, DEBOUNCE_DELAY);
  }, [performSave]);

  /**
   * Immediately flushes pending debounced save and triggers a new save.
   * Used by Ctrl+S handler for instant save feedback.
   */
  const flushSave = useCallback(async (): Promise<boolean> => {
    // Cancel pending debounced save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // Perform immediate save
    return performSave();
  }, [performSave]);

  /**
   * Watch VFSStore.project.updatedAt for changes.
   * Trigger debounced save when project is modified.
   */
  useEffect(() => {
    // Register global flushSave function for keyboard shortcuts
    globalFlushSave = flushSave;

    const unsubscribe = useVFSStore.subscribe((state, prevState) => {
      const updatedAt = state.project?.updatedAt;
      const prevUpdatedAt = prevState.project?.updatedAt;
      if (updatedAt === undefined) return; // No project loaded
      if (updatedAt === prevUpdatedAt) return; // No change

      console.log('[VFSAutoSave] Project updated, scheduling save...');
      debouncedSave();
    });

    return () => {
      unsubscribe();
      // Unregister global flushSave
      globalFlushSave = null;
      // Cancel pending save on unmount
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [debouncedSave, flushSave]);

  return {
    flushSave,
    isSaving: isSavingRef.current,
  };
}
