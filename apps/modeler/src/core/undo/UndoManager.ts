import { applyPatches } from 'immer';
import type { UndoEntry, UndoManagerConfig, UndoSnapshot } from './types';

/**
 * Key of the shared timeline that owns every change to the *model* store
 * (the semantic model is shared across diagrams, so its undo axis is global).
 */
const GLOBAL_SCOPE = 'global';

interface Timeline {
  entries: UndoEntry[];
  cursor: number;
}

/**
 * Undo/redo with **independent timelines per scope** (Option A).
 *
 * Each open file has its own *view* timeline (keyed by its tabId / scope),
 * while every change that touches the shared `model` store is routed to a
 * single, dedicated **global** timeline. This is what makes undo/redo truly
 * independent per file:
 *
 *  - `record()` truncates only the affected timeline → a new edit in file B
 *    can never wipe file A's redo stack (historic Bug 1).
 *  - Each timeline owns its own cursor → interleaved undos across files can no
 *    longer desync a shared pointer (historic Bug 2).
 *  - Model changes live on the global axis and are intentionally undoable from
 *    any diagram, instead of leaking into one arbitrary file's stack (Bug 3).
 *
 * Default UX (validated with owner in the PR): `Ctrl+Z` from a file undoes the
 * most recent action across `{ that file's view timeline, the global model
 * timeline }`. Because the model is global by nature, undoing it from whichever
 * diagram is focused is correct.
 */
export class UndoManager {
  private timelines: Map<string, Timeline> = new Map();
  private config: UndoManagerConfig;
  private listeners: Set<() => void> = new Set();
  private recording: boolean = true;
  private cachedSnapshot: UndoSnapshot | null = null;
  private seqCounter: number = 0;

  constructor(config: UndoManagerConfig) {
    this.config = config;
  }

  record(entry: UndoEntry): void {
    if (!this.recording) return;

    entry.seq = ++this.seqCounter;
    const tl = this.getTimeline(this.routeKey(entry));

    tl.entries = tl.entries.slice(0, tl.cursor + 1);
    tl.entries.push(entry);
    tl.cursor = tl.entries.length - 1;

    if (tl.entries.length > this.config.limit) {
      const overflow = tl.entries.length - this.config.limit;
      tl.entries = tl.entries.slice(overflow);
      tl.cursor -= overflow;
    }

    this.notify();
  }

  undo(scope?: string): void {
    const picked = this.pickUndo(scope);
    if (!picked) return;

    const { tl } = picked;
    const entry = tl.entries[tl.cursor];

    for (let i = entry.patchSets.length - 1; i >= 0; i--) {
      const ps = entry.patchSets[i];
      const store = this.config.stores[ps.store];
      const nextState = applyPatches(store.getState() as object, ps.inversePatches);
      this.recording = false;
      store.setState(nextState);
      this.recording = true;
    }

    tl.cursor -= 1;
    this.notify();
  }

  redo(scope?: string): void {
    const picked = this.pickRedo(scope);
    if (!picked) return;

    const { tl } = picked;
    const entry = tl.entries[tl.cursor + 1];

    for (const ps of entry.patchSets) {
      const store = this.config.stores[ps.store];
      const nextState = applyPatches(store.getState() as object, ps.patches);
      this.recording = false;
      store.setState(nextState);
      this.recording = true;
    }

    tl.cursor += 1;
    this.notify();
  }

  canUndo(scope?: string): boolean {
    return this.pickUndo(scope) !== null;
  }

  canRedo(scope?: string): boolean {
    return this.pickRedo(scope) !== null;
  }

  /** Applied entries (undoable), merged across the scope's candidate timelines, oldest → newest. */
  getUndoStack(scope?: string): UndoEntry[] {
    const out: UndoEntry[] = [];
    for (const key of this.candidateKeys(scope)) {
      const tl = this.timelines.get(key);
      if (!tl) continue;
      out.push(...tl.entries.slice(0, tl.cursor + 1));
    }
    return out.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  }

  /** Undone entries (redoable), merged across the scope's candidate timelines, oldest → newest. */
  getRedoStack(scope?: string): UndoEntry[] {
    const out: UndoEntry[] = [];
    for (const key of this.candidateKeys(scope)) {
      const tl = this.timelines.get(key);
      if (!tl) continue;
      out.push(...tl.entries.slice(tl.cursor + 1));
    }
    return out.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  }

  clear(): void {
    this.timelines.clear();
    this.notify();
  }

  /** Drop a single file's view timeline (call on tab/file close to avoid leaks). */
  clearScope(scope: string): void {
    if (this.timelines.delete(scope)) {
      this.notify();
    }
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
    if (this.cachedSnapshot === null) {
      let length = 0;
      let applied = 0;
      for (const tl of this.timelines.values()) {
        length += tl.entries.length;
        applied += tl.cursor + 1;
      }
      this.cachedSnapshot = {
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        cursor: applied - 1,
        length,
      };
    }
    return this.cachedSnapshot;
  }

  getStores(): UndoManagerConfig['stores'] {
    return this.config.stores;
  }

  /**
   * Decide which timeline owns an entry. Any transaction that mutates the
   * shared `model` store is a global/model action; everything else (pure view
   * edits: move node, waypoint, color, add/remove view node) is per-file.
   */
  private routeKey(entry: UndoEntry): string {
    const touchesModel = entry.patchSets.some((ps) => ps.store === 'model');
    return touchesModel ? GLOBAL_SCOPE : entry.scope;
  }

  private getTimeline(key: string): Timeline {
    let tl = this.timelines.get(key);
    if (!tl) {
      tl = { entries: [], cursor: -1 };
      this.timelines.set(key, tl);
    }
    return tl;
  }

  /** Timelines eligible for an undo/redo at this scope: the file's own + the global axis. */
  private candidateKeys(scope?: string): string[] {
    if (scope === undefined) return [...this.timelines.keys()];
    if (scope === GLOBAL_SCOPE) return [GLOBAL_SCOPE];
    return [scope, GLOBAL_SCOPE];
  }

  /** The most recent undoable entry across candidate timelines (highest seq wins). */
  private pickUndo(scope?: string): { tl: Timeline } | null {
    let best: { tl: Timeline; seq: number } | null = null;
    for (const key of this.candidateKeys(scope)) {
      const tl = this.timelines.get(key);
      if (!tl || tl.cursor < 0) continue;
      const seq = tl.entries[tl.cursor].seq ?? 0;
      if (!best || seq > best.seq) best = { tl, seq };
    }
    return best ? { tl: best.tl } : null;
  }

  /** The next entry to redo across candidate timelines (oldest undone first → lowest seq wins). */
  private pickRedo(scope?: string): { tl: Timeline } | null {
    let best: { tl: Timeline; seq: number } | null = null;
    for (const key of this.candidateKeys(scope)) {
      const tl = this.timelines.get(key);
      if (!tl || tl.cursor + 1 >= tl.entries.length) continue;
      const seq = tl.entries[tl.cursor + 1].seq ?? 0;
      if (!best || seq < best.seq) best = { tl, seq };
    }
    return best ? { tl: best.tl } : null;
  }

  private notify(): void {
    this.cachedSnapshot = null;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
