/**
 * Package membership sync (class diagram).
 *
 * R1 — dragging a class OUT of a package must keep its absolute screen position
 * (the old code left the relative coords intact after clearing parentPackageId,
 * so the node jumped near the origin / behind the package = "disappeared").
 *
 * R2 — every membership change keeps packageName + packageId + the IRPackage
 * reverse index (classIds/interfaceIds/enumIds) consistent.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePackageDrop,
  reparentViewNodeCoords,
  moveElementInPackageIndex,
} from '../usePackageDrop';
import { useCanvasEventHandlers } from '../../../hooks/canvas/useCanvasEventHandlers';
import { getAbsolutePosition } from '../../../features/diagram/hooks/controllers/sharedNodeBuilders';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { undoManager } from '../../../core/undo/instance';
import type { ShapeDescriptor } from '../../types/canvas.types';
import type { NodeBounds } from '../../edges/geometry';
import type { LibreUMLProject, SemanticModel, ViewNode } from '../../../core/domain/vfs/vfs.types';

// ─── Unit: reparentViewNodeCoords ─────────────────────────────────────────────

describe('reparentViewNodeCoords', () => {
  // Package P at abs (100,100). Helpers build fresh node arrays per case.
  const P = (): ViewNode => ({ id: 'P', elementId: 'pe', x: 100, y: 100 });

  it('ENTER: free node → package stores coords relative to the package', () => {
    const nodes: ViewNode[] = [P(), { id: 'c', elementId: 'ce', x: 130, y: 130 }];
    reparentViewNodeCoords(nodes, 'c', 'P');
    const c = nodes.find((n) => n.id === 'c')!;
    expect(c.parentPackageId).toBe('P');
    expect({ x: c.x, y: c.y }).toEqual({ x: 30, y: 30 });
    expect(getAbsolutePosition(c, nodes)).toEqual({ x: 130, y: 130 });
  });

  it('EXIT: package → free restores the absolute position (the bug)', () => {
    const nodes: ViewNode[] = [P(), { id: 'c', elementId: 'ce', x: 30, y: 30, parentPackageId: 'P' }];
    reparentViewNodeCoords(nodes, 'c', null);
    const c = nodes.find((n) => n.id === 'c')!;
    expect(c.parentPackageId).toBeNull();
    expect({ x: c.x, y: c.y }).toEqual({ x: 130, y: 130 });
  });

  it('RE-PACKAGE: package1 → package2 re-relativises to the new parent', () => {
    const nodes: ViewNode[] = [
      P(),
      { id: 'P2', elementId: 'pe2', x: 500, y: 500 },
      { id: 'c', elementId: 'ce', x: 30, y: 30, parentPackageId: 'P' }, // abs 130,130
    ];
    reparentViewNodeCoords(nodes, 'c', 'P2');
    const c = nodes.find((n) => n.id === 'c')!;
    expect(c.parentPackageId).toBe('P2');
    expect(getAbsolutePosition(c, nodes)).toEqual({ x: 130, y: 130 });
    expect({ x: c.x, y: c.y }).toEqual({ x: -370, y: -370 });
  });

  it('NESTED: resolves through an ancestor chain when exiting', () => {
    const nodes: ViewNode[] = [
      P(),
      { id: 'P2', elementId: 'pe2', x: 50, y: 50, parentPackageId: 'P' }, // abs 150,150
      { id: 'c', elementId: 'ce', x: 10, y: 10, parentPackageId: 'P2' },  // abs 160,160
    ];
    reparentViewNodeCoords(nodes, 'c', null);
    const c = nodes.find((n) => n.id === 'c')!;
    expect({ x: c.x, y: c.y }).toEqual({ x: 160, y: 160 });
  });
});

describe('moveElementInPackageIndex', () => {
  function model(): SemanticModel {
    return {
      packages: {
        p1: { id: 'p1', name: 'P1', kind: 'PACKAGE', packageIds: [], classIds: ['x'], interfaceIds: [], enumIds: [], dataTypeIds: [] },
        p2: { id: 'p2', name: 'P2', kind: 'PACKAGE', packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [] },
      },
    } as any;
  }

  it('moves a class id from the old package array to the new one', () => {
    const m = model();
    moveElementInPackageIndex(m, 'x', 'CLASS', 'p1', 'p2');
    expect(m.packages.p1.classIds).toEqual([]);
    expect(m.packages.p2.classIds).toEqual(['x']);
  });

  it('removes from old without adding when new package is undefined (exit)', () => {
    const m = model();
    moveElementInPackageIndex(m, 'x', 'CLASS', 'p1', undefined);
    expect(m.packages.p1.classIds).toEqual([]);
  });
});

// ─── Integration: through usePackageDrop + useCanvasEventHandlers ──────────────

const FILE = 'file-cls';
const PKG_VN = 'vn-pkg';
const CLS_VN = 'vn-cls';
const PKG_ELEM = 'pkg-1';
const CLS_ELEM = 'cls-1';

// Package P at abs (100,100), 200x200. Class User RELATIVE (30,30) inside → abs (130,130).
function project(): LibreUMLProject {
  const now = Date.now();
  return {
    id: 'p', projectName: 'T', version: '1.0.0', domainModelId: 'dm',
    nodes: {
      [FILE]: {
        id: FILE, name: 'C.luml', type: 'FILE', parentId: null,
        diagramType: 'CLASS_DIAGRAM', extension: '.luml', isExternal: false, standalone: false,
        content: {
          diagramId: FILE,
          nodes: [
            { id: PKG_VN, elementId: PKG_ELEM, x: 100, y: 100, width: 200, height: 200 },
            { id: CLS_VN, elementId: CLS_ELEM, x: 30, y: 30, parentPackageId: PKG_VN },
          ] as ViewNode[],
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
    id: 'dm', name: 'M', version: '1.0.0',
    packages: {
      [PKG_ELEM]: { id: PKG_ELEM, name: 'P', kind: 'PACKAGE', packageIds: [], classIds: [CLS_ELEM], interfaceIds: [], enumIds: [], dataTypeIds: [] },
    },
    classes: { [CLS_ELEM]: { id: CLS_ELEM, name: 'User', kind: 'CLASS', attributeIds: [], operationIds: [], packageName: 'P', packageId: PKG_ELEM } },
    interfaces: {}, enums: {}, dataTypes: {}, attributes: {}, operations: {},
    actors: {}, useCases: {}, activityNodes: {}, objectInstances: {}, components: {},
    nodes: {}, artifacts: {}, lifelines: {}, messages: {}, activations: {},
    interactionFragments: {}, stateInvariants: {}, interactionUses: {}, gates: {},
    relations: {}, packageNames: [], createdAt: now, updatedAt: now,
  } as any;
}

const shapes: ShapeDescriptor[] = [
  { id: PKG_VN, type: 'package', x: 100, y: 100, width: 200, height: 200, parentPackageId: null,
    data: { __brand: 'package', id: PKG_VN, domainId: PKG_ELEM, name: 'P', depth: 0 } as any },
  { id: CLS_VN, type: 'class', x: 130, y: 130, parentPackageId: PKG_VN,
    data: { __brand: 'class', id: CLS_VN, domainId: CLS_ELEM, name: 'User' } as any },
];

const boundsMap = new Map<string, NodeBounds>([
  [PKG_VN, { x: 100, y: 100, width: 200, height: 200 }],
  [CLS_VN, { x: 130, y: 130, width: 120, height: 60 }],
]);

function cls(): ViewNode {
  const f = useVFSStore.getState().project!.nodes[FILE] as any;
  return f.content.nodes.find((n: ViewNode) => n.id === CLS_VN);
}

beforeEach(() => {
  undoManager.clear();
  useVFSStore.getState().loadProject(project());
  useModelStore.getState().loadModel(model());
});

describe('drag a class OUT of a package (R1 + R2)', () => {
  it('keeps the dropped absolute position and clears membership everywhere', () => {
    // 1) onNodesChange runs first (like handleDragEnd): the child is still in the
    //    package, so the absolute drop (600,600) is stored relative to P → (500,500).
    const evHandlers = renderHook(() =>
      useCanvasEventHandlers({ activeTabId: FILE, isStandalone: false }),
    ).result.current;
    evHandlers.onNodesChange([{ type: 'position', id: CLS_VN, position: { x: 600, y: 600 } }]);

    // 2) Package detection commits the reparent. Drop point (600,600) is outside P.
    const drop = renderHook(() =>
      usePackageDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    ).result.current;
    drop.onDragEndWithPackageDetection({
      target: { id: () => CLS_VN, x: () => 600, y: () => 600 },
      evt: { clientX: 0, clientY: 0 },
    } as any);

    const c = cls();
    expect(c.parentPackageId ?? null).toBeNull();
    // Absolute drop position preserved — not collapsed to the relative offset.
    expect({ x: c.x, y: c.y }).toEqual({ x: 600, y: 600 });

    const m = useModelStore.getState().model!;
    expect(m.classes[CLS_ELEM].packageName).toBeUndefined();
    expect(m.classes[CLS_ELEM].packageId).toBeUndefined();
    expect(m.packages[PKG_ELEM].classIds).toEqual([]);
  });
});

describe('drag a free class INTO a package (R2)', () => {
  beforeEach(() => {
    // Reset to a project where the class is free (no parent) at abs (130,130).
    const proj = project();
    const f = proj.nodes[FILE] as any;
    f.content.nodes = [
      { id: PKG_VN, elementId: PKG_ELEM, x: 100, y: 100, width: 200, height: 200 },
      { id: CLS_VN, elementId: CLS_ELEM, x: 130, y: 130 },
    ];
    useVFSStore.getState().loadProject(proj);
    const m = model();
    (m.classes[CLS_ELEM] as any).packageName = undefined;
    (m.classes[CLS_ELEM] as any).packageId = undefined;
    m.packages[PKG_ELEM].classIds = [];
    useModelStore.getState().loadModel(m);
  });

  it('sets packageName, packageId and adds to the reverse index', () => {
    const freeShapes: ShapeDescriptor[] = [
      shapes[0],
      { ...shapes[1], parentPackageId: null },
    ];
    const drop = renderHook(() =>
      usePackageDrop({ shapes: freeShapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    ).result.current;
    // Drop at (150,150) — inside the package bounds.
    drop.onDragEndWithPackageDetection({
      target: { id: () => CLS_VN, x: () => 150, y: () => 150 },
      evt: { clientX: 0, clientY: 0 },
    } as any);

    const c = cls();
    expect(c.parentPackageId).toBe(PKG_VN);

    const m = useModelStore.getState().model!;
    expect(m.classes[CLS_ELEM].packageName).toBe('P');
    expect(m.classes[CLS_ELEM].packageId).toBe(PKG_ELEM);
    expect(m.packages[PKG_ELEM].classIds).toEqual([CLS_ELEM]);
  });
});
