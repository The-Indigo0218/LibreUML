/**
 * Moving a package with children — children must NOT visually drift.
 *
 * Children store their position RELATIVE to the parent package; the renderer
 * resolves absolute = parentAbs + childRel (getAbsolutePosition). When the whole
 * package is dragged, package + children arrive in the same onNodesChange batch.
 * The old code recomputed each child's relative position by subtracting the
 * parent's *old* position, double-counting the drag delta and leaving children
 * offset outside the package. This locks in the fix.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasEventHandlers } from '../useCanvasEventHandlers';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { undoManager } from '../../../core/undo/instance';
import type { LibreUMLProject, SemanticModel } from '../../../core/domain/vfs/vfs.types';

const FILE = 'file-1';
const PKG_VN = 'vn-pkg';
const CHILD_VN = 'vn-child';
const PKG_ELEM = 'cls-pkg';
const CHILD_ELEM = 'cls-child';

// Package at absolute (100,100); child stored RELATIVE (20,20) → child abs (120,120).
function project(): LibreUMLProject {
  const now = Date.now();
  return {
    id: 'p', projectName: 'T', version: '1.0.0', domainModelId: 'dm-1',
    nodes: {
      [FILE]: {
        id: FILE, name: 'D.luml', type: 'FILE', parentId: null,
        diagramType: 'CLASS_DIAGRAM', extension: '.luml', isExternal: false, standalone: false,
        content: {
          diagramId: FILE,
          nodes: [
            { id: PKG_VN, elementId: PKG_ELEM, x: 100, y: 100 },
            { id: CHILD_VN, elementId: CHILD_ELEM, x: 20, y: 20, parentPackageId: PKG_VN },
          ],
          edges: [],
        },
        createdAt: now, updatedAt: now,
      } as any,
    },
    createdAt: now, updatedAt: now,
  } as any;
}

function model(): SemanticModel {
  const now = Date.now();
  return {
    id: 'dm-1', name: 'M', version: '1.0.0', packages: {},
    classes: {
      [PKG_ELEM]: { id: PKG_ELEM, name: 'Pkg', kind: 'CLASS', attributeIds: [], operationIds: [] },
      [CHILD_ELEM]: { id: CHILD_ELEM, name: 'Child', kind: 'CLASS', attributeIds: [], operationIds: [] },
    },
    interfaces: {}, enums: {}, dataTypes: {}, attributes: {}, operations: {},
    actors: {}, useCases: {}, activityNodes: {}, objectInstances: {}, components: {},
    nodes: {}, artifacts: {}, lifelines: {}, messages: {}, activations: {},
    interactionFragments: {}, stateInvariants: {}, interactionUses: {}, gates: {},
    relations: {}, packageNames: [], createdAt: now, updatedAt: now,
  } as SemanticModel;
}

function vn(id: string) {
  const f = useVFSStore.getState().project!.nodes[FILE] as any;
  return f.content.nodes.find((n: any) => n.id === id) as { x: number; y: number };
}
function handlers() {
  return renderHook(() =>
    useCanvasEventHandlers({ activeTabId: FILE, isStandalone: false }),
  ).result.current;
}

beforeEach(() => {
  undoManager.clear();
  useVFSStore.getState().loadProject(project());
  useModelStore.getState().loadModel(model());
});

describe('Move package with a child', () => {
  it("keeps the child's relative position so it does not drift out of the package", () => {
    // Drag the package by (+50,+30). Konva reports ABSOLUTE positions for both
    // the package and the child (children render as flat absolute nodes).
    handlers().onNodesChange([
      { type: 'position', id: PKG_VN, position: { x: 150, y: 130 } },   // 100+50, 100+30
      { type: 'position', id: CHILD_VN, position: { x: 170, y: 150 } }, // 120+50, 120+30
    ]);

    // Package absolute moved…
    expect(vn(PKG_VN)).toMatchObject({ x: 150, y: 130 });
    // …child RELATIVE position is unchanged (no double-counted delta).
    expect(vn(CHILD_VN)).toMatchObject({ x: 20, y: 20 });
    // → child absolute = 150+20, 130+20 = (170,150): exactly where it was dragged.
  });

  it('a child dragged on its own is stored relative to the parent absolute', () => {
    handlers().onNodesChange([
      { type: 'position', id: CHILD_VN, position: { x: 130, y: 130 } }, // new child absolute
    ]);

    // parent stays at (100,100); child rel = 130-100 = 30.
    expect(vn(PKG_VN)).toMatchObject({ x: 100, y: 100 });
    expect(vn(CHILD_VN)).toMatchObject({ x: 30, y: 30 });
  });

  it('the package move is undoable as one entry', () => {
    handlers().onNodesChange([
      { type: 'position', id: PKG_VN, position: { x: 150, y: 130 } },
      { type: 'position', id: CHILD_VN, position: { x: 170, y: 150 } },
    ]);
    expect(undoManager.canUndo(FILE)).toBe(true);

    undoManager.undo(FILE);
    expect(vn(PKG_VN)).toMatchObject({ x: 100, y: 100 });
    expect(vn(CHILD_VN)).toMatchObject({ x: 20, y: 20 });
  });
});
