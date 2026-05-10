import { describe, it, expect, vi } from 'vitest';
import { enablePatches } from 'immer';
import { UndoManager } from '../UndoManager';
import { undoTransaction, withUndo } from '../undoTransaction';
import type { UndoManagerConfig } from '../types';

enablePatches();

interface ModelState { model: { name: string; value: number } | null }
interface VFSState { project: { nodes: Record<string, { label: string }> } | null }

function makeStores() {
  let modelState: ModelState = { model: { name: 'initial', value: 0 } };
  let vfsState: VFSState = { project: { nodes: {} } };

  const stores: UndoManagerConfig['stores'] = {
    model: {
      getState: () => modelState,
      setState: (s) => { modelState = s as ModelState; },
    },
    vfs: {
      getState: () => vfsState,
      setState: (s) => { vfsState = s as VFSState; },
    },
  };

  return { stores, getModel: () => modelState, getVFS: () => vfsState };
}

function makeManager(stores: UndoManagerConfig['stores'], limit = 10) {
  return new UndoManager({ limit, stores });
}

describe('UndoManager', () => {
  describe('record()', () => {
    it('adds an entry to the timeline', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.record({
        id: '1',
        label: 'test',
        timestamp: Date.now(),
        scope: 'global',
        patchSets: [],
      });

      expect(manager.getSnapshot().length).toBe(1);
      expect(manager.getSnapshot().cursor).toBe(0);
    });

    it('advances cursor on each record', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });
      manager.record({ id: '2', label: 'b', timestamp: 0, scope: 'global', patchSets: [] });

      expect(manager.getSnapshot().cursor).toBe(1);
      expect(manager.getSnapshot().length).toBe(2);
    });

    it('truncates future entries on new record after undo', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });
      manager.record({ id: '2', label: 'b', timestamp: 0, scope: 'global', patchSets: [] });

      // Simulate cursor being behind by directly testing undo then record
      // We need real patches for undo, so just manipulate cursor directly
      // Instead, test via the transaction API
      const { stores: txStores, getModel } = makeStores();
      const txManager = makeManager(txStores);

      undoTransaction(
        { label: 'set value 1', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 1; } }] },
        txManager, txStores,
      );
      undoTransaction(
        { label: 'set value 2', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 2; } }] },
        txManager, txStores,
      );

      txManager.undo();
      expect(getModel().model!.value).toBe(1);

      undoTransaction(
        { label: 'set value 3', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 3; } }] },
        txManager, txStores,
      );

      expect(txManager.getSnapshot().length).toBe(2);
      expect(txManager.getSnapshot().cursor).toBe(1);
    });

    it('enforces the history limit by dropping oldest entries', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores, 3);

      for (let i = 0; i < 5; i++) {
        manager.record({ id: String(i), label: `entry ${i}`, timestamp: 0, scope: 'global', patchSets: [] });
      }

      expect(manager.getSnapshot().length).toBe(3);
      expect(manager.getSnapshot().cursor).toBe(2);
    });

    it('does not record when paused', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.pause();
      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });
      manager.resume();

      expect(manager.getSnapshot().length).toBe(0);
    });
  });

  describe('canUndo() / canRedo()', () => {
    it('canUndo is false when timeline is empty', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);
      expect(manager.canUndo()).toBe(false);
    });

    it('canRedo is false when no undone entries', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);
      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });
      expect(manager.canRedo()).toBe(false);
    });

    it('canUndo becomes true after record', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);
      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });
      expect(manager.canUndo()).toBe(true);
    });

    it('canRedo becomes true after undo', () => {
      const { stores: txStores } = makeStores();
      const manager = makeManager(txStores);

      undoTransaction(
        { label: 'set', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 99; } }] },
        manager, txStores,
      );

      manager.undo();
      expect(manager.canRedo()).toBe(true);
      expect(manager.canUndo()).toBe(false);
    });
  });

  describe('undo()', () => {
    it('applies inverse patches to restore previous state', () => {
      const { stores, getModel } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        { label: 'rename', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.name = 'renamed'; } }] },
        manager, stores,
      );

      expect(getModel().model!.name).toBe('renamed');
      manager.undo();
      expect(getModel().model!.name).toBe('initial');
    });

    it('moves cursor back by one on linear undo', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        { label: 'a', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 1; } }] },
        manager, stores,
      );
      undoTransaction(
        { label: 'b', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 2; } }] },
        manager, stores,
      );

      expect(manager.getSnapshot().cursor).toBe(1);
      manager.undo();
      expect(manager.getSnapshot().cursor).toBe(0);
    });

    it('does nothing when there is nothing to undo', () => {
      const { stores, getModel } = makeStores();
      const manager = makeManager(stores);
      manager.undo();
      expect(getModel().model!.name).toBe('initial');
    });
  });

  describe('redo()', () => {
    it('re-applies forward patches', () => {
      const { stores, getModel } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        { label: 'rename', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.name = 'renamed'; } }] },
        manager, stores,
      );

      manager.undo();
      expect(getModel().model!.name).toBe('initial');
      manager.redo();
      expect(getModel().model!.name).toBe('renamed');
    });

    it('moves cursor forward by one', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        { label: 'a', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 1; } }] },
        manager, stores,
      );

      manager.undo();
      expect(manager.getSnapshot().cursor).toBe(-1);
      manager.redo();
      expect(manager.getSnapshot().cursor).toBe(0);
    });

    it('does nothing when there is nothing to redo', () => {
      const { stores, getModel } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        { label: 'a', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 1; } }] },
        manager, stores,
      );

      manager.redo(); // nothing to redo
      expect(getModel().model!.value).toBe(1);
    });
  });

  describe('pause() / resume()', () => {
    it('suppresses recording while paused', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.pause();
      manager.record({ id: '1', label: 'suppressed', timestamp: 0, scope: 'global', patchSets: [] });
      manager.resume();

      expect(manager.getSnapshot().length).toBe(0);
    });

    it('resumes recording after resume()', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.pause();
      manager.resume();
      manager.record({ id: '1', label: 'recorded', timestamp: 0, scope: 'global', patchSets: [] });

      expect(manager.getSnapshot().length).toBe(1);
    });
  });

  describe('clear()', () => {
    it('resets timeline and cursor', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });
      manager.record({ id: '2', label: 'b', timestamp: 0, scope: 'global', patchSets: [] });
      manager.clear();

      expect(manager.getSnapshot().length).toBe(0);
      expect(manager.getSnapshot().cursor).toBe(-1);
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('subscribe()', () => {
    it('notifies listeners on record', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);
      const listener = vi.fn();

      manager.subscribe(listener);
      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on undo and redo', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);
      const listener = vi.fn();

      undoTransaction(
        { label: 'a', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 1; } }] },
        manager, stores,
      );

      manager.subscribe(listener);
      manager.undo();
      manager.redo();

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('returns an unsubscribe function', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);
      const listener = vi.fn();

      const unsubscribe = manager.subscribe(listener);
      unsubscribe();
      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('scoped undo/redo', () => {
    it('canUndo with scope returns false when no matching entries', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'diagram-B', patchSets: [] });

      expect(manager.canUndo('diagram-A')).toBe(false);
    });

    it('canUndo with scope returns true for matching scope', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'diagram-A', patchSets: [] });

      expect(manager.canUndo('diagram-A')).toBe(true);
    });

    it('canUndo with scope returns true for global entries', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.record({ id: '1', label: 'a', timestamp: 0, scope: 'global', patchSets: [] });

      expect(manager.canUndo('diagram-A')).toBe(true);
    });

    it('getUndoStack filters by scope', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      manager.record({ id: '1', label: 'global op', timestamp: 0, scope: 'global', patchSets: [] });
      manager.record({ id: '2', label: 'diagram-B op', timestamp: 0, scope: 'diagram-B', patchSets: [] });

      const stack = manager.getUndoStack('diagram-A');
      expect(stack).toHaveLength(1);
      expect(stack[0].scope).toBe('global');
    });

    it('getRedoStack filters by scope', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        { label: 'global', scope: 'global', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 1; } }] },
        manager, stores,
      );
      undoTransaction(
        { label: 'diagram-B op', scope: 'diagram-B', mutations: [{ store: 'model', mutate: (d: ModelState) => { d.model!.value = 2; } }] },
        manager, stores,
      );

      manager.undo(); // undo diagram-B op (cursor at 0)
      manager.undo(); // undo global op (cursor at -1)

      const redoStack = manager.getRedoStack('diagram-A');
      expect(redoStack.some((e) => e.scope === 'global')).toBe(true);
      expect(redoStack.some((e) => e.scope === 'diagram-B')).toBe(false);
    });
  });

  describe('multi-store transactions via undoTransaction()', () => {
    it('applies mutations across two stores atomically', () => {
      const { stores, getModel, getVFS } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        {
          label: 'multi-store op',
          scope: 'global',
          mutations: [
            { store: 'model', mutate: (d: ModelState) => { d.model!.name = 'updated'; } },
            { store: 'vfs', mutate: (d: VFSState) => { d.project!.nodes['n1'] = { label: 'Node1' }; } },
          ],
        },
        manager, stores,
      );

      expect(getModel().model!.name).toBe('updated');
      expect(getVFS().project!.nodes['n1']).toEqual({ label: 'Node1' });
      expect(manager.getSnapshot().length).toBe(1);
    });

    it('undoes multi-store transaction restoring both stores', () => {
      const { stores, getModel, getVFS } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        {
          label: 'multi-store op',
          scope: 'global',
          mutations: [
            { store: 'model', mutate: (d: ModelState) => { d.model!.name = 'updated'; } },
            { store: 'vfs', mutate: (d: VFSState) => { d.project!.nodes['n1'] = { label: 'Node1' }; } },
          ],
        },
        manager, stores,
      );

      manager.undo();

      expect(getModel().model!.name).toBe('initial');
      expect(getVFS().project!.nodes['n1']).toBeUndefined();
    });

    it('skips recording when mutations produce no patches', () => {
      const { stores } = makeStores();
      const manager = makeManager(stores);

      undoTransaction(
        { label: 'no-op', scope: 'global', mutations: [{ store: 'model', mutate: () => {} }] },
        manager, stores,
      );

      expect(manager.getSnapshot().length).toBe(0);
    });
  });

  describe('withUndo()', () => {
    it('records a single-store mutation', () => {
      const { stores, getModel } = makeStores();
      const manager = makeManager(stores);

      withUndo('model', 'rename', 'global', (d: ModelState) => { d.model!.name = 'via-withUndo'; }, manager, stores);

      expect(getModel().model!.name).toBe('via-withUndo');
      expect(manager.canUndo()).toBe(true);
    });

    it('can be undone', () => {
      const { stores, getModel } = makeStores();
      const manager = makeManager(stores);

      withUndo('model', 'rename', 'global', (d: ModelState) => { d.model!.name = 'via-withUndo'; }, manager, stores);
      manager.undo();

      expect(getModel().model!.name).toBe('initial');
    });
  });
});
