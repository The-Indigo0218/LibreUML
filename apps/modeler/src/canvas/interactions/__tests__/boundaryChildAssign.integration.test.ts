/**
 * Dragging a use case INTO a system boundary must store its position relative to
 * the boundary (like UC modules already did) — otherwise getAbsolutePosition
 * double-counts the boundary offset and the use case is rendered shifted out of
 * the boundary (the "queda a la esquina" bug).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePackageDrop } from '../usePackageDrop';
import { getAbsolutePosition } from '../../../features/diagram/hooks/controllers/sharedNodeBuilders';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { undoManager } from '../../../core/undo/instance';
import type { ShapeDescriptor } from '../../types/canvas.types';
import type { NodeBounds } from '../../edges/geometry';
import type { LibreUMLProject, SemanticModel, ViewNode } from '../../../core/domain/vfs/vfs.types';

const FILE = 'file-uc';
const SB_VN = 'vn-sb';
const UC_VN = 'vn-uc';
const SB_ELEM = 'sb-1';
const UC_ELEM = 'uc-1';

// Boundary at abs (100,100) sized 400x300; use case free at abs (200,200).
function project(): LibreUMLProject {
  const now = Date.now();
  return {
    id: 'p', projectName: 'T', version: '1.0.0', domainModelId: 'dm',
    nodes: {
      [FILE]: {
        id: FILE, name: 'UC.luml', type: 'FILE', parentId: null,
        diagramType: 'USE_CASE_DIAGRAM', extension: '.luml', isExternal: false, standalone: false,
        content: {
          diagramId: FILE,
          nodes: [
            { id: SB_VN, elementId: SB_ELEM, x: 100, y: 100, width: 400, height: 300 },
            { id: UC_VN, elementId: UC_ELEM, x: 200, y: 200 },
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
    id: 'dm', name: 'M', version: '1.0.0', packages: {},
    classes: {}, interfaces: {}, enums: {}, dataTypes: {}, attributes: {}, operations: {},
    actors: {}, useCases: { [UC_ELEM]: { id: UC_ELEM, name: 'Login' } },
    systemBoundaries: { [SB_ELEM]: { id: SB_ELEM, name: 'System' } },
    activityNodes: {}, objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, activations: {}, interactionFragments: {},
    stateInvariants: {}, interactionUses: {}, gates: {},
    relations: {}, packageNames: [], createdAt: now, updatedAt: now,
  } as any;
}

const shapes: ShapeDescriptor[] = [
  {
    id: SB_VN, type: 'class', x: 100, y: 100, width: 400, height: 300, parentPackageId: null,
    data: { __brand: 'systemBoundary', id: SB_VN, domainId: SB_ELEM, name: 'System', width: 400, height: 300 } as any,
  },
  {
    id: UC_VN, type: 'class', x: 200, y: 200, parentPackageId: null,
    data: { __brand: 'useCase', id: UC_VN, domainId: UC_ELEM, name: 'Login' } as any,
  },
];

const boundsMap = new Map<string, NodeBounds>([
  [SB_VN, { x: 100, y: 100, width: 400, height: 300 }],
  [UC_VN, { x: 200, y: 200, width: 120, height: 60 }],
]);

// Fake Konva drag-end event for the use case dropped at its current spot (inside the boundary).
const dropEvent = {
  target: { id: () => UC_VN, x: () => 200, y: () => 200 },
  evt: { clientX: 0, clientY: 0 },
} as any;

function uc(): ViewNode {
  const f = useVFSStore.getState().project!.nodes[FILE] as any;
  return f.content.nodes.find((n: ViewNode) => n.id === UC_VN);
}
function allNodes(): ViewNode[] {
  const f = useVFSStore.getState().project!.nodes[FILE] as any;
  return f.content.nodes;
}

beforeEach(() => {
  undoManager.clear();
  useVFSStore.getState().loadProject(project());
  useModelStore.getState().loadModel(model());
});

describe('drag a use case into a system boundary', () => {
  it('stores the child relative to the boundary so it stays where it was dropped', () => {
    const { result } = renderHook(() =>
      usePackageDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    );

    result.current.onDragEndWithPackageDetection(dropEvent);

    const child = uc();
    expect(child.parentPackageId).toBe(SB_VN);
    // Stored RELATIVE to the boundary (200-100, 200-100), not the raw absolute 200.
    expect({ x: child.x, y: child.y }).toEqual({ x: 100, y: 100 });
    // Resolves back to the original absolute drop point — no visual drift.
    expect(getAbsolutePosition(child, allNodes())).toEqual({ x: 200, y: 200 });
  });

  it('is undoable: restores the free absolute position', () => {
    const { result } = renderHook(() =>
      usePackageDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    );
    result.current.onDragEndWithPackageDetection(dropEvent);
    expect(undoManager.canUndo(FILE)).toBe(true);

    undoManager.undo(FILE);
    const child = uc();
    expect(child.parentPackageId ?? null).toBeNull();
    expect({ x: child.x, y: child.y }).toEqual({ x: 200, y: 200 });
  });
});
