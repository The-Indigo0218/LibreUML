/**
 * A2.5 — VFS_DROP_CONFIG entries for Activity Diagram tools, across BOTH
 * store surfaces (spec section 10.4). Before this, no Activity tool id had
 * an entry at all: dropping "Action", "Decision", etc. onto the canvas hit
 * `console.warn('has no VFS semantic mapping')` and created nothing.
 *
 * `applyToModelDraft` (project-backed) and `applyToLocalModelDraft`
 * (standalone) are exercised with the same assertions so a behaviour that
 * only holds on one surface fails here, not in the app.
 */
import { describe, it, expect } from 'vitest';
import { VFS_DROP_CONFIG } from '../useKonvaDnD';
import type { SemanticModel } from '../../../core/domain/vfs/vfs.types';

function emptyModel(): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
    createdAt: 0, updatedAt: 0,
  } as SemanticModel;
}

interface Surface {
  name: string;
  action: (model: SemanticModel, id: string, name: string, existingViewNodes: { elementId: string }[]) => void;
  decision: (model: SemanticModel, id: string, existingViewNodes: { elementId: string }[]) => void;
  partition: (model: SemanticModel, id: string, name: string, existingViewNodes: { elementId: string }[]) => void;
  objectNode: (model: SemanticModel, id: string, name: string, existingViewNodes: { elementId: string }[]) => void;
}

const SURFACES: Surface[] = [
  {
    name: 'applyToModelDraft (project-backed)',
    action: (m, id, name, vns) => VFS_DROP_CONFIG.action!.applyToModelDraft(m, id, name, undefined, vns),
    decision: (m, id, vns) => VFS_DROP_CONFIG.decision!.applyToModelDraft(m, id, '', undefined, vns),
    partition: (m, id, name, vns) =>
      VFS_DROP_CONFIG.activity_partition!.applyToModelDraft(m, id, name, undefined, vns),
    objectNode: (m, id, name, vns) =>
      VFS_DROP_CONFIG.object_node!.applyToModelDraft(m, id, name, undefined, vns),
  },
  {
    name: 'applyToLocalModelDraft (standalone)',
    action: (m, id, name, vns) => VFS_DROP_CONFIG.action!.applyToLocalModelDraft(m, id, name, vns),
    decision: (m, id, vns) => VFS_DROP_CONFIG.decision!.applyToLocalModelDraft(m, id, '', vns),
    partition: (m, id, name, vns) => VFS_DROP_CONFIG.activity_partition!.applyToLocalModelDraft(m, id, name, vns),
    objectNode: (m, id, name, vns) => VFS_DROP_CONFIG.object_node!.applyToLocalModelDraft(m, id, name, vns),
  },
];

describe.each(SURFACES)('VFS_DROP_CONFIG — activity tools — $name', (surface) => {
  it('action: creates an ACTIVITY_NODE and a fresh Activity when the diagram has none', () => {
    const model = emptyModel();
    surface.action(model, 'n1', 'Action 1', []);

    expect(model.activityNodes!['n1']).toMatchObject({ activityType: 'ACTION', name: 'Action 1' });
    const activityId = model.activityNodes!['n1'].activityId;
    expect(activityId).toBeTruthy();
    expect(model.activities![activityId]).toBeTruthy();
  });

  it('decision: creates a nameless ACTIVITY_NODE (control nodes carry no label, per A1)', () => {
    const model = emptyModel();
    surface.decision(model, 'n1', []);
    expect(model.activityNodes!['n1']).toMatchObject({ activityType: 'DECISION', name: '' });
  });

  it('reuses the Activity a sibling node in the same diagram already belongs to', () => {
    const model = emptyModel();
    surface.action(model, 'n1', 'Action 1', []);
    const activityId = model.activityNodes!['n1'].activityId;

    surface.decision(model, 'n2', [{ elementId: 'n1' }]);

    expect(model.activityNodes!['n2'].activityId).toBe(activityId);
    expect(Object.keys(model.activities!)).toHaveLength(1);
  });

  it('does not conflate with an unrelated Activity elsewhere in the (shared, project-backed) model', () => {
    // Regression guard for the bug getOrCreateActivityId's per-diagram lookup
    // fixes: grabbing "the first activity in the whole model" would file a
    // new node under a different Activity Diagram file's activity whenever
    // more than one shares the global model.
    const model = emptyModel();
    surface.action(model, 'other-file-node', 'Other', []); // another diagram's node
    const otherActivityId = model.activityNodes!['other-file-node'].activityId;

    surface.action(model, 'n1', 'Action 1', []); // this diagram has no nodes of its own yet

    expect(model.activityNodes!['n1'].activityId).not.toBe(otherActivityId);
    expect(Object.keys(model.activities!)).toHaveLength(2);
  });

  // A3 — swimlane creation, deferred out of A2.5 on purpose (no shape existed
  // yet then). Same VFS_DROP_CONFIG shape as every other activity tool.
  it('partition: creates an ACTIVITY_PARTITION at index 0 for a fresh Activity', () => {
    const model = emptyModel();
    surface.partition(model, 'p1', 'Lane 1', []);

    expect(model.activityPartitions!['p1']).toMatchObject({ name: 'Lane 1', index: 0 });
    const activityId = model.activityPartitions!['p1'].activityId;
    expect(model.activities![activityId]).toBeTruthy();
  });

  it('partition: appends at the next index among siblings of the same Activity', () => {
    const model = emptyModel();
    surface.partition(model, 'p1', 'Lane 1', []);
    const activityId = model.activityPartitions!['p1'].activityId;

    surface.partition(model, 'p2', 'Lane 2', [{ elementId: 'p1' }]);

    expect(model.activityPartitions!['p2']).toMatchObject({ activityId, index: 1 });
  });

  it('partition: does not count a sibling lane from an unrelated Activity toward its own index', () => {
    const model = emptyModel();
    // Another diagram's activity already has 2 lanes.
    surface.partition(model, 'other-1', 'Lane A', []);
    surface.partition(model, 'other-2', 'Lane B', [{ elementId: 'other-1' }]);

    // This diagram has none of its own yet — must start at index 0, not 2.
    surface.partition(model, 'p1', 'Lane 1', []);

    expect(model.activityPartitions!['p1'].index).toBe(0);
    expect(model.activityPartitions!['p1'].activityId).not.toBe(
      model.activityPartitions!['other-1'].activityId,
    );
  });

  // A6/v1.1 — object node creation, deferred out of A2.5 on purpose (no shape
  // existed yet then). Same VFS_DROP_CONFIG shape as every other activity tool.
  it('objectNode: creates an ACTIVITY_NODE and a fresh Activity when the diagram has none', () => {
    const model = emptyModel();
    surface.objectNode(model, 'n1', 'Order', []);

    expect(model.activityNodes!['n1']).toMatchObject({ activityType: 'OBJECT_NODE', name: 'Order' });
    const activityId = model.activityNodes!['n1'].activityId;
    expect(activityId).toBeTruthy();
    expect(model.activities![activityId]).toBeTruthy();
  });

  it('objectNode: reuses the Activity a sibling node in the same diagram already belongs to', () => {
    const model = emptyModel();
    surface.action(model, 'n1', 'Action 1', []);
    const activityId = model.activityNodes!['n1'].activityId;

    surface.objectNode(model, 'n2', 'Order', [{ elementId: 'n1' }]);

    expect(model.activityNodes!['n2'].activityId).toBe(activityId);
    expect(Object.keys(model.activities!)).toHaveLength(1);
  });
});
