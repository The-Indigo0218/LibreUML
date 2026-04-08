import type { Patch } from 'immer';

export type StoreKey = 'model' | 'vfs';

export interface StorePatchSet {
  store: StoreKey;
  patches: Patch[];
  inversePatches: Patch[];
}

export interface UndoEntry {
  id: string;
  label: string;
  timestamp: number;
  scope: string;
  patchSets: StorePatchSet[];
  affectedElementIds?: string[];
}

export interface UndoManagerConfig {
  limit: number;
  stores: Record<StoreKey, {
    getState: () => unknown;
    setState: (state: unknown) => void;
  }>;
}

export interface UndoSnapshot {
  canUndo: boolean;
  canRedo: boolean;
  cursor: number;
  length: number;
}
