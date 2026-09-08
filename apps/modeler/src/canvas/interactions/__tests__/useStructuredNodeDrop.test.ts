/**
 * v1.1 — dropping an activity node into a loop/conditional/sequence
 * container. Same shape as `usePartitionDrop.test.ts` (point-in-rect, first
 * match wins) plus two cases that hook never had to handle: a structured
 * node can itself be the payload (nesting), and it can't contain itself.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStructuredNodeDrop } from '../useStructuredNodeDrop';
import { getAbsolutePosition } from '../../../features/diagram/hooks/controllers/sharedNodeBuilders';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { getLocalModel } from '../../../store/standaloneModelOps';
import { undoManager } from '../../../core/undo/instance';
import type { ShapeDescriptor } from '../../types/canvas.types';
import type { NodeBounds } from '../../edges/geometry';
import type { LibreUMLProject, SemanticModel, ViewNode } from '../../../core/domain/vfs/vfs.types';

const FILE = 'file-activity';
const LOOP_VN = 'vn-loop';
const ACTION_VN = 'vn-action';
const LOOP_ELEM = 'loop-1';
const ACTION_ELEM = 'action-1';
const ACTIVITY_ID = 'act-1';

// Loop container at abs (100, 0) sized 300x200; action node free at abs
// (150, 50) — inside the container's bounds but not yet assigned to it.
function project(standalone: boolean): LibreUMLProject {
  const now = Date.now();
  const nodes: ViewNode[] = [
    { id: LOOP_VN, elementId: LOOP_ELEM, x: 100, y: 0, width: 300, height: 200 },
    { id: ACTION_VN, elementId: ACTION_ELEM, x: 150, y: 50 },
  ];
  return {
    id: 'p', projectName: 'T', version: '1.0.0', domainModelId: 'dm',
    nodes: {
      [FILE]: {
        id: FILE, name: 'Flow.luml', type: 'FILE', parentId: null,
        diagramType: 'ACTIVITY_DIAGRAM', extension: '.luml', isExternal: false, standalone,
        content: { diagramId: FILE, nodes, edges: [] },
        ...(standalone ? { localModel: model() } : {}),
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
    activityNodes: {
      [LOOP_ELEM]: {
        id: LOOP_ELEM, kind: 'ACTIVITY_NODE', activityType: 'LOOP_NODE', name: 'Loop', activityId: ACTIVITY_ID,
      },
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
    id: LOOP_VN, type: 'class', x: 100, y: 0, width: 300, parentPackageId: null,
    data: { __brand: 'activityStructured', id: LOOP_VN, domainId: LOOP_ELEM, structuredKind: 'LOOP_NODE', name: 'Loop', width: 300, height: 200 } as never,
  },
  {
    id: ACTION_VN, type: 'class', x: 150, y: 50, parentPackageId: null,
    data: { __brand: 'activityAction', id: ACTION_VN, domainId: ACTION_ELEM, label: 'Step' } as never,
  },
];

const boundsMap = new Map<string, NodeBounds>([
  [LOOP_VN, { x: 100, y: 0, width: 300, height: 200 }],
  [ACTION_VN, { x: 150, y: 50, width: 120, height: 60 }],
]);

const dropInsideLoop = { target: { id: () => ACTION_VN, x: () => 150, y: () => 50 } } as never;
const dropOutsideLoop = { target: { id: () => ACTION_VN, x: () => 900, y: () => 900 } } as never;

describe.each([
  ['project-backed', false],
  ['standalone', true],
] as const)('drag an activity node into a structured node (%s)', (_label, standalone) => {
  function activeModel(): SemanticModel {
    return standalone ? getLocalModel(FILE)! : useModelStore.getState().model!;
  }
  function action(): ViewNode {
    const f = useVFSStore.getState().project!.nodes[FILE] as never as { content: { nodes: ViewNode[] } };
    return f.content.nodes.find((n) => n.id === ACTION_VN)!;
  }
  function allNodes(): ViewNode[] {
    const f = useVFSStore.getState().project!.nodes[FILE] as never as { content: { nodes: ViewNode[] } };
    return f.content.nodes;
  }
  function activityNode() {
    return activeModel().activityNodes![ACTION_ELEM];
  }
  function undoScope() {
    return standalone ? FILE : 'global';
  }

  beforeEach(() => {
    undoManager.clear();
    useVFSStore.getState().loadProject(project(standalone));
    if (!standalone) useModelStore.getState().loadModel(model());
  });

  it('writes containerId on the model and parentPackageId on the view, relative coords preserved', () => {
    const { result } = renderHook(() =>
      useStructuredNodeDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: standalone }),
    );

    result.current.onDragEndWithStructuredDetection(dropInsideLoop);

    expect(activityNode().containerId).toBe(LOOP_ELEM);
    const vn = action();
    expect(vn.parentPackageId).toBe(LOOP_VN);
    expect({ x: vn.x, y: vn.y }).toEqual({ x: 50, y: 50 });
    expect(getAbsolutePosition(vn, allNodes())).toEqual({ x: 150, y: 50 });
  });

  it('does nothing when dropped outside every structured node and it was already unassigned', () => {
    const { result } = renderHook(() =>
      useStructuredNodeDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: standalone }),
    );
    result.current.onDragEndWithStructuredDetection(dropOutsideLoop);
    expect(undoManager.canUndo(undoScope())).toBe(false);
  });

  it('is undoable in one step: containerId and parentPackageId both revert', () => {
    const { result } = renderHook(() =>
      useStructuredNodeDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: standalone }),
    );
    result.current.onDragEndWithStructuredDetection(dropInsideLoop);
    expect(undoManager.canUndo(undoScope())).toBe(true);

    undoManager.undo(undoScope());

    expect(activityNode().containerId).toBeUndefined();
    const vn = action();
    expect(vn.parentPackageId ?? null).toBeNull();
    expect({ x: vn.x, y: vn.y }).toEqual({ x: 150, y: 50 });
  });
});

describe('coexistence with usePartitionDrop (shared parentPackageId)', () => {
  const LANE_VN = 'vn-lane';
  const LANE_ELEM = 'lane-1';

  beforeEach(() => {
    undoManager.clear();
    const proj = project(false);
    // The action already belongs to a lane, not a structured node — same
    // shape `usePartitionDrop` leaves it in right before this hook runs in
    // the same drag-end handler.
    (proj.nodes[FILE] as never as { content: { nodes: ViewNode[] } }).content.nodes.push({
      id: LANE_VN, elementId: LANE_ELEM, x: 900, y: 900,
    });
    const laneAssignedAction = (proj.nodes[FILE] as never as { content: { nodes: ViewNode[] } })
      .content.nodes.find((n) => n.id === ACTION_VN)!;
    laneAssignedAction.parentPackageId = LANE_VN;
    useVFSStore.getState().loadProject(proj);

    const m = model();
    m.activityPartitions = { [LANE_ELEM]: { id: LANE_ELEM, kind: 'ACTIVITY_PARTITION', activityId: ACTIVITY_ID, name: 'Lane', index: 0 } } as never;
    m.activityNodes![ACTION_ELEM] = { ...m.activityNodes![ACTION_ELEM], partitionId: LANE_ELEM };
    useModelStore.getState().loadModel(m);
  });

  it('never clears a lane-assigned node\'s parentPackageId just because it lands outside every structured node', () => {
    // Regression: found via activityDiagramPartitions.spec.ts failing after
    // this hook was wired in — it used to clear `parentPackageId`
    // unconditionally whenever no structured node was under the drop point,
    // even when the node's *current* parent was a lane this hook has never
    // heard of.
    const laneShapes: ShapeDescriptor[] = [
      shapes[0],
      { ...shapes[1], parentPackageId: LANE_VN },
      { id: LANE_VN, type: 'class', x: 900, y: 900, parentPackageId: null, data: { __brand: 'activityPartition', id: LANE_VN, domainId: LANE_ELEM, name: 'Lane', index: 0, width: 220, canMoveLeft: false, canMoveRight: false } as never },
    ];

    const { result } = renderHook(() =>
      useStructuredNodeDrop({ shapes: laneShapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    );
    result.current.onDragEndWithStructuredDetection(dropOutsideLoop);

    expect(undoManager.canUndo('global')).toBe(false);
    const f = useVFSStore.getState().project!.nodes[FILE] as never as { content: { nodes: ViewNode[] } };
    expect(f.content.nodes.find((n) => n.id === ACTION_VN)!.parentPackageId).toBe(LANE_VN);
    expect(useModelStore.getState().model!.activityNodes![ACTION_ELEM].partitionId).toBe(LANE_ELEM);
  });
});

describe('structured-node-specific drop rules', () => {
  beforeEach(() => {
    undoManager.clear();
    useVFSStore.getState().loadProject(project(false));
    useModelStore.getState().loadModel(model());
  });

  it('never lets a structured node contain itself', () => {
    const { result } = renderHook(() =>
      useStructuredNodeDrop({ shapes, boundsMap, activeTabId: FILE, isStandalone: false }),
    );
    // The loop "dropped" on its own current spot — its centre is trivially
    // inside its own bounds, which the hook must special-case away.
    result.current.onDragEndWithStructuredDetection({
      target: { id: () => LOOP_VN, x: () => 100, y: () => 0 },
    } as never);
    expect(undoManager.canUndo('global')).toBe(false);
  });

  it('allows nesting one structured node inside another', () => {
    const outer: ViewNode = { id: 'vn-outer', elementId: 'outer-1', x: 0, y: 0, width: 600, height: 400 };
    const nestedShapes: ShapeDescriptor[] = [
      {
        id: 'vn-outer', type: 'class', x: 0, y: 0, width: 600, parentPackageId: null,
        data: { __brand: 'activityStructured', id: 'vn-outer', domainId: 'outer-1', structuredKind: 'SEQUENCE_NODE', name: 'Seq', width: 600, height: 400 } as never,
      },
      shapes[0],
    ];
    const nestedProject = project(false);
    (nestedProject.nodes[FILE] as never as { content: { nodes: ViewNode[] } }).content.nodes.push(outer);
    useVFSStore.getState().loadProject(nestedProject);
    const nestedModel = model();
    nestedModel.activityNodes!['outer-1'] = {
      id: 'outer-1', kind: 'ACTIVITY_NODE', activityType: 'SEQUENCE_NODE', name: 'Seq', activityId: ACTIVITY_ID,
    } as never;
    useModelStore.getState().loadModel(nestedModel);

    const nestedBounds = new Map(boundsMap);
    nestedBounds.set('vn-outer', { x: 0, y: 0, width: 600, height: 400 });

    const { result } = renderHook(() =>
      useStructuredNodeDrop({ shapes: nestedShapes, boundsMap: nestedBounds, activeTabId: FILE, isStandalone: false }),
    );
    // Drop the loop (LOOP_VN) at its current spot (100,0) — inside the outer
    // sequence node's bounds.
    result.current.onDragEndWithStructuredDetection({
      target: { id: () => LOOP_VN, x: () => 100, y: () => 0 },
    } as never);

    expect(useModelStore.getState().model!.activityNodes![LOOP_ELEM].containerId).toBe('outer-1');
  });
});
