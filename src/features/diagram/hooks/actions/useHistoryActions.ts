import { useCallback } from 'react';
import { useStore } from 'zustand';
import { useProjectStore } from '../../../../store/project.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import type { TemporalState } from 'zundo';

/**
 * History Actions Hook
 * 
 * Provides undo/redo functionality for both ProjectStore and WorkspaceStore.
 * Uses zundo temporal middleware for time-travel debugging.
 * 
 * Features:
 * - Undo: Revert to previous state (nodes/edges + positions)
 * - Redo: Move forward to next state
 * - Clear history: Reset timeline
 * - History state: Check if undo/redo available
 * 
 * Architecture:
 * - ProjectStore tracks: nodes and edges (domain data)
 * - WorkspaceStore tracks: positionMap (UI layout)
 * - Both stores synchronized for coordinated undo/redo
 * - Limited to 50 steps (memory management)
 * - History NOT persisted (memory only)
 */

// Type for the partialized ProjectStore state (only nodes and edges)
interface PartializedProjectState {
  nodes: Record<string, any>;
  edges: Record<string, any>;
}

// Type for the partialized WorkspaceStore state (only files with positionMap)
interface PartializedWorkspaceState {
  files: any[];
}

/**
 * Custom hook to access ProjectStore temporal state reactively
 */
const useProjectTemporalStore = <T,>(
  selector: (state: TemporalState<PartializedProjectState>) => T,
): T => {
  return useStore(useProjectStore.temporal, selector);
};

/**
 * Custom hook to access WorkspaceStore temporal state reactively
 */
const useWorkspaceTemporalStore = <T,>(
  selector: (state: TemporalState<PartializedWorkspaceState>) => T,
): T => {
  return useStore(useWorkspaceStore.temporal, selector);
};

export const useHistoryActions = () => {
  // Get temporal state from both stores
  const projectTemporal = useProjectTemporalStore((state) => state);
  const workspaceTemporal = useWorkspaceTemporalStore((state) => state);

  /**
   * Undo the last action
   * Reverts both ProjectStore and WorkspaceStore to previous state
   */
  const handleUndo = useCallback(() => {
    const canUndoProject = projectTemporal.pastStates.length > 0;
    const canUndoWorkspace = workspaceTemporal.pastStates.length > 0;

    if (canUndoProject || canUndoWorkspace) {
      // Undo both stores synchronously
      if (canUndoProject) projectTemporal.undo();
      if (canUndoWorkspace) workspaceTemporal.undo();
      console.log('[History] Undo - Reverted to previous state');
    } else {
      console.log('[History] Undo - No more history');
    }
  }, [projectTemporal, workspaceTemporal]);

  /**
   * Redo the last undone action
   * Moves both stores forward to next state
   */
  const handleRedo = useCallback(() => {
    const canRedoProject = projectTemporal.futureStates.length > 0;
    const canRedoWorkspace = workspaceTemporal.futureStates.length > 0;

    if (canRedoProject || canRedoWorkspace) {
      // Redo both stores synchronously
      if (canRedoProject) projectTemporal.redo();
      if (canRedoWorkspace) workspaceTemporal.redo();
      console.log('[History] Redo - Moved to next state');
    } else {
      console.log('[History] Redo - No more future states');
    }
  }, [projectTemporal, workspaceTemporal]);

  /**
   * Clear all history from both stores
   */
  const clearHistory = useCallback(() => {
    projectTemporal.clear();
    workspaceTemporal.clear();
    console.log('[History] Cleared all history');
  }, [projectTemporal, workspaceTemporal]);

  /**
   * Pause history tracking (useful during drag operations)
   */
  const pauseTracking = useCallback(() => {
    projectTemporal.pause();
    workspaceTemporal.pause();
  }, [projectTemporal, workspaceTemporal]);

  /**
   * Resume history tracking
   */
  const resumeTracking = useCallback(() => {
    projectTemporal.resume();
    workspaceTemporal.resume();
  }, [projectTemporal, workspaceTemporal]);

  /**
   * Check if undo is available in either store
   */
  const canUndo = projectTemporal.pastStates.length > 0 || workspaceTemporal.pastStates.length > 0;

  /**
   * Check if redo is available in either store
   */
  const canRedo = projectTemporal.futureStates.length > 0 || workspaceTemporal.futureStates.length > 0;

  /**
   * Get combined history statistics
   */
  const historyStats = {
    pastCount: Math.max(projectTemporal.pastStates.length, workspaceTemporal.pastStates.length),
    futureCount: Math.max(projectTemporal.futureStates.length, workspaceTemporal.futureStates.length),
    totalSteps: Math.max(
      projectTemporal.pastStates.length + projectTemporal.futureStates.length,
      workspaceTemporal.pastStates.length + workspaceTemporal.futureStates.length
    ),
  };

  /**
   * Get combined past states (use project store as primary)
   */
  const pastStates = projectTemporal.pastStates;

  /**
   * Get combined future states (use project store as primary)
   */
  const futureStates = projectTemporal.futureStates;

  return {
    undo: handleUndo,
    redo: handleRedo,
    clearHistory,
    pauseTracking,
    resumeTracking,
    canUndo,
    canRedo,
    historyStats,
    pastStates,
    futureStates,
  };
};
