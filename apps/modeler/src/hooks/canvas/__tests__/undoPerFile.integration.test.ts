/**
 * Undo/Redo per file — integration coverage (#6).
 *
 * The UndoManager unit tests drive synthetic entries; this suite exercises the
 * REAL pipeline end to end against the REAL stores:
 *
 *   real handler / store action
 *     → undoBridge.withUndo / model.store action
 *       → instance.undoTransaction
 *         → undoManager.record  (routeKey: 'vfs' → per-file, 'model' → global)
 *
 * and then verifies that undo/redo revert/reapply against the real stores.
 *
 * `undoManager.undo(activeTabId)` / `undoManager.redo(activeTabId)` are exactly
 * what Ctrl+Z / Ctrl+Shift+Z dispatch — see
 * features/diagram/hooks/useKeyboardShortcuts.ts:49-59 (both read
 * `useWorkspaceStore.getState().activeTabId` as the scope). We call the manager
 * directly so the test doesn't have to mount the heavy shortcuts hook.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasEventHandlers } from '../useCanvasEventHandlers';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { undoManager } from '../../../core/undo/instance';
import type { LibreUMLProject, SemanticModel } from '../../../core/domain/vfs/vfs.types';

const FILE_A = 'file-A';
const FILE_B = 'file-B';
const VN_A = 'vn-a';
const VN_B = 'vn-b';
const ELEM_A = 'cls-a';
const ELEM_B = 'cls-b';

function emptyModel(): SemanticModel {
  const now = Date.now();
  return {
    id: 'dm-1', name: 'Shared', version: '1.0.0',
    packages: {},
    classes: {
      [ELEM_A]: { id: ELEM_A, name: 'A', kind: 'CLASS', attributeIds: [], operationIds: [] },
      [ELEM_B]: { id: ELEM_B, name: 'B', kind: 'CLASS', attributeIds: [], operationIds: [] },
    },
    interfaces: {}, enums: {}, dataTypes: {}, attributes: {}, operations: {},
    actors: {}, useCases: {}, activityNodes: {}, objectInstances: {}, components: {},
    nodes: {}, artifacts: {}, lifelines: {}, messages: {}, activations: {},
    interactionFragments: {}, stateInvariants: {}, interactionUses: {}, gates: {},
    relations: {}, packageNames: [],
    createdAt: now, updatedAt: now,
  } as SemanticModel;
}

function diagramFile(id: string, vnId: string, elementId: string) {
  const now = Date.now();
  return {
    id, name: `${id}.luml`, type: 'FILE', parentId: null,
    diagramType: 'CLASS_DIAGRAM', extension: '.luml', isExternal: false,
    standalone: false,
    content: {
      diagramId: id,
      nodes: [{ id: vnId, elementId, x: 0, y: 0 }],
      edges: [],
    },
    createdAt: now, updatedAt: now,
  } as any;
}

function projectWithTwoFiles(): LibreUMLProject {
  const now = Date.now();
  return {
    id: 'proj-1', projectName: 'Test', version: '1.0.0', domainModelId: 'dm-1',
    nodes: {
      [FILE_A]: diagramFile(FILE_A, VN_A, ELEM_A),
      [FILE_B]: diagramFile(FILE_B, VN_B, ELEM_B),
    },
    createdAt: now, updatedAt: now,
  } as any;
}

function viewNodes(fileId: string) {
  const file = useVFSStore.getState().project!.nodes[fileId] as any;
  return file.content.nodes as Array<{ id: string; x: number; y: number }>;
}
function pos(fileId: string, vnId: string) {
  const vn = viewNodes(fileId).find((n) => n.id === vnId)!;
  return { x: vn.x, y: vn.y };
}
function handlers(activeTabId: string) {
  return renderHook(() =>
    useCanvasEventHandlers({ activeTabId, isStandalone: false }),
  ).result.current;
}

beforeEach(() => {
  undoManager.clear();
  // loadProject re-syncs the shared model store, so seed the model afterwards.
  useVFSStore.getState().loadProject(projectWithTwoFiles());
  useModelStore.getState().loadModel(emptyModel());
});

describe('Move Node (vfs → per-file timeline)', () => {
  it('a real drag produces an undoable entry; Ctrl+Z reverts, Ctrl+Shift+Z redoes', () => {
    handlers(FILE_A).onNodesChange([{ type: 'position', id: VN_A, position: { x: 120, y: 80 } }]);

    expect(pos(FILE_A, VN_A)).toEqual({ x: 120, y: 80 });
    expect(undoManager.canUndo(FILE_A)).toBe(true);

    undoManager.undo(FILE_A); // Ctrl+Z
    expect(pos(FILE_A, VN_A)).toEqual({ x: 0, y: 0 });

    undoManager.redo(FILE_A); // Ctrl+Shift+Z
    expect(pos(FILE_A, VN_A)).toEqual({ x: 120, y: 80 });
  });

  it('a move lives on its own file timeline — undo from another file leaves it alone', () => {
    handlers(FILE_A).onNodesChange([{ type: 'position', id: VN_A, position: { x: 120, y: 80 } }]);

    // File B has nothing of its own to undo, and undoing from B must not move A.
    expect(undoManager.canUndo(FILE_B)).toBe(false);
    undoManager.undo(FILE_B);
    expect(pos(FILE_A, VN_A)).toEqual({ x: 120, y: 80 });
  });

  it("Bug 1 regression — a new edit in B does not wipe A's redo stack", () => {
    handlers(FILE_A).onNodesChange([{ type: 'position', id: VN_A, position: { x: 50, y: 50 } }]);
    undoManager.undo(FILE_A);                 // A now has a pending redo
    expect(undoManager.canRedo(FILE_A)).toBe(true);

    // Brand-new edit in B — must not truncate A's future.
    handlers(FILE_B).onNodesChange([{ type: 'position', id: VN_B, position: { x: 9, y: 9 } }]);

    expect(undoManager.canRedo(FILE_A)).toBe(true);
    undoManager.redo(FILE_A);
    expect(pos(FILE_A, VN_A)).toEqual({ x: 50, y: 50 });
    expect(pos(FILE_B, VN_B)).toEqual({ x: 9, y: 9 });
  });
});

describe('Model action (model → global timeline)', () => {
  it('a shared-model edit is on the global axis: undoable from any diagram', () => {
    // Triggered while file A is the active diagram, but it mutates the shared model.
    useModelStore.getState().updateClass(ELEM_A, { name: 'Renamed' });
    expect(useModelStore.getState().model!.classes[ELEM_A].name).toBe('Renamed');

    // Undoing from a *different* diagram (B) reverts it — model changes are global.
    expect(undoManager.canUndo(FILE_B)).toBe(true);
    undoManager.undo(FILE_B);
    expect(useModelStore.getState().model!.classes[ELEM_A].name).toBe('A');

    undoManager.redo(FILE_B);
    expect(useModelStore.getState().model!.classes[ELEM_A].name).toBe('Renamed');
  });

  it('a model edit and a per-file view edit do not interfere', () => {
    handlers(FILE_A).onNodesChange([{ type: 'position', id: VN_A, position: { x: 200, y: 0 } }]);
    useModelStore.getState().updateClass(ELEM_B, { name: 'B2' });

    // Undo from A pops the most recent action across [A's view + global model]:
    // the model rename was last, so it goes first.
    undoManager.undo(FILE_A);
    expect(useModelStore.getState().model!.classes[ELEM_B].name).toBe('B');
    expect(pos(FILE_A, VN_A)).toEqual({ x: 200, y: 0 }); // view move untouched

    // Next undo from A pops the view move.
    undoManager.undo(FILE_A);
    expect(pos(FILE_A, VN_A)).toEqual({ x: 0, y: 0 });
  });
});
