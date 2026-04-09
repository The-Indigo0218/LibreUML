import { useSyncExternalStore, useCallback, useMemo } from 'react';
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
  const snapshot = useSyncExternalStore(
    (listener) => manager.subscribe(listener),
    () => manager.getSnapshot(),
  );

  const undo = useCallback(() => manager.undo(scope), [manager, scope]);
  const redo = useCallback(() => manager.redo(scope), [manager, scope]);
  const clear = useCallback(() => manager.clear(), [manager]);

  // Derive scoped values from the stable snapshot so they only recompute when
  // the timeline actually changes (snapshot reference changes after notify()).
  const canUndo = useMemo(() => manager.canUndo(scope), [snapshot, manager, scope]);
  const canRedo = useMemo(() => manager.canRedo(scope), [snapshot, manager, scope]);
  const undoStack = useMemo(() => manager.getUndoStack(scope), [snapshot, manager, scope]);
  const redoStack = useMemo(() => manager.getRedoStack(scope), [snapshot, manager, scope]);

  return { canUndo, canRedo, undo, redo, undoStack, redoStack, clear };
}
