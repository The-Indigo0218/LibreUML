import { useCallback } from 'react';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useProjectStore } from '../../../../store/project.store';
import {
  createEmptyHistory,
  createSnapshot,
  pushSnapshot,
  performUndo,
  performRedo,
  clearHistory as clearHistoryUtil,
  canUndo as canUndoUtil,
  canRedo as canRedoUtil,
  type FileHistory,
} from '../../../../core/domain/workspace/history.types';

export const useFileHistory = () => {
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const projectStore = useProjectStore();

  const getCurrentHistory = useCallback((): FileHistory | null => {
    const file = getActiveFile();
    if (!file) return null;
    
    return file.data.history || createEmptyHistory();
  }, [getActiveFile]);

  const saveSnapshot = useCallback(() => {
    const file = getActiveFile();
    if (!file) return;

    const nodes = Object.values(projectStore.nodes);
    const edges = Object.values(projectStore.edges);
    
    const currentHistory = file.data.history || createEmptyHistory();
    const snapshot = createSnapshot(nodes, edges);
    const newHistory = pushSnapshot(currentHistory, snapshot);

    updateFile(file.id, {
      data: {
        ...file.data,
        history: newHistory,
      },
    });

    console.log(`[FileHistory] Snapshot saved (${newHistory.past.length} past, ${newHistory.future.length} future)`);
  }, [getActiveFile, projectStore, updateFile]);

  const undo = useCallback(() => {
    const file = getActiveFile();
    if (!file) return;

    const currentHistory = file.data.history || createEmptyHistory();
    const currentNodes = Object.values(projectStore.nodes);
    const currentEdges = Object.values(projectStore.edges);

    const { history: newHistory, snapshot } = performUndo(
      currentHistory,
      currentNodes,
      currentEdges
    );

    if (!snapshot) {
      console.log('[FileHistory] Undo - No more history');
      return;
    }

    const temporal = useProjectStore.temporal.getState();
    temporal.pause();

    projectStore.clearAll();
    if (snapshot.nodes.length > 0) {
      projectStore.addNodes(snapshot.nodes);
    }
    if (snapshot.edges.length > 0) {
      projectStore.addEdges(snapshot.edges);
    }

    temporal.resume();

    updateFile(file.id, {
      data: {
        ...file.data,
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        history: newHistory,
      },
    });

    console.log(`[FileHistory] Undo - Restored state (${newHistory.past.length} past, ${newHistory.future.length} future)`);
  }, [getActiveFile, projectStore, updateFile]);

  const redo = useCallback(() => {
    const file = getActiveFile();
    if (!file) return;

    const currentHistory = file.data.history || createEmptyHistory();
    const currentNodes = Object.values(projectStore.nodes);
    const currentEdges = Object.values(projectStore.edges);

    const { history: newHistory, snapshot } = performRedo(
      currentHistory,
      currentNodes,
      currentEdges
    );

    if (!snapshot) {
      console.log('[FileHistory] Redo - No more future states');
      return;
    }

    const temporal = useProjectStore.temporal.getState();
    temporal.pause();

    projectStore.clearAll();
    if (snapshot.nodes.length > 0) {
      projectStore.addNodes(snapshot.nodes);
    }
    if (snapshot.edges.length > 0) {
      projectStore.addEdges(snapshot.edges);
    }

    temporal.resume();

    updateFile(file.id, {
      data: {
        ...file.data,
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        history: newHistory,
      },
    });

    console.log(`[FileHistory] Redo - Restored state (${newHistory.past.length} past, ${newHistory.future.length} future)`);
  }, [getActiveFile, projectStore, updateFile]);

  /**
   * Clear all history for the current file
   */
  const clearHistory = useCallback(() => {
    const file = getActiveFile();
    if (!file) return;

    const currentHistory = file.data.history || createEmptyHistory();
    const newHistory = clearHistoryUtil(currentHistory);

    updateFile(file.id, {
      data: {
        ...file.data,
        history: newHistory,
      },
    });

    console.log('[FileHistory] Cleared all history');
  }, [getActiveFile, updateFile]);

  /**
   * Check if undo is available
   */
  const canUndo = useCallback((): boolean => {
    const history = getCurrentHistory();
    return history ? canUndoUtil(history) : false;
  }, [getCurrentHistory]);

  /**
   * Check if redo is available
   */
  const canRedo = useCallback((): boolean => {
    const history = getCurrentHistory();
    return history ? canRedoUtil(history) : false;
  }, [getCurrentHistory]);

  /**
   * Get history statistics for the current file
   */
  const getHistoryStats = useCallback(() => {
    const history = getCurrentHistory();
    if (!history) {
      return { pastCount: 0, futureCount: 0, totalSteps: 0 };
    }

    return {
      pastCount: history.past.length,
      futureCount: history.future.length,
      totalSteps: history.past.length + history.future.length,
    };
  }, [getCurrentHistory]);

  const jumpToPast = useCallback((index: number) => {
    const file = getActiveFile();
    if (!file) return;

    const currentHistory = file.data.history || createEmptyHistory();
    
    if (index < 0 || index >= currentHistory.past.length) {
      console.warn(`[FileHistory] Invalid past index: ${index}`);
      return;
    }

    const currentNodes = Object.values(projectStore.nodes);
    const currentEdges = Object.values(projectStore.edges);

    const targetSnapshot = currentHistory.past[index];

    const newPast = currentHistory.past.slice(0, index);
    const statesToMoveFuture = currentHistory.past.slice(index + 1);

    const currentSnapshot = createSnapshot(currentNodes, currentEdges);

    const newFuture = [...statesToMoveFuture, currentSnapshot, ...currentHistory.future];

    const temporal = useProjectStore.temporal.getState();
    temporal.pause();

    projectStore.clearAll();
    if (targetSnapshot.nodes.length > 0) {
      projectStore.addNodes(targetSnapshot.nodes);
    }
    if (targetSnapshot.edges.length > 0) {
      projectStore.addEdges(targetSnapshot.edges);
    }

    temporal.resume();

    const newHistory: FileHistory = {
      ...currentHistory,
      past: newPast,
      future: newFuture,
    };

    updateFile(file.id, {
      data: {
        ...file.data,
        nodes: targetSnapshot.nodes,
        edges: targetSnapshot.edges,
        history: newHistory,
      },
    });

    console.log(`[FileHistory] Jumped to past state ${index} (${newHistory.past.length} past, ${newHistory.future.length} future)`);
  }, [getActiveFile, projectStore, updateFile]);

  const jumpToFuture = useCallback((index: number) => {
    const file = getActiveFile();
    if (!file) return;

    const currentHistory = file.data.history || createEmptyHistory();
    
    if (index < 0 || index >= currentHistory.future.length) {
      console.warn(`[FileHistory] Invalid future index: ${index}`);
      return;
    }

    const currentNodes = Object.values(projectStore.nodes);
    const currentEdges = Object.values(projectStore.edges);

    const targetSnapshot = currentHistory.future[index];

    const statesToMovePast = currentHistory.future.slice(0, index);
    const newFuture = currentHistory.future.slice(index + 1);

    const currentSnapshot = createSnapshot(currentNodes, currentEdges);

    let newPast = [...currentHistory.past, currentSnapshot, ...statesToMovePast];

    if (newPast.length > currentHistory.maxSize) {
      const overflow = newPast.length - currentHistory.maxSize;
      newPast = newPast.slice(overflow);
    }

    const temporal = useProjectStore.temporal.getState();
    temporal.pause();

    projectStore.clearAll();
    if (targetSnapshot.nodes.length > 0) {
      projectStore.addNodes(targetSnapshot.nodes);
    }
    if (targetSnapshot.edges.length > 0) {
      projectStore.addEdges(targetSnapshot.edges);
    }

    temporal.resume();

    const newHistory: FileHistory = {
      ...currentHistory,
      past: newPast,
      future: newFuture,
    };

    updateFile(file.id, {
      data: {
        ...file.data,
        nodes: targetSnapshot.nodes,
        edges: targetSnapshot.edges,
        history: newHistory,
      },
    });

    console.log(`[FileHistory] Jumped to future state ${index} (${newHistory.past.length} past, ${newHistory.future.length} future)`);
  }, [getActiveFile, projectStore, updateFile]);

  /**
   * PHASE 9.7.1: Get formatted history for UI display
   */
  const getFormattedHistory = useCallback(() => {
    const history = getCurrentHistory();
    if (!history) {
      return { past: [], future: [] };
    }

    return {
      past: history.past.map((snapshot, index) => ({
        index,
        timestamp: snapshot.timestamp,
        nodeCount: snapshot.nodes.length,
        edgeCount: snapshot.edges.length,
      })),
      future: history.future.map((snapshot, index) => ({
        index,
        timestamp: snapshot.timestamp,
        nodeCount: snapshot.nodes.length,
        edgeCount: snapshot.edges.length,
      })),
    };
  }, [getCurrentHistory]);

  return {
    saveSnapshot,
    undo,
    redo,
    clearHistory,
    canUndo: canUndo(),
    canRedo: canRedo(),
    historyStats: getHistoryStats(),
    getCurrentHistory,
    jumpToPast,
    jumpToFuture,
    getFormattedHistory,
  };
};
