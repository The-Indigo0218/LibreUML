import { useSyncExternalStore, useCallback } from 'react';
import type { UndoEntry } from './types';
import type { UndoManager } from './UndoManager';

export interface UseUndoManagerResult {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  clear: () => void;
}

export function useUndoManager(manager: UndoManager, scope?: string): UseUndoManagerResult {
  useSyncExternalStore(
    (listener) => manager.subscribe(listener),
    () => manager.getSnapshot(),
  );

  const undo = useCallback(() => manager.undo(scope), [manager, scope]);
  const redo = useCallback(() => manager.redo(scope), [manager, scope]);
  const clear = useCallback(() => manager.clear(), [manager]);

  return {
    canUndo: manager.canUndo(scope),
    canRedo: manager.canRedo(scope),
    undo,
    redo,
    undoStack: manager.getUndoStack(scope),
    redoStack: manager.getRedoStack(scope),
    clear,
  };
}
