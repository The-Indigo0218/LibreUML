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

// ─── Traceability cascades (ADR-0010) ──────────────────────────────────────
//
// All three traces are plain ids, so nothing needs to happen when the target
// is renamed. What has to happen is cleanup when the target is *deleted* —
// otherwise the reference dangles and a later lookup resolves to nothing (or
// worse, to a different element that later reuses the id). Same reasoning as
// `clearGeneralOrderingsForMessages` in `model.store.ts`, kept here instead
// because both store surfaces need it (see file header).

/** Clears `callsOperationId` on every action that calls one of the given (deleted) operations. */
export function clearCallsOperationRefs(model: SemanticModel, deletedOperationIds: Set<string>): void {
  if (deletedOperationIds.size === 0) return;
  for (const node of Object.values(model.activityNodes ?? {})) {
    if (node.callsOperationId && deletedOperationIds.has(node.callsOperationId)) {
      delete node.callsOperationId;
    }
  }
}

/** Clears `realizesUseCaseId` on every activity that realizes the given (deleted) use case. */
export function clearRealizesUseCaseRef(model: SemanticModel, deletedUseCaseId: string): void {
  for (const activity of Object.values(model.activities ?? {})) {
    if (activity.realizesUseCaseId === deletedUseCaseId) delete activity.realizesUseCaseId;
  }
}

/** Clears `representsId` on every lane whose responsible class/actor is the given (deleted) element. */
export function clearRepresentsRef(model: SemanticModel, deletedElementId: string): void {
  for (const partition of Object.values(model.activityPartitions ?? {})) {
    if (partition.representsId === deletedElementId) delete partition.representsId;
  }
}

/**
 * Clears `classifierId` on every object node whose classifier is the given
 * (deleted) element (A6, same reasoning as `clearRepresentsRef`). Scoped to
 * `deleteClass`, same as `representsId` — interfaces/enums/data types have
 * no delete-cascade for their own references either; pre-existing gap, not
 * one this trace introduces.
 */
export function clearObjectNodeClassifierRefs(model: SemanticModel, deletedClassifierId: string): void {
  for (const node of Object.values(model.activityNodes ?? {})) {
    if (node.classifierId === deletedClassifierId) delete node.classifierId;
  }
}

/**
 * Formats a called operation as `Class::op()` (spec §5) — the visible half of
 * the action→operation trace, next to the modal's own selector labels
 * (`ActivityActionPropsModal`), which use the same format.
 */
export function resolveCallsOperationLabel(model: SemanticModel, operationId: string): string | undefined {
  const op = model.operations?.[operationId];
  if (!op) return undefined;
  const owner =
    Object.values(model.classes).find((c) => c.operationIds?.includes(operationId)) ??
    Object.values(model.interfaces).find((i) => i.operationIds?.includes(operationId));
  return owner ? `${owner.name}::${op.name}()` : `${op.name}()`;
}

/**
 * Resolves an object node's classifier trace to a display name (ADR-0010) —
 * the visible half of `IRActivityNode.classifierId`. Checked against every
 * collection a classifier can come from, same shape as `representsName` in
 * `activityDiagramXmiExporter.ts`, plus data types and enums.
 */
export function resolveObjectNodeClassifierLabel(model: SemanticModel, classifierId: string): string | undefined {
  return (
    model.classes[classifierId]?.name ??
    model.interfaces[classifierId]?.name ??
    model.enums[classifierId]?.name ??
    model.dataTypes[classifierId]?.name
  );
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

/**
 * Resolves the Activity that owns a diagram file's nodes, creating one if the
 * file doesn't have any yet (its first node/partition being placed).
 *
 * A node's `activityId` is not optional — it always belongs to exactly one
 * Activity, unlike a Sequence lifeline, which can be reused across diagrams.
 * v1 assumes one Activity per Activity Diagram file, so the owner has to be
 * found by looking at what *this* diagram already contains, never by reading
 * `Object.keys(model.activities)[0]`: when the model is the shared
 * project-backed one (ADR-0001), it can hold other Activity Diagram files'
 * activities too, and grabbing "the first one" would silently file a new
 * node under the wrong diagram's activity.
 */
export function getOrCreateActivityId(
  model: SemanticModel,
  diagramViewNodes: readonly { elementId: string }[],
  activityName: string,
): string {
  for (const vn of diagramViewNodes) {
    const activityId =
      model.activityNodes?.[vn.elementId]?.activityId ??
      model.activityPartitions?.[vn.elementId]?.activityId;
    if (activityId) return activityId;
  }
  const id = crypto.randomUUID();
  applyCreateActivity(model, id, { name: activityName });
  return id;
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
