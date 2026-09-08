/**
 * A3 — dropping an activity node into a swimlane. Deliberately separate from
 * `usePackageDrop`'s tests: a lane is never a package/boundary/module, and
 * (unlike those) lanes never overlap, so there's no ambiguity picker to
 * exercise here — only "inside exactly one lane, or none".
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePartitionDrop } from '../usePartitionDrop';
import { getAbsolutePosition } from '../../../features/diagram/hooks/controllers/sharedNodeBuilders';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { undoManager } from '../../../core/undo/instance';
import type { ShapeDescriptor } from '../../types/canvas.types';
import type { NodeBounds } from '../../edges/geometry';
import type { LibreUMLProject, SemanticModel, ViewNode } from '../../../core/domain/vfs/vfs.types';

const FILE = 'file-activity';
const LANE_VN = 'vn-lane';
const ACTION_VN = 'vn-action';
const LANE_ELEM = 'lane-1';
const ACTION_ELEM = 'action-1';
const ACTIVITY_ID = 'act-1';

// Lane at abs (100, 0) sized 300x200; action node free at abs (150, 50) —
// inside the lane's bounds but not yet assigned to it.
function project(): LibreUMLProject {
  const now = Date.now();
  return {
    id: 'p', projectName: 'T', version: '1.0.0', domainModelId: 'dm',
    nodes: {
      [FILE]: {
        id: FILE, name: 'Flow.luml', type: 'FILE', parentId: null,
        diagramType: 'ACTIVITY_DIAGRAM', extension: '.luml', isExternal: false, standalone: false,
        content: {
          diagramId: FILE,
          nodes: [
            { id: LANE_VN, elementId: LANE_ELEM, x: 100, y: 0, width: 300 },
            { id: ACTION_VN, elementId: ACTION_ELEM, x: 150, y: 50 },
          ] as ViewNode[],
          edges: [],
        },
        createdAt: now, updatedAt: now,
      } as never,
    },
    createdAt: now, updatedAt: now,
  } as never;
}

function model(): SemanticModel {
  const now = Date.now();
  return {
    id: 'dm', name: 'M', version: '1.0.0', packages: {},
    classes: {}, interfaces: {}, enums: {}, dataTypes: {}, attributes: {}, operations: {},
    actors: {}, useCases: {},
    activities: { [ACTIVITY_ID]: { id: ACTIVITY_ID, kind: 'ACTIVITY', name: 'Flow' } },
    activityPartitions: {
      [LANE_ELEM]: { id: LANE_ELEM, kind: 'ACTIVITY_PARTITION', activityId: ACTIVITY_ID, name: 'Lane', index: 0 },
    },
    activityNodes: {
      [ACTION_ELEM]: {
        id: ACTION_ELEM, kind: 'ACTIVITY_NODE', activityType: 'ACTION', name: 'Step', activityId: ACTIVITY_ID,
      },
    },
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    relations: {}, packageNames: [], createdAt: now, updatedAt: now,
  } as never;
}

const shapes: ShapeDescriptor[] = [
  {
    id: LANE_VN, type: 'class', x: 100, y: 0, width: 300, parentPackageId: null,
    data: {
      __brand: 'activityPartition', id: LANE_VN, domainId: LANE_ELEM, name: 'Lane',
      index: 0, width: 300, canMoveLeft: false, canMoveRight: false,
    } as never,
  },
  {
    id: ACTION_VN, type: 'class', x: 150, y: 50, parentPackageId: null,
    data: { __brand: 'activityAction', id: ACTION_VN, domainId: ACTION_ELEM, label: 'Step' } as never,
  },
];

const boundsMap = new Map<string, NodeBounds>([
  [LANE_VN, { x: 100, y: 0, width: 300, height: 200 }],
  [ACTION_VN, { x: 150, y: 50, width: 120, height: 60 }],
]);

// Fake Konva drag-end event for the action dropped at its current spot
// (centre lands inside the lane's bounds).
const dropInsideLane = {
  target: { id: () => ACTION_VN, x: () => 150, y: () => 50 },
} as never;

// Dropped far outside any lane.
const dropOutsideLane = {
  target: { id: () => ACTION_VN, x: () => 900, y: () => 900 },
} as never;

function action(): ViewNode {
  const f = useVFSStore.getState().project!.nodes[FILE] as never as { content: { nodes: ViewNode[] } };
  return f.content.nodes.find((n) => n.id === ACTION_VN)!;
}
function allNodes(): ViewNode[] {
  const f = useVFSStore.getState().project!.nodes[FILE] as never as { content: { nodes: ViewNode[] } };
  return f.content.nodes;
}
function activityNode() {
  return useModelStore.getState().model!.activityNodes![ACTION_ELEM];
}

beforeEach(() => {
  undoManager.clear();
  useVFSStore.getState().loadProject(project());
  useModelStore.getState().loadModel(model());
});

describe('drag an activity node into a lane', () => {
  it('writes partitionId on the model and parentPackageId on the view, relative coords preserved', () => {
    const { result } = renderHook(() =>
      usePartitionDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    );

    result.current.onDragEndWithPartitionDetection(dropInsideLane);

    expect(activityNode().partitionId).toBe(LANE_ELEM);
    const vn = action();
    expect(vn.parentPackageId).toBe(LANE_VN);
    // Stored relative to the lane (150-100, 50-0), not the raw absolute 150.
    expect({ x: vn.x, y: vn.y }).toEqual({ x: 50, y: 50 });
    // Resolves back to the same absolute drop point — no visual jump.
    expect(getAbsolutePosition(vn, allNodes())).toEqual({ x: 150, y: 50 });
  });

  it('does nothing when dropped outside every lane and it was already unassigned', () => {
    const { result } = renderHook(() =>
      usePartitionDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    );
    result.current.onDragEndWithPartitionDetection(dropOutsideLane);
    expect(undoManager.canUndo('global')).toBe(false);
  });

  it('clears partitionId and parentPackageId when dragged back out of every lane', () => {
    // Start from an already-assigned state (dropped at the lane's relative
    // (50, 50) — same absolute point as `dropInsideLane`) — `shapes` has to
    // reflect that up front, the same way a real re-render would after the
    // first drop committed.
    const assignedProject = project();
    (assignedProject.nodes[FILE] as never as { content: { nodes: ViewNode[] } }).content.nodes[1] = {
      id: ACTION_VN, elementId: ACTION_ELEM, x: 50, y: 50, parentPackageId: LANE_VN,
    };
    useVFSStore.getState().loadProject(assignedProject);
    const assignedModel = model();
    assignedModel.activityNodes![ACTION_ELEM] = {
      ...assignedModel.activityNodes![ACTION_ELEM],
      partitionId: LANE_ELEM,
    };
    useModelStore.getState().loadModel(assignedModel);

    const assignedShapes: ShapeDescriptor[] = [
      shapes[0],
      { ...shapes[1], x: 150, y: 50, parentPackageId: LANE_VN },
    ];

    const { result } = renderHook(() =>
      usePartitionDrop({ shapes: assignedShapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    );
    result.current.onDragEndWithPartitionDetection(dropOutsideLane);

    expect(activityNode().partitionId).toBeUndefined();
    expect(action().parentPackageId ?? null).toBeNull();
  });

  it('is undoable in one step: partitionId and parentPackageId both revert', () => {
    const { result } = renderHook(() =>
      usePartitionDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    );
    result.current.onDragEndWithPartitionDetection(dropInsideLane);
    expect(undoManager.canUndo('global')).toBe(true);

    undoManager.undo('global');

    expect(activityNode().partitionId).toBeUndefined();
    const vn = action();
    expect(vn.parentPackageId ?? null).toBeNull();
    expect({ x: vn.x, y: vn.y }).toEqual({ x: 150, y: 50 });
  });

  it('never assigns a lane itself, or a note, into a lane', () => {
    // Defensive: neither the partition brand nor an unbranded note view model
    // is a droppable activity node — dragging one (were it ever draggable)
    // must not write a partitionId.
    const noteShape: ShapeDescriptor = {
      id: 'vn-note', type: 'note', x: 150, y: 50, parentPackageId: null,
      data: { content: 'hi' } as never,
    };
    const { result } = renderHook(() =>
      usePartitionDrop({
        shapes: [...shapes, noteShape],
        boundsMap: new Map([...boundsMap, ['vn-note', { x: 150, y: 50, width: 100, height: 40 }]]),
        activeTabId: FILE,
        isStandalone: false,
      }),
    );
    result.current.onDragEndWithPartitionDetection({
      target: { id: () => 'vn-note', x: () => 150, y: () => 50 },
    } as never);
    expect(undoManager.canUndo('global')).toBe(false);
  });
});
