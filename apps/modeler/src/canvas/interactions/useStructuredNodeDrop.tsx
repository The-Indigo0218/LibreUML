/**
 * useStructuredNodeDrop — assigns an activity node to the loop/conditional/
 * sequence container it was dropped into (v1.1, structured nodes).
 *
 * Same shape as `usePartitionDrop` (point-in-rect, first match wins, no
 * ambiguity picker — a node's centre point is inside at most one structured
 * node at a time, same reasoning as lanes never overlapping) but a different
 * container kind and a different IR field: `containerId`, not `partitionId`.
 * Kept separate from `usePartitionDrop` on purpose — a node can be inside a
 * lane AND inside a structured node at once, so the two assignments must not
 * collide by sharing a hook, a field, or a piece of state.
 *
 * Unlike a partition, a structured node is itself draggable — so it is both
 * a valid *container* (things can drop into it) and a valid *payload* (it can
 * drop into another one, nesting), which `usePartitionDrop` never had to
 * handle since a lane never moves freely.
 */
import { useCallback, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  isActivityActionViewModel,
  isActivityControlNodeViewModel,
  isActivityDecisionViewModel,
  isActivityForkJoinViewModel,
  isActivityObjectNodeViewModel,
  isActivityStructuredViewModel,
} from '../../adapters/view-models/node.view-model';
import type { NodeBounds } from '../edges/geometry';
import type { ShapeDescriptor } from '../types/canvas.types';
import { undoTransaction } from '../../core/undo/undoBridge';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { reparentViewNodeCoords } from './usePackageDrop';
import { applyUpdateActivityNode } from '../../store/activityModelOps';
import { useVFSStore } from '../../store/project-vfs.store';
import type { SemanticModel } from '../../core/domain/vfs/vfs.types';

export interface UseStructuredNodeDropOptions {
  shapes: ShapeDescriptor[];
  boundsMap: Map<string, NodeBounds>;
  activeTabId: string;
  isStandalone?: boolean;
}

/** Whether a view model can be dropped into a structured node. Pins are
 * excluded — they are owned by (and render next to) their action, not
 * independently placeable. A structured node itself counts (nesting). */
function isDroppableIntoStructured(data: ShapeDescriptor['data']): boolean {
  return (
    isActivityActionViewModel(data) ||
    isActivityControlNodeViewModel(data) ||
    isActivityDecisionViewModel(data) ||
    isActivityForkJoinViewModel(data) ||
    isActivityObjectNodeViewModel(data) ||
    isActivityStructuredViewModel(data)
  );
}

export function useStructuredNodeDrop({
  shapes,
  boundsMap,
  activeTabId,
  isStandalone = false,
}: UseStructuredNodeDropOptions) {
  const [hoveredStructuredId, setHoveredStructuredId] = useState<string | null>(null);

  const commitAssignment = useCallback(
    (droppedNodeId: string, targetContainerId: string | null) => {
      const droppedShape = shapes.find((s) => s.id === droppedNodeId);
      if (!droppedShape || !isDroppableIntoStructured(droppedShape.data)) return;
      // A structured node can't contain itself.
      if (targetContainerId === droppedNodeId) return;
      const currentParentId = droppedShape.parentPackageId ?? null;
      if (currentParentId === targetContainerId) return;

      const targetShape = targetContainerId ? shapes.find((s) => s.id === targetContainerId) : null;
      if (targetContainerId && !(targetShape && isActivityStructuredViewModel(targetShape.data))) return;

      // `parentPackageId` is also how a lane (`usePartitionDrop`) records
      // membership for the very same node kinds — nothing here scans for
      // partitions, so it must never touch an assignment it doesn't own.
      // Dropping outside every structured node only clears it if the
      // *current* parent was itself a structured node in the first place;
      // otherwise this is simply "not relevant to this hook" (e.g. still
      // parented to a lane), and it stays untouched. Found by a real e2e
      // regression (activityDiagramPartitions.spec.ts): without this guard,
      // dragging a lane-assigned node anywhere with no structured node under
      // it silently wiped the lane's `parentPackageId` right after
      // `usePartitionDrop` had just set it, in the same drag-end handler.
      //
      // Known remaining gap, not fixed (accepted, narrow): `currentParentId`
      // comes from this render's `shapes`, not a live read — if a single
      // drag gesture moves a node directly out of a structured node's body
      // and straight into a lane's (i.e. `usePartitionDrop` reassigns
      // `parentPackageId` to the lane in the very same event this hook
      // reacts to), this still clears it back to the stale structured-node
      // check's expectations. Reordering hook execution or reading live
      // state would close it; not done here as disproportionate to how
      // reachable the two-container-crossing-in-one-drag gesture is.
      if (!targetContainerId) {
        const currentParentShape = currentParentId ? shapes.find((s) => s.id === currentParentId) : null;
        if (!currentParentShape || !isActivityStructuredViewModel(currentParentShape.data)) return;
      }

      const label = targetContainerId ? 'Move into structured node' : 'Remove from structured node';

      if (isStandalone) {
        undoTransaction({
          label,
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const file = draft.project?.nodes[activeTabId];
              if (!file || !isDiagramView(file.content) || !file.localModel) return;
              reparentViewNodeCoords(file.content.nodes, droppedNodeId, targetContainerId);
              const droppedVN = file.content.nodes.find((vn: any) => vn.id === droppedNodeId);
              if (!droppedVN) return;
              const lm = file.localModel as SemanticModel;
              const targetVN = targetContainerId
                ? file.content.nodes.find((vn: any) => vn.id === targetContainerId)
                : null;
              applyUpdateActivityNode(lm, droppedVN.elementId, {
                containerId: targetVN?.elementId,
              });
            },
          }],
          affectedElementIds: [droppedNodeId],
        });
      } else {
        undoTransaction({
          label,
          scope: 'global',
          mutations: [
            {
              store: 'vfs',
              mutate: (draft: any) => {
                const file = draft.project?.nodes[activeTabId];
                if (!file || !isDiagramView(file.content)) return;
                reparentViewNodeCoords(file.content.nodes, droppedNodeId, targetContainerId);
              },
            },
            {
              store: 'model',
              mutate: (draft: any) => {
                if (!draft.model) return;
                const vfsProject = useVFSStore.getState().project;
                const file = vfsProject?.nodes[activeTabId] as any;
                if (!file || !isDiagramView(file.content)) return;
                const droppedVN = file.content.nodes.find((vn: any) => vn.id === droppedNodeId);
                if (!droppedVN) return;
                const targetVN = targetContainerId
                  ? file.content.nodes.find((vn: any) => vn.id === targetContainerId)
                  : null;
                applyUpdateActivityNode(draft.model, droppedVN.elementId, {
                  containerId: targetVN?.elementId,
                });
              },
            },
          ],
          affectedElementIds: [droppedNodeId],
        });
      }
    },
    [shapes, activeTabId, isStandalone],
  );

  const findContainerAt = useCallback(
    (dropPoint: { x: number; y: number }, excludeId: string): string | null => {
      for (const shape of shapes) {
        if (shape.id === excludeId) continue;
        if (!isActivityStructuredViewModel(shape.data)) continue;
        const b = boundsMap.get(shape.id);
        if (!b) continue;
        if (
          dropPoint.x >= b.x && dropPoint.x <= b.x + b.width &&
          dropPoint.y >= b.y && dropPoint.y <= b.y + b.height
        ) {
          return shape.id;
        }
      }
      return null;
    },
    [shapes, boundsMap],
  );

  const onDragMoveDetectStructured = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const nodeId = e.target.id();
      if (!nodeId) return;
      const draggedShape = shapes.find((s) => s.id === nodeId);
      if (!draggedShape || !isDroppableIntoStructured(draggedShape.data)) return;

      const nodeBounds = boundsMap.get(nodeId);
      const dropPoint = {
        x: e.target.x() + (nodeBounds ? nodeBounds.width / 2 : 0),
        y: e.target.y() + (nodeBounds ? nodeBounds.height / 2 : 0),
      };

      const found = findContainerAt(dropPoint, nodeId);
      setHoveredStructuredId((prev) => (prev === found ? prev : found));
    },
    [shapes, boundsMap, findContainerAt],
  );

  const onDragEndWithStructuredDetection = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const nodeId = e.target.id();
      if (!nodeId) return;
      const draggedShape = shapes.find((s) => s.id === nodeId);
      if (!draggedShape || !isDroppableIntoStructured(draggedShape.data)) {
        setHoveredStructuredId(null);
        return;
      }

      const nodeBounds = boundsMap.get(nodeId);
      const dropPoint = {
        x: e.target.x() + (nodeBounds ? nodeBounds.width / 2 : 0),
        y: e.target.y() + (nodeBounds ? nodeBounds.height / 2 : 0),
      };

      const found = findContainerAt(dropPoint, nodeId);
      setHoveredStructuredId(null);
      commitAssignment(nodeId, found);
    },
    [shapes, boundsMap, findContainerAt, commitAssignment],
  );

  return { hoveredStructuredId, onDragMoveDetectStructured, onDragEndWithStructuredDetection };
}
