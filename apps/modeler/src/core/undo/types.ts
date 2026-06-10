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
  /**
   * Monotonic sequence number assigned by the UndoManager at record time.
   * Used to order entries chronologically *across* independent timelines
   * (per-file view timelines + the shared model timeline). Internal field.
   */
  seq?: number;
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
