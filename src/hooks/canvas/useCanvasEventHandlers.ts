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
} from '../../core/domain/vfs/vfs.types';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';

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
  updateFileContent: (fileId: string, content: DiagramView) => void;
}

export interface UseCanvasEventHandlersResult {
  onNodesChange: (changes: KonvaNodeChange[]) => void;
  onEdgesChange: (changes: KonvaEdgeChange[]) => void;
  onConnect: (connection: KonvaConnection) => void;
}

export function useCanvasEventHandlers({
  activeTabId,
  isStandalone,
  updateFileContent,
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

      for (const change of changes) {
        if (change.type === 'position') {
          updatedViewNodes = updatedViewNodes.map((vn) =>
            vn.id === change.id ? { ...vn, x: change.position.x, y: change.position.y } : vn,
          );
          hasPosition = true;
        } else if (change.type === 'remove') {
          const removedVN = currentView.nodes.find((vn) => vn.id === change.id);
          if (removedVN) {
            updatedViewNodes = updatedViewNodes.filter((vn) => vn.id !== change.id);
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
        // Position-only: no undo entry
        updateFileContent(activeTabId, { ...currentView, nodes: updatedViewNodes, edges: updatedViewEdges });
      }
    },
    [activeTabId, updateFileContent, isStandalone],
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
    [activeTabId, updateFileContent, isStandalone],
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
      if (!sourceVN || !targetVN || !sourceVN.elementId || !targetVN.elementId) return;

      const wsState = useWorkspaceStore.getState();
      const rawMode = wsState.connectionModes?.[activeTabId ?? ''] as string | undefined;
      const kind: RelationKind = TOOL_TO_RELATION_KIND[rawMode ?? ''] ?? 'ASSOCIATION';

      const SELF_LOOP_FORBIDDEN = new Set<RelationKind>(['GENERALIZATION', 'REALIZATION']);
      if (sourceVN.elementId === targetVN.elementId && SELF_LOOP_FORBIDDEN.has(kind)) {
        useToastStore.getState().show('⚠️ Una clase no puede heredar de sí misma');
        return;
      }

      const BIDIR_FORBIDDEN = new Set<RelationKind>(['AGGREGATION', 'COMPOSITION']);
      if (BIDIR_FORBIDDEN.has(kind)) {
        const activeModel = isStandalone ? getLocalModel(activeTabId) : useModelStore.getState().model;
        if (activeModel) {
          const hasBidir = Object.values(activeModel.relations).some(
            (rel) =>
              rel.sourceId === targetVN.elementId &&
              rel.targetId === sourceVN.elementId &&
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
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
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
                id: newRelationId, kind, sourceId: sourceVN.elementId, targetId: targetVN.elementId,
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
                  sourceId: sourceVN.elementId, targetId: targetVN.elementId,
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
    [activeTabId, updateFileContent, isStandalone],
  );

  return { onNodesChange, onEdgesChange, onConnect };
}
