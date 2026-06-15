import { useCallback } from 'react';
import type { KonvaNodeChange, KonvaEdgeChange, KonvaConnection } from '../../canvas/types/canvas.types';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { useToastStore } from '../../store/toast.store';
import { getLocalModel } from '../../store/standaloneModelOps';
import { undoTransaction, withUndo } from '../../core/undo/undoBridge';
import type {
  DiagramView,
  VFSFile,
  ViewEdge,
  RelationKind,
  MessageKind,
  IRMessage,
} from '../../core/domain/vfs/vfs.types';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { getAbsolutePosition } from '../../features/diagram/hooks/controllers/sharedNodeBuilders';
import { yToMessageSlot, computeSlotLayout } from '../../features/diagram/hooks/controllers/sequenceDiagramNodes';
import { standaloneModelOps } from '../../store/standaloneModelOps';
import {
  TOOL_TO_MESSAGE_KIND,
  defaultMessageName,
  findMatchingSyncForReply,
  nextMessageSequenceNumber,
  autoAssignFragmentForNewMessage,
} from './sequenceMessageHelpers';

const TOOL_TO_RELATION_KIND: Record<string, RelationKind> = {
  ASSOCIATION:    'ASSOCIATION',
  INHERITANCE:    'GENERALIZATION',
  IMPLEMENTATION: 'REALIZATION',
  DEPENDENCY:     'DEPENDENCY',
  AGGREGATION:    'AGGREGATION',
  COMPOSITION:    'COMPOSITION',
  INCLUDE:        'INCLUDE',
  EXTEND:         'EXTEND',
  GENERALIZATION: 'GENERALIZATION',
};

export interface UseCanvasEventHandlersParams {
  activeTabId: string | null;
  isStandalone: boolean;
}

export interface UseCanvasEventHandlersResult {
  onNodesChange: (changes: KonvaNodeChange[]) => void;
  onEdgesChange: (changes: KonvaEdgeChange[]) => void;
  onConnect: (connection: KonvaConnection) => void;
}

export function useCanvasEventHandlers({
  activeTabId,
  isStandalone,
}: UseCanvasEventHandlersParams): UseCanvasEventHandlersResult {
  const onNodesChange = useCallback(
    (changes: KonvaNodeChange[]) => {
      if (!activeTabId) return;

      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      let updatedViewNodes = currentView.nodes;
      let updatedViewEdges = currentView.edges;
      let hasRemove = false;
      let hasPosition = false;

      // IDs moved in THIS batch. When a package is dragged, its children are
      // dragged with it (same delta), so they appear here too.
      const movedIds = new Set(
        changes.filter((c) => c.type === 'position').map((c) => c.id),
      );

      for (const change of changes) {
        if (change.type === 'position') {
          updatedViewNodes = updatedViewNodes.map((vn) => {
            if (vn.id !== change.id) return vn;
            if (vn.parentPackageId) {
              // Rigid group move: if the parent moved in this same drag, the
              // child's RELATIVE position is unchanged — only the parent's
              // absolute position changes. Recomputing from the snapped absolute
              // would double-count the delta and drift by grid snapping, leaving
              // children visually offset from their package.
              if (movedIds.has(vn.parentPackageId)) return vn;
              // Child dragged on its own: convert the absolute drop point to a
              // position relative to the parent's *absolute* position (handles
              // nested packages, not just top-level parents).
              const parentNode = currentView.nodes.find((n) => n.id === vn.parentPackageId);
              if (parentNode) {
                const parentAbs = getAbsolutePosition(parentNode, currentView.nodes);
                return {
                  ...vn,
                  x: change.position.x - parentAbs.x,
                  y: change.position.y - parentAbs.y,
                };
              }
            }
            return { ...vn, x: change.position.x, y: change.position.y };
          });
          hasPosition = true;
        } else if (change.type === 'remove') {
          const removedVN = currentView.nodes.find((vn) => vn.id === change.id);
          if (removedVN) {
            updatedViewNodes = updatedViewNodes
              .filter((vn) => vn.id !== change.id)
              .map((vn) => vn.parentPackageId === change.id ? { ...vn, parentPackageId: null } : vn);
            if (removedVN.elementId) {
              const activeModel = isStandalone ? getLocalModel(activeTabId) : useModelStore.getState().model;
              if (activeModel) {
                updatedViewEdges = updatedViewEdges.filter((ve) => {
                  const rel = activeModel.relations[ve.relationId];
                  if (!rel) return false;
                  return rel.sourceId !== removedVN.elementId && rel.targetId !== removedVN.elementId;
                });
              }
            }
            hasRemove = true;
          }
        }
      }

      if (!hasRemove && !hasPosition) return;

      if (hasRemove) {
        withUndo('vfs', 'Remove from Diagram', activeTabId, (draft: any) => {
          const node = draft.project?.nodes[activeTabId];
          if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
          node.content.nodes = updatedViewNodes;
          node.content.edges = updatedViewEdges;
        });
      } else {
        withUndo('vfs', 'Move Node', activeTabId, (draft: any) => {
          const node = draft.project?.nodes[activeTabId];
          if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
          node.content.nodes = updatedViewNodes;
        });
      }
    },
    [activeTabId, isStandalone],
  );

  const onEdgesChange = useCallback(
    (changes: KonvaEdgeChange[]) => {
      if (!activeTabId) return;

      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length === 0) return;

      const relationIds = removeChanges
        .map((c) => currentView.edges.find((ve) => ve.id === c.id)?.relationId)
        .filter(Boolean) as string[];

      if (isStandalone) {
        undoTransaction({
          label: 'Delete Relation',
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE') return;
              if (node.localModel) {
                for (const rid of relationIds) {
                  delete node.localModel.relations[rid];
                }
                node.localModel.updatedAt = Date.now();
              }
              if (isDiagramView(node.content)) {
                const removeIds = new Set(removeChanges.map((c) => c.id));
                node.content.edges = node.content.edges.filter((ve: any) => !removeIds.has(ve.id));
              }
            },
          }],
        });
      } else {
        undoTransaction({
          label: 'Delete Relation',
          scope: 'global',
          mutations: [
            {
              store: 'model',
              mutate: (draft: any) => {
                if (!draft.model) return;
                for (const rid of relationIds) {
                  if (draft.model.relations[rid]) {
                    delete draft.model.relations[rid];
                  }
                }
                draft.model.updatedAt = Date.now();
              },
            },
            {
              store: 'vfs',
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                const removeIds = new Set(removeChanges.map((c) => c.id));
                node.content.edges = node.content.edges.filter((ve: any) => !removeIds.has(ve.id));
              },
            },
          ],
        });
      }
    },
    [activeTabId, isStandalone],
  );

  const onConnect = useCallback(
    (connection: KonvaConnection) => {
      if (!activeTabId || !connection.source || !connection.target) return;

      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const sourceVN = currentView.nodes.find((vn) => vn.id === connection.source);
      const targetVN = currentView.nodes.find((vn) => vn.id === connection.target);
      if (!sourceVN || !targetVN) return;

      // ── Sequence diagram branch: create an IRMessage instead of an IRRelation ──
      if ((fileNode as VFSFile).diagramType === 'SEQUENCE_DIAGRAM') {
        const activeModel = isStandalone
          ? getLocalModel(activeTabId)
          : useModelStore.getState().model;
        if (!activeModel) return;

        const srcLifelineId = sourceVN.elementId;
        const tgtLifelineId = targetVN.elementId;

        // Both endpoints must resolve to actual lifelines in the active model.
        if (!srcLifelineId || !tgtLifelineId) return;
        if (!activeModel.lifelines?.[srcLifelineId] || !activeModel.lifelines?.[tgtLifelineId]) {
          useToastStore.getState().show('⚠️ Los mensajes deben conectar dos lifelines');
          return;
        }
        // Self-messages are created via the lifeline's "Create Self Message"
        // context action (which seeds the nested activation) — not by drawing a
        // connection back onto the same lifeline.
        if (srcLifelineId === tgtLifelineId) {
          useToastStore.getState().show('⚠️ Usa «Create Self Message» (clic derecho en la lifeline)');
          return;
        }

        const wsState = useWorkspaceStore.getState();
        const rawMode = wsState.connectionModes?.[activeTabId ?? ''] as string | undefined;
        const messageKind: MessageKind =
          TOOL_TO_MESSAGE_KIND[rawMode ?? ''] ?? 'SYNC';

        const existingMessages = activeModel.messages ?? {};
        const messageCount = Object.keys(existingMessages).length;
        // P1 — insert at the slot under the drop point. yToMessageSlot clamps to
        // [1, messageCount + 1]; the +1 lets a drop below the last message append.
        // No drop point (programmatic/fallback) → append at the end as before.
        // P4 — invert through the same variable slot layout the builder renders.
        const sequenceNumber =
          connection.dropY != null
            ? yToMessageSlot(connection.dropY, messageCount + 1, computeSlotLayout(activeModel))
            : nextMessageSequenceNumber(existingMessages);

        const inReplyTo =
          messageKind === 'REPLY'
            ? findMatchingSyncForReply(existingMessages, srcLifelineId, tgtLifelineId)
            : undefined;

        // Auto-assign to a containing fragment when the previous message lives
        // in one (sequential heuristic — see helper docs).
        const autoAssignment = autoAssignFragmentForNewMessage(
          activeModel.interactionFragments ?? {},
          existingMessages,
          srcLifelineId,
          tgtLifelineId,
          sequenceNumber,
        );

        const payload: Omit<IRMessage, 'id' | 'kind'> = {
          name: defaultMessageName(messageKind),
          messageKind,
          sourceLifelineId: srcLifelineId,
          targetLifelineId: tgtLifelineId,
          sequenceNumber,
          ...(inReplyTo ? { inReplyTo } : {}),
          ...(autoAssignment ? { fragmentId: autoAssignment.fragmentId } : {}),
        };

        // insertMessageAt shifts existing messages at/after the slot down by one;
        // when the slot is messageCount + 1 it degenerates to a plain append.
        let newMessageId: string;
        if (isStandalone) {
          newMessageId = standaloneModelOps(activeTabId).insertMessageAt(payload);
        } else {
          newMessageId = useModelStore.getState().insertMessageAt(payload);
        }

        // Push the new message into the matched operand's messageIds.
        if (autoAssignment) {
          const ops = isStandalone
            ? standaloneModelOps(activeTabId)
            : useModelStore.getState();
          const refreshedModel = isStandalone
            ? getLocalModel(activeTabId)
            : useModelStore.getState().model;
          const frag = refreshedModel?.interactionFragments?.[autoAssignment.fragmentId];
          if (frag) {
            const updatedOperands = frag.operands.map((op) =>
              op.id === autoAssignment.operandId
                ? { ...op, messageIds: [...op.messageIds, newMessageId] }
                : op,
            );
            ops.updateFragment(autoAssignment.fragmentId, { operands: updatedOperands });
          }
        }
        return;
      }

      // Notes have no semantic elementId — use the viewNode.id as the relation endpoint.
      const sourceIsNote = !sourceVN.elementId;
      const targetIsNote = !targetVN.elementId;
      const sourceElementId = sourceVN.elementId || sourceVN.id;
      const targetElementId = targetVN.elementId || targetVN.id;

      const wsState = useWorkspaceStore.getState();
      const rawMode = wsState.connectionModes?.[activeTabId ?? ''] as string | undefined;
      const activeModel = isStandalone ? getLocalModel(activeTabId) : useModelStore.getState().model;
      const sourceIsPkg = !sourceIsNote && !!(activeModel?.packages[sourceElementId]);
      const targetIsPkg = !targetIsNote && !!(activeModel?.packages[targetElementId]);
      const kind: RelationKind =
        sourceIsNote || targetIsNote
          ? 'DEPENDENCY'
          : sourceIsPkg && targetIsPkg
            ? 'DEPENDENCY'
            : (TOOL_TO_RELATION_KIND[rawMode ?? ''] ?? 'ASSOCIATION');

      const SELF_LOOP_FORBIDDEN = new Set<RelationKind>(['GENERALIZATION', 'REALIZATION']);
      if (sourceElementId === targetElementId && SELF_LOOP_FORBIDDEN.has(kind)) {
        useToastStore.getState().show('⚠️ Una clase no puede heredar de sí misma');
        return;
      }

      const BIDIR_FORBIDDEN = new Set<RelationKind>(['AGGREGATION', 'COMPOSITION']);
      if (BIDIR_FORBIDDEN.has(kind)) {
        const activeModel = isStandalone ? getLocalModel(activeTabId) : useModelStore.getState().model;
        if (activeModel) {
          const hasBidir = Object.values(activeModel.relations).some(
            (rel) =>
              rel.sourceId === targetElementId &&
              rel.targetId === sourceElementId &&
              BIDIR_FORBIDDEN.has(rel.kind),
          );
          if (hasBidir) {
            useToastStore.getState().show('⚠️ Relación inválida según normas UML ISO');
            return;
          }
        }
      }

      const newRelationId = crypto.randomUUID();
      const newViewEdge: ViewEdge = {
        id: crypto.randomUUID(),
        relationId: newRelationId,
        waypoints: [],
        // P4 — drawn edges anchor to the continuous border point where each end
        // was placed (free border default).
        ...(connection.sourceAnchor ? { sourceAnchor: connection.sourceAnchor } : {}),
        ...(connection.targetAnchor ? { targetAnchor: connection.targetAnchor } : {}),
        // Freshly drawn edges default to free-form straight; legacy edges (no
        // routingMode) keep orthogonal so existing diagrams look unchanged.
        routingMode: 'straight',
      };
      const isExternalFile = !!(fileNode as VFSFile).isExternal;

      if (isStandalone) {
        undoTransaction({
          label: 'Create Relation',
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !node.localModel) return;
              node.localModel.relations[newRelationId] = {
                id: newRelationId, kind, sourceId: sourceElementId, targetId: targetElementId,
              };
              node.localModel.updatedAt = Date.now();
              if (isDiagramView(node.content)) {
                node.content.edges.push(newViewEdge);
              }
            },
          }],
        });
      } else {
        undoTransaction({
          label: 'Create Relation',
          scope: 'global',
          mutations: [
            {
              store: 'model',
              mutate: (draft: any) => {
                if (!draft.model) return;
                draft.model.relations[newRelationId] = {
                  id: newRelationId, kind,
                  sourceId: sourceElementId, targetId: targetElementId,
                  ...(isExternalFile ? { isExternal: true } : {}),
                };
                draft.model.updatedAt = Date.now();
              },
            },
            {
              store: 'vfs',
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                node.content.edges.push(newViewEdge);
              },
            },
          ],
        });
      }
    },
    [activeTabId, isStandalone],
  );

  return { onNodesChange, onEdgesChange, onConnect };
}
