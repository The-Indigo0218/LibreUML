/**
 * Activity mutations shared by both store surfaces (ADR-0001).
 *
 * `model.store` (global model) and `standaloneModelOps` (a file's localModel)
 * both have to offer the same operations. The sequence ops paid for that twice
 * — `cascadeDeleteMessages` exists in one and `cascadeDeleteMessagesByLifeline`
 * in the other — so activity keeps the logic here and both surfaces call in.
 *
 * These functions mutate the model they are given. Callers wrap them in
 * whatever transaction their surface uses (`withUndo` or `update`).
 */
import type {
  IRActivity,
  IRActivityNode,
  IRActivityPartition,
  SemanticModel,
} from '../core/domain/vfs/vfs.types';

/** Removes every relation with an endpoint in `elementIds`. */
function cascadeDeleteRelations(model: SemanticModel, elementIds: Set<string>) {
  for (const [id, relation] of Object.entries(model.relations ?? {})) {
    if (elementIds.has(relation.sourceId) || elementIds.has(relation.targetId)) {
      delete model.relations[id];
    }
  }
}

export function applyCreateActivity(
  model: SemanticModel,
  id: string,
  data: Omit<IRActivity, 'id' | 'kind'>,
): void {
  model.activities ??= {};
  model.activities[id] = { ...data, id, kind: 'ACTIVITY' };
  model.updatedAt = Date.now();
}

export function applyUpdateActivity(
  model: SemanticModel,
  id: string,
  patch: Partial<IRActivity>,
): void {
  if (!model.activities?.[id]) return;
  model.activities[id] = { ...model.activities[id], ...patch, id, kind: 'ACTIVITY' };
  model.updatedAt = Date.now();
}

/**
 * Deleting an activity takes its nodes and partitions with it, and every
 * control/object flow that touched those nodes. Leaving them behind would
 * strand elements no diagram can reach.
 */
export function applyDeleteActivity(model: SemanticModel, id: string): void {
  if (!model.activities?.[id]) return;
  delete model.activities[id];

  const orphanedNodeIds = new Set<string>();
  for (const [nodeId, node] of Object.entries(model.activityNodes ?? {})) {
    if (node.activityId === id) {
      orphanedNodeIds.add(nodeId);
      delete model.activityNodes[nodeId];
    }
  }

  for (const [partitionId, partition] of Object.entries(model.activityPartitions ?? {})) {
    if (partition.activityId === id) delete model.activityPartitions![partitionId];
  }

  cascadeDeleteRelations(model, orphanedNodeIds);
  model.updatedAt = Date.now();
}

export function applyCreateActivityNode(
  model: SemanticModel,
  id: string,
  data: Omit<IRActivityNode, 'id' | 'kind'>,
): void {
  model.activityNodes ??= {};
  model.activityNodes[id] = { ...data, id, kind: 'ACTIVITY_NODE' };
  model.updatedAt = Date.now();
}

export function applyUpdateActivityNode(
  model: SemanticModel,
  id: string,
  patch: Partial<IRActivityNode>,
): void {
  if (!model.activityNodes?.[id]) return;
  model.activityNodes[id] = {
    ...model.activityNodes[id],
    ...patch,
    id,
    kind: 'ACTIVITY_NODE',
  };
  model.updatedAt = Date.now();
}

/** Deleting a node takes the flows in and out of it with it. */
export function applyDeleteActivityNode(model: SemanticModel, id: string): void {
  if (!model.activityNodes?.[id]) return;
  delete model.activityNodes[id];
  cascadeDeleteRelations(model, new Set([id]));
  model.updatedAt = Date.now();
}

export function applyCreateActivityPartition(
  model: SemanticModel,
  id: string,
  data: Omit<IRActivityPartition, 'id' | 'kind'>,
): void {
  model.activityPartitions ??= {};
  model.activityPartitions[id] = { ...data, id, kind: 'ACTIVITY_PARTITION' };
  model.updatedAt = Date.now();
}

export function applyUpdateActivityPartition(
  model: SemanticModel,
  id: string,
  patch: Partial<IRActivityPartition>,
): void {
  if (!model.activityPartitions?.[id]) return;
  model.activityPartitions[id] = {
    ...model.activityPartitions[id],
    ...patch,
    id,
    kind: 'ACTIVITY_PARTITION',
  };
  model.updatedAt = Date.now();
}

/**
 * A lane disappearing does not delete the work inside it: its nodes fall back
 * to living outside any lane, which is a legal state (`partitionId` is
 * optional). Deleting them with the lane would destroy modelling on a layout
 * change.
 */
export function applyDeleteActivityPartition(model: SemanticModel, id: string): void {
  if (!model.activityPartitions?.[id]) return;
  delete model.activityPartitions[id];

  for (const node of Object.values(model.activityNodes ?? {})) {
    if (node.partitionId === id) delete node.partitionId;
  }
  model.updatedAt = Date.now();
}
