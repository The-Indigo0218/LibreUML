/**
 * A3 — the actions a lane's ActivityPartitionViewModel exposes: rename,
 * reorder (index swap + relayout) and delete (model cleanup + view reparent
 * + relayout). Unlike `activityDiagramNodes.test.ts`'s pure VM-shape assertions,
 * these actually invoke the callbacks against the REAL stores + REAL
 * undoManager (same pattern as `undoPerFile.integration.test.ts`) — the thing
 * worth proving here is the cross-store transaction, not just the VM shape.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildActivityDiagramNodes } from '../activityDiagramNodes';
import { useVFSStore } from '../../../../../store/project-vfs.store';
import { useModelStore } from '../../../../../store/model.store';
import { getLocalModel } from '../../../../../store/standaloneModelOps';
import { undoManager } from '../../../../../core/undo/instance';
import type {
  SemanticModel,
  LibreUMLProject,
  ViewNode,
} from '../../../../../core/domain/vfs/vfs.types';
import type { ActivityPartitionViewModel } from '../../../../../adapters/view-models/node.view-model';

const FILE_ID = 'activity-file-1';
const ACTIVITY_ID = 'act-1';

function baseModel(over: Partial<SemanticModel> = {}): SemanticModel {
  const now = Date.now();
  return {
    id: 'm', name: 'M', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activities: { [ACTIVITY_ID]: { id: ACTIVITY_ID, kind: 'ACTIVITY', name: 'Checkout' } },
    activityNodes: {}, activityPartitions: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    relations: {}, packageNames: [], createdAt: now, updatedAt: now,
    ...over,
  } as SemanticModel;
}

/** Two lanes (index 0/1) each holding one action node, plus a diagram view. */
function twoLanesModel(): SemanticModel {
  return baseModel({
    activityPartitions: {
      'p-left': { id: 'p-left', kind: 'ACTIVITY_PARTITION', activityId: ACTIVITY_ID, name: 'Left', index: 0 },
      'p-right': { id: 'p-right', kind: 'ACTIVITY_PARTITION', activityId: ACTIVITY_ID, name: 'Right', index: 1 },
    } as never,
    activityNodes: {
      'n-in-left': {
        id: 'n-in-left', kind: 'ACTIVITY_NODE', activityType: 'ACTION', name: 'Step',
        activityId: ACTIVITY_ID, partitionId: 'p-left',
      },
    } as never,
  });
}

function twoLanesView(): { diagramId: string; nodes: ViewNode[]; edges: unknown[] } {
  return {
    diagramId: FILE_ID,
    nodes: [
      { id: 'vn-p-left', elementId: 'p-left', x: 0, y: 0, width: 200 },
      { id: 'vn-p-right', elementId: 'p-right', x: 200, y: 0, width: 300 },
      // Relative to its lane (parentPackageId = the lane's own ViewNode id).
      { id: 'vn-n-in-left', elementId: 'n-in-left', x: 20, y: 40, parentPackageId: 'vn-p-left' },
    ],
    edges: [],
  };
}

function freshProjectBackedFile() {
  const now = Date.now();
  useVFSStore.getState().loadProject({
    id: 'proj-1', projectName: 'Test', version: '1.0.0', domainModelId: 'dm-1',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID, name: 'Flow.luml', type: 'FILE', parentId: null,
        diagramType: 'ACTIVITY_DIAGRAM', extension: '.luml', isExternal: false,
        standalone: false,
        content: twoLanesView(),
        createdAt: now, updatedAt: now,
      } as never,
    },
    createdAt: now, updatedAt: now,
  } as LibreUMLProject);
  useModelStore.getState().loadModel(twoLanesModel());
}

function freshStandaloneFile() {
  const now = Date.now();
  useVFSStore.getState().loadProject({
    id: 'proj-standalone', projectName: 'Test', version: '1.0.0', domainModelId: 'dm-1',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID, name: 'Flow.luml', type: 'FILE', parentId: null,
        diagramType: 'ACTIVITY_DIAGRAM', extension: '.luml', isExternal: false,
        standalone: true,
        content: twoLanesView(),
        localModel: twoLanesModel(),
        createdAt: now, updatedAt: now,
      } as never,
    },
    createdAt: now, updatedAt: now,
  } as LibreUMLProject);
}

interface Surface {
  name: string;
  reset: () => void;
  model: () => SemanticModel;
  scope: string;
  isStandalone: boolean;
}

const SURFACES: Surface[] = [
  {
    name: 'project-backed',
    reset: freshProjectBackedFile,
    model: () => useModelStore.getState().model as SemanticModel,
    scope: 'global',
    isStandalone: false,
  },
  {
    name: 'standalone',
    reset: freshStandaloneFile,
    model: () => getLocalModel(FILE_ID) as SemanticModel,
    scope: FILE_ID,
    isStandalone: true,
  },
];

function viewNodes(): ViewNode[] {
  const file = useVFSStore.getState().project!.nodes[FILE_ID] as never as { content: { nodes: ViewNode[] } };
  return file.content.nodes;
}

function partitionVM(id: string): ActivityPartitionViewModel {
  const ctx = {
    diagramView: { diagramId: FILE_ID, nodes: viewNodes(), edges: [] },
    model: (useVFSStore.getState().project!.nodes[FILE_ID] as never as { standalone?: boolean }).standalone
      ? getLocalModel(FILE_ID)!
      : (useModelStore.getState().model as SemanticModel),
    isStandalone: !!(useVFSStore.getState().project!.nodes[FILE_ID] as never as { standalone?: boolean }).standalone,
    activeTabId: FILE_ID,
    handleNoteUpdate: () => {},
  };
  const built = buildActivityDiagramNodes(ctx as never);
  const node = built.find((n) => n.id === id)!;
  return node.data as ActivityPartitionViewModel;
}

describe.each(SURFACES)('ActivityPartitionViewModel actions — $name', (surface) => {
  beforeEach(() => {
    undoManager.clear();
    surface.reset();
  });

  it('canMoveLeft/canMoveRight reflect position among siblings', () => {
    expect(partitionVM('vn-p-left').canMoveLeft).toBe(false);
    expect(partitionVM('vn-p-left').canMoveRight).toBe(true);
    expect(partitionVM('vn-p-right').canMoveLeft).toBe(true);
    expect(partitionVM('vn-p-right').canMoveRight).toBe(false);
  });

  it('onRename updates the lane name on the model', () => {
    partitionVM('vn-p-left').onRename!('Frontline');
    expect(surface.model().activityPartitions!['p-left'].name).toBe('Frontline');
  });

  it('onMoveRight swaps index with the right neighbour and re-derives x for both lanes', () => {
    partitionVM('vn-p-left').onMoveRight!();

    expect(surface.model().activityPartitions!['p-left'].index).toBe(1);
    expect(surface.model().activityPartitions!['p-right'].index).toBe(0);

    const left = viewNodes().find((n) => n.id === 'vn-p-left')!;
    const right = viewNodes().find((n) => n.id === 'vn-p-right')!;
    // Right lane (now index 0) is now at x=0; left lane (now index 1) follows
    // it — at the width of whichever lane precedes it (right's width, 300).
    expect(right.x).toBe(0);
    expect(left.x).toBe(300);
  });

  it('reordering never touches a child node\'s own stored (parent-relative) coordinates', () => {
    const before = viewNodes().find((n) => n.id === 'vn-n-in-left')!;
    const beforeXY = { x: before.x, y: before.y };

    partitionVM('vn-p-left').onMoveRight!();

    const after = viewNodes().find((n) => n.id === 'vn-n-in-left')!;
    expect({ x: after.x, y: after.y }).toEqual(beforeXY);
    // It still belongs to the same lane — only that lane's derived x moved.
    expect(after.parentPackageId).toBe('vn-p-left');
  });

  it('onMoveLeft is a no-op at the leftmost edge (no transaction recorded)', () => {
    partitionVM('vn-p-left').onMoveLeft!();
    expect(surface.model().activityPartitions!['p-left'].index).toBe(0);
    expect(undoManager.canUndo(surface.scope)).toBe(false);
  });

  it('reorder undoes in ONE step across both the index and the derived x', () => {
    partitionVM('vn-p-left').onMoveRight!();
    expect(surface.model().activityPartitions!['p-left'].index).toBe(1);

    undoManager.undo(surface.scope);

    expect(surface.model().activityPartitions!['p-left'].index).toBe(0);
    expect(surface.model().activityPartitions!['p-right'].index).toBe(1);
    const left = viewNodes().find((n) => n.id === 'vn-p-left')!;
    const right = viewNodes().find((n) => n.id === 'vn-p-right')!;
    expect(left.x).toBe(0);
    expect(right.x).toBe(200);
  });

  it('onDelete removes the lane from the model and the view', () => {
    partitionVM('vn-p-left').onDelete!();

    expect(surface.model().activityPartitions!['p-left']).toBeUndefined();
    expect(viewNodes().find((n) => n.id === 'vn-p-left')).toBeUndefined();
  });

  it('onDelete unassigns the lane\'s nodes instead of deleting them', () => {
    partitionVM('vn-p-left').onDelete!();

    // Model: partitionId cleared, node itself still exists.
    expect(surface.model().activityNodes!['n-in-left']).toBeDefined();
    expect(surface.model().activityNodes!['n-in-left'].partitionId).toBeUndefined();

    // View: parentPackageId cleared, and its coordinates became absolute
    // (it was at lane-relative (20, 40), lane was at x=0 → absolute (20, 40)).
    const vn = viewNodes().find((n) => n.id === 'vn-n-in-left')!;
    expect(vn.parentPackageId).toBeFalsy();
    expect({ x: vn.x, y: vn.y }).toEqual({ x: 20, y: 40 });
  });

  it('onDelete relayouts the remaining lane to close the gap', () => {
    partitionVM('vn-p-left').onDelete!();

    const right = viewNodes().find((n) => n.id === 'vn-p-right')!;
    expect(right.x).toBe(0); // was 200, now the only (and first) lane
  });

  it('delete undoes in one step, restoring the lane, its node\'s membership, and the layout', () => {
    partitionVM('vn-p-left').onDelete!();
    undoManager.undo(surface.scope);

    expect(surface.model().activityPartitions!['p-left']).toBeDefined();
    expect(surface.model().activityNodes!['n-in-left'].partitionId).toBe('p-left');
    const left = viewNodes().find((n) => n.id === 'vn-p-left')!;
    const right = viewNodes().find((n) => n.id === 'vn-p-right')!;
    expect(left.x).toBe(0);
    expect(right.x).toBe(200);
  });
});
