import { applyPatches } from 'immer';
import type { UndoEntry, UndoManagerConfig, UndoSnapshot } from './types';

export class UndoManager {
  private timeline: UndoEntry[] = [];
  private cursor: number = -1;
  private config: UndoManagerConfig;
  private listeners: Set<() => void> = new Set();
  private recording: boolean = true;

  constructor(config: UndoManagerConfig) {
    this.config = config;
  }

  record(entry: UndoEntry): void {
    if (!this.recording) return;

    this.timeline = this.timeline.slice(0, this.cursor + 1);
    this.timeline.push(entry);
    this.cursor = this.timeline.length - 1;

    if (this.timeline.length > this.config.limit) {
      const overflow = this.timeline.length - this.config.limit;
      this.timeline = this.timeline.slice(overflow);
      this.cursor -= overflow;
    }

    this.notify();
  }

  undo(scope?: string): void {
    const idx = this.findUndoIndex(scope);
    if (idx === -1) return;

    const entry = this.timeline[idx];

    for (let i = entry.patchSets.length - 1; i >= 0; i--) {
      const ps = entry.patchSets[i];
      const store = this.config.stores[ps.store];
      const nextState = applyPatches(store.getState(), ps.inversePatches);
      this.recording = false;
      store.setState(nextState);
      this.recording = true;
    }

    this.cursor = idx - 1;
    this.notify();
  }

  redo(scope?: string): void {
    const idx = this.findRedoIndex(scope);
    if (idx === -1) return;

    const entry = this.timeline[idx];

    for (const ps of entry.patchSets) {
      const store = this.config.stores[ps.store];
      const nextState = applyPatches(store.getState(), ps.patches);
      this.recording = false;
      store.setState(nextState);
      this.recording = true;
    }

    this.cursor = idx;
    this.notify();
  }

  canUndo(scope?: string): boolean {
    return this.findUndoIndex(scope) !== -1;
  }

  canRedo(scope?: string): boolean {
    return this.findRedoIndex(scope) !== -1;
  }

  getUndoStack(scope?: string): UndoEntry[] {
    const stack = this.timeline.slice(0, this.cursor + 1);
    if (!scope) return stack;
    return stack.filter((e) => e.scope === scope || e.scope === 'global');
  }

  getRedoStack(scope?: string): UndoEntry[] {
    const stack = this.timeline.slice(this.cursor + 1);
    if (!scope) return stack;
    return stack.filter((e) => e.scope === scope || e.scope === 'global');
  }

  clear(): void {
    this.timeline = [];
    this.cursor = -1;
    this.notify();
  }

  pause(): void {
    this.recording = false;
  }

  resume(): void {
    this.recording = true;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): UndoSnapshot {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      cursor: this.cursor,
      length: this.timeline.length,
    };
  }

  getStores(): UndoManagerConfig['stores'] {
    return this.config.stores;
  }

  private findUndoIndex(scope?: string): number {
    for (let i = this.cursor; i >= 0; i--) {
      const entry = this.timeline[i];
      if (!scope || entry.scope === scope || entry.scope === 'global') {
        return i;
      }
    }
    return -1;
  }

  private findRedoIndex(scope?: string): number {
    for (let i = this.cursor + 1; i < this.timeline.length; i++) {
      const entry = this.timeline[i];
      if (!scope || entry.scope === scope || entry.scope === 'global') {
        return i;
      }
    }
    return -1;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
