/**
 * usePartitionDrop — assigns an activity node to the swimlane it was dropped
 * into (A3, spec §4.3).
 *
 * Deliberately separate from `usePackageDrop`: a partition is not a package,
 * a system boundary or a UC module (the risk noted in the plan — "verify
 * PartitionShape never participates in usePackageDrop"), and unlike those,
 * lanes never overlap or nest, so there is no ambiguity picker to build —
 * a node's centre point is inside at most one lane.
 *
 * Two writes on drop, same pattern as `commitAssignment`:
 *   - view:  `parentPackageId` (+ coords made relative), via the generic
 *            `reparentViewNodeCoords` — reused unmodified, it only cares
 *            about the ViewNode parent chain.
 *   - model: `IRActivityNode.partitionId` — the actual source of truth
 *            (spec §4.3: "la vista sigue al IR").
 */
import { useCallback, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  isActivityActionViewModel,
  isActivityControlNodeViewModel,
  isActivityDecisionViewModel,
  isActivityForkJoinViewModel,
  isActivityPartitionViewModel,
} from '../../adapters/view-models/node.view-model';
import type { NodeBounds } from '../edges/geometry';
import type { ShapeDescriptor } from '../types/canvas.types';
import { undoTransaction } from '../../core/undo/undoBridge';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { reparentViewNodeCoords } from './usePackageDrop';
import { applyUpdateActivityNode } from '../../store/activityModelOps';
import { useVFSStore } from '../../store/project-vfs.store';
import type { SemanticModel } from '../../core/domain/vfs/vfs.types';

export interface UsePartitionDropOptions {
  shapes: ShapeDescriptor[];
  boundsMap: Map<string, NodeBounds>;
  activeTabId: string;
  isStandalone?: boolean;
}

/** Whether a view model is a droppable activity node (never a lane itself). */
function isActivityNodeViewModel(data: ShapeDescriptor['data']): boolean {
  return (
    isActivityActionViewModel(data) ||
    isActivityControlNodeViewModel(data) ||
    isActivityDecisionViewModel(data) ||
    isActivityForkJoinViewModel(data)
  );
}

export function usePartitionDrop({
  shapes,
  boundsMap,
  activeTabId,
  isStandalone = false,
}: UsePartitionDropOptions) {
  const [hoveredPartitionId, setHoveredPartitionId] = useState<string | null>(null);

  const commitAssignment = useCallback(
    (droppedNodeId: string, targetPartitionId: string | null) => {
      const droppedShape = shapes.find((s) => s.id === droppedNodeId);
      if (!droppedShape || !isActivityNodeViewModel(droppedShape.data)) return;
      const currentParentId = droppedShape.parentPackageId ?? null;
      if (currentParentId === targetPartitionId) return;

      const targetShape = targetPartitionId ? shapes.find((s) => s.id === targetPartitionId) : null;
      if (targetPartitionId && !(targetShape && isActivityPartitionViewModel(targetShape.data))) return;

      const label = targetPartitionId ? 'Move into lane' : 'Remove from lane';

      if (isStandalone) {
        undoTransaction({
          label,
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const file = draft.project?.nodes[activeTabId];
              if (!file || !isDiagramView(file.content) || !file.localModel) return;
              reparentViewNodeCoords(file.content.nodes, droppedNodeId, targetPartitionId);
              const droppedVN = file.content.nodes.find((vn: any) => vn.id === droppedNodeId);
              if (!droppedVN) return;
              const lm = file.localModel as SemanticModel;
              const targetVN = targetPartitionId
                ? file.content.nodes.find((vn: any) => vn.id === targetPartitionId)
                : null;
              applyUpdateActivityNode(lm, droppedVN.elementId, {
                partitionId: targetVN?.elementId,
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
                reparentViewNodeCoords(file.content.nodes, droppedNodeId, targetPartitionId);
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
                const targetVN = targetPartitionId
                  ? file.content.nodes.find((vn: any) => vn.id === targetPartitionId)
                  : null;
                applyUpdateActivityNode(draft.model, droppedVN.elementId, {
                  partitionId: targetVN?.elementId,
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

  const onDragMoveDetectPartition = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const nodeId = e.target.id();
      if (!nodeId) return;
      const draggedShape = shapes.find((s) => s.id === nodeId);
      if (!draggedShape || !isActivityNodeViewModel(draggedShape.data)) return;

      const nodeBounds = boundsMap.get(nodeId);
      const dropPoint = {
        x: e.target.x() + (nodeBounds ? nodeBounds.width / 2 : 0),
        y: e.target.y() + (nodeBounds ? nodeBounds.height / 2 : 0),
      };

      let found: string | null = null;
      for (const shape of shapes) {
        if (!isActivityPartitionViewModel(shape.data)) continue;
        const b = boundsMap.get(shape.id);
        if (!b) continue;
        if (
          dropPoint.x >= b.x && dropPoint.x <= b.x + b.width &&
          dropPoint.y >= b.y && dropPoint.y <= b.y + b.height
        ) {
          found = shape.id;
          break;
        }
      }
      setHoveredPartitionId((prev) => (prev === found ? prev : found));
    },
    [shapes, boundsMap],
  );

  const onDragEndWithPartitionDetection = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const nodeId = e.target.id();
      if (!nodeId) return;
      const draggedShape = shapes.find((s) => s.id === nodeId);
      if (!draggedShape || !isActivityNodeViewModel(draggedShape.data)) {
        setHoveredPartitionId(null);
        return;
      }

      const nodeBounds = boundsMap.get(nodeId);
      const dropPoint = {
        x: e.target.x() + (nodeBounds ? nodeBounds.width / 2 : 0),
        y: e.target.y() + (nodeBounds ? nodeBounds.height / 2 : 0),
      };

      let found: string | null = null;
      for (const shape of shapes) {
        if (!isActivityPartitionViewModel(shape.data)) continue;
        const b = boundsMap.get(shape.id);
        if (!b) continue;
        if (
          dropPoint.x >= b.x && dropPoint.x <= b.x + b.width &&
          dropPoint.y >= b.y && dropPoint.y <= b.y + b.height
        ) {
          found = shape.id;
          break;
        }
      }
      setHoveredPartitionId(null);
      commitAssignment(nodeId, found);
    },
    [shapes, boundsMap, commitAssignment],
  );

  return { hoveredPartitionId, onDragMoveDetectPartition, onDragEndWithPartitionDetection };
}
