/**
 * A1 — activity CRUD across BOTH store surfaces (spec section 10.4).
 *
 * `model.store` (global model) and `standaloneModelOps` (a file's localModel)
 * must offer the same operations with the same semantics. The tests are
 * parameterised over both so a behaviour that only holds on one surface fails
 * here rather than in the app.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';
import { standaloneModelOps, getLocalModel, ensureLocalModel } from '../standaloneModelOps';
import { useVFSStore } from '../project-vfs.store';
import type { SemanticModel } from '../../core/domain/vfs/vfs.types';

const FILE_ID = 'standalone-activity-file';

function freshStandaloneFile() {
  const now = Date.now();
  useVFSStore.getState().loadProject({
    id: 'proj-activity',
    projectName: 'Test',
    version: '1.0.0',
    domainModelId: 'dm-1',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID,
        name: 'Flow.luml',
        type: 'FILE',
        parentId: null,
        diagramType: 'ACTIVITY_DIAGRAM',
        extension: '.luml',
        isExternal: false,
        standalone: true,
        content: { diagramId: FILE_ID, nodes: [], edges: [] },
        createdAt: now,
        updatedAt: now,
      } as never,
    },
    createdAt: now,
    updatedAt: now,
  } as never);
  ensureLocalModel(FILE_ID);
}

/** The same operations, reached through whichever surface is under test. */
interface Surface {
  name: string;
  reset: () => void;
  model: () => SemanticModel;
  ops: () => {
    createActivity: (d: never) => string;
    updateActivity: (id: string, p: never) => void;
    deleteActivity: (id: string) => void;
    createActivityNode: (d: never) => string;
    updateActivityNode: (id: string, p: never) => void;
    deleteActivityNode: (id: string) => void;
    createActivityPartition: (d: never) => string;
    updateActivityPartition: (id: string, p: never) => void;
    deleteActivityPartition: (id: string) => void;
    createRelation: (d: never) => string;
  };
}

const SURFACES: Surface[] = [
  {
    name: 'model.store (global)',
    reset: () => {
      useModelStore.getState().resetModel();
      useModelStore.getState().initModel('test-activity-model');
    },
    model: () => useModelStore.getState().model as SemanticModel,
    ops: () => useModelStore.getState() as never,
  },
  {
    name: 'standaloneModelOps (localModel)',
    reset: freshStandaloneFile,
    model: () => getLocalModel(FILE_ID) as SemanticModel,
    ops: () => standaloneModelOps(FILE_ID) as never,
  },
];

describe.each(SURFACES)('activity CRUD — $name', (surface) => {
  beforeEach(() => surface.reset());

  it('creates an activity and stamps its kind', () => {
    const id = surface.ops().createActivity({ name: 'Checkout' } as never);

    const activity = surface.model().activities![id];
    expect(activity.name).toBe('Checkout');
    expect(activity.kind).toBe('ACTIVITY');
    expect(activity.id).toBe(id);
  });

  it('creates a node that belongs to its activity', () => {
    const activityId = surface.ops().createActivity({ name: 'Checkout' } as never);
    const nodeId = surface.ops().createActivityNode({
      name: 'Validate cart',
      activityType: 'ACTION',
      activityId,
    } as never);

    const node = surface.model().activityNodes[nodeId];
    expect(node.activityId).toBe(activityId);
    expect(node.activityType).toBe('ACTION');
    expect(node.kind).toBe('ACTIVITY_NODE');
  });

  it('updates a node without losing its identity', () => {
    const activityId = surface.ops().createActivity({ name: 'A' } as never);
    const nodeId = surface.ops().createActivityNode({
      name: 'Old', activityType: 'ACTION', activityId,
    } as never);

    surface.ops().updateActivityNode(nodeId, { name: 'New' } as never);

    const node = surface.model().activityNodes[nodeId];
    expect(node.name).toBe('New');
    expect(node.id).toBe(nodeId);
    expect(node.kind).toBe('ACTIVITY_NODE');
  });

  it('deleting an activity cascades to its nodes', () => {
    const activityId = surface.ops().createActivity({ name: 'A' } as never);
    const other = surface.ops().createActivity({ name: 'B' } as never);
    const mine = surface.ops().createActivityNode({
      name: 'Mine', activityType: 'ACTION', activityId,
    } as never);
    const theirs = surface.ops().createActivityNode({
      name: 'Theirs', activityType: 'ACTION', activityId: other,
    } as never);

    surface.ops().deleteActivity(activityId);

    expect(surface.model().activityNodes[mine]).toBeUndefined();
    // A sibling activity's nodes are untouched.
    expect(surface.model().activityNodes[theirs]).toBeDefined();
  });

  it('deleting an activity cascades to its partitions', () => {
    const activityId = surface.ops().createActivity({ name: 'A' } as never);
    const laneId = surface.ops().createActivityPartition({
      name: 'Customer', activityId, index: 0,
    } as never);

    surface.ops().deleteActivity(activityId);

    expect(surface.model().activityPartitions![laneId]).toBeUndefined();
  });

  it('deleting a node takes the flows in and out of it', () => {
    const activityId = surface.ops().createActivity({ name: 'A' } as never);
    const from = surface.ops().createActivityNode({
      name: 'From', activityType: 'ACTION', activityId,
    } as never);
    const to = surface.ops().createActivityNode({
      name: 'To', activityType: 'ACTION', activityId,
    } as never);
    const flow = surface.ops().createRelation({
      kind: 'CONTROL_FLOW', sourceId: from, targetId: to,
    } as never);

    surface.ops().deleteActivityNode(from);

    expect(surface.model().relations[flow]).toBeUndefined();
    expect(surface.model().activityNodes[to]).toBeDefined();
  });

  it('deleting an activity takes the flows between its nodes', () => {
    const activityId = surface.ops().createActivity({ name: 'A' } as never);
    const from = surface.ops().createActivityNode({
      name: 'From', activityType: 'INITIAL', activityId,
    } as never);
    const to = surface.ops().createActivityNode({
      name: 'To', activityType: 'ACTIVITY_FINAL', activityId,
    } as never);
    const flow = surface.ops().createRelation({
      kind: 'CONTROL_FLOW', sourceId: from, targetId: to,
    } as never);

    surface.ops().deleteActivity(activityId);

    expect(surface.model().relations[flow]).toBeUndefined();
  });

  it('deleting a lane keeps its nodes, dropping them out of any lane', () => {
    // A layout change must not destroy modelling: partitionId is optional, so
    // living outside a lane is a legal state.
    const activityId = surface.ops().createActivity({ name: 'A' } as never);
    const laneId = surface.ops().createActivityPartition({
      name: 'Customer', activityId, index: 0,
    } as never);
    const nodeId = surface.ops().createActivityNode({
      name: 'Pay', activityType: 'ACTION', activityId, partitionId: laneId,
    } as never);

    surface.ops().deleteActivityPartition(laneId);

    const node = surface.model().activityNodes[nodeId];
    expect(node).toBeDefined();
    expect(node.partitionId).toBeUndefined();
  });

  it('ignores updates and deletes for ids that do not exist', () => {
    expect(() => surface.ops().updateActivityNode('ghost', { name: 'x' } as never)).not.toThrow();
    expect(() => surface.ops().deleteActivityNode('ghost')).not.toThrow();
    expect(() => surface.ops().deleteActivity('ghost')).not.toThrow();
    expect(() => surface.ops().deleteActivityPartition('ghost')).not.toThrow();
  });
});
