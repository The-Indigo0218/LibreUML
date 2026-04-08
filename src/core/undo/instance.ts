import { UndoManager } from './UndoManager';
import { undoTransaction as _undoTransaction, withUndo as _withUndo } from './undoTransaction';
import { _registerUndoBridge } from './undoBridge';
import type { TransactionSpec } from './undoTransaction';
import type { StoreKey } from './types';
import { useModelStore } from '../../store/model.store';
import { useVFSStore } from '../../store/project-vfs.store';

export const undoManager = new UndoManager({
  limit: 100,
  stores: {
    model: {
      getState: () => useModelStore.getState(),
      setState: (state) => useModelStore.setState(state as ReturnType<typeof useModelStore.getState>),
    },
    vfs: {
      getState: () => useVFSStore.getState(),
      setState: (state) => useVFSStore.setState(state as ReturnType<typeof useVFSStore.getState>),
    },
  },
});

export function undoTransaction(spec: TransactionSpec): void {
  _undoTransaction(spec, undoManager, undoManager.getStores());
}

export function withUndo(
  store: StoreKey,
  label: string,
  scope: string,
  mutate: (draft: any) => void,
): void {
  _withUndo(store, label, scope, mutate, undoManager, undoManager.getStores());
}

_registerUndoBridge(undoManager, withUndo, undoTransaction);
