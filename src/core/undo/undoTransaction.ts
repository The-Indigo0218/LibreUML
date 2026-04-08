import { produceWithPatches } from 'immer';
import type { StoreKey, StorePatchSet } from './types';
import type { UndoManager } from './UndoManager';

export interface TransactionSpec {
  label: string;
  scope: string;
  mutations: Array<{
    store: StoreKey;
    mutate: (draft: any) => void;
  }>;
  affectedElementIds?: string[];
}

export function undoTransaction(
  spec: TransactionSpec,
  manager: UndoManager,
  stores: Record<StoreKey, { getState: () => unknown; setState: (s: unknown) => void }>,
): void {
  const patchSets: StorePatchSet[] = [];

  for (const mutation of spec.mutations) {
    const store = stores[mutation.store];
    const currentState = store.getState();

    const [nextState, patches, inversePatches] = produceWithPatches(
      currentState as object,
      mutation.mutate,
    );

    if (patches.length === 0) continue;

    manager.pause();
    store.setState(nextState);
    manager.resume();

    patchSets.push({ store: mutation.store, patches, inversePatches });
  }

  if (patchSets.length > 0) {
    manager.record({
      id: crypto.randomUUID(),
      label: spec.label,
      timestamp: Date.now(),
      scope: spec.scope,
      patchSets,
      affectedElementIds: spec.affectedElementIds,
    });
  }
}

export function withUndo(
  store: StoreKey,
  label: string,
  scope: string,
  mutate: (draft: any) => void,
  manager: UndoManager,
  stores: Record<StoreKey, { getState: () => unknown; setState: (s: unknown) => void }>,
): void {
  undoTransaction({ label, scope, mutations: [{ store, mutate }] }, manager, stores);
}
