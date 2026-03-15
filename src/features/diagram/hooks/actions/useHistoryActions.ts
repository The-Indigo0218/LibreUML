import { useCallback } from 'react';
import { useFileHistory } from './useFileHistory';

/**
 * History Actions Hook
 * 
 * PHASE 9.6.3: Refactored to use per-file history system
 * 
 * This hook now delegates to useFileHistory which manages independent
 * Undo/Redo stacks for each diagram file. This replaces the failed
 * Zundo-based approach that caused history "Amnesia" on tab switches.
 * 
 * Architecture:
 * - Each DiagramFile stores its own history in file.data.history
 * - History is serializable and persists with the file
 * - No global Zundo state to corrupt or lose
 * - Scales to unlimited open files
 * 
 * Backward Compatibility:
 * - Zundo temporal middleware remains on ProjectStore for potential future use
 * - This hook provides the same API as before, just with better implementation
 */
export const useHistoryActions = () => {
  const fileHistory = useFileHistory();

  /**
   * Undo the last action in the current file
   */
  const handleUndo = useCallback(() => {
    fileHistory.undo();
  }, [fileHistory]);

  /**
   * Redo the last undone action in the current file
   */
  const handleRedo = useCallback(() => {
    fileHistory.redo();
  }, [fileHistory]);

  /**
   * Clear all history for the current file
   */
  const clearHistory = useCallback(() => {
    fileHistory.clearHistory();
  }, [fileHistory]);

  /**
   * Pause/resume tracking - delegated to useFileHistory
   * Note: These are no-ops in the new system since we manually call saveSnapshot
   */
  const pauseTracking = useCallback(() => {
    // No-op: New system doesn't auto-track, snapshots are saved manually
    console.log('[History] Pause tracking (no-op in per-file system)');
  }, []);

  const resumeTracking = useCallback(() => {
    // No-op: New system doesn't auto-track, snapshots are saved manually
    console.log('[History] Resume tracking (no-op in per-file system)');
  }, []);

  return {
    undo: handleUndo,
    redo: handleRedo,
    clearHistory,
    pauseTracking,
    resumeTracking,
    canUndo: fileHistory.canUndo,
    canRedo: fileHistory.canRedo,
    historyStats: fileHistory.historyStats,
    pastStates: [], // Deprecated: kept for backward compatibility
    futureStates: [], // Deprecated: kept for backward compatibility
    
    // Expose saveSnapshot for manual history tracking
    saveSnapshot: fileHistory.saveSnapshot,
  };
};
