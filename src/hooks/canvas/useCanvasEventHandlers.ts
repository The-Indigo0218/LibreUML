import { useCallback } from 'react';
import type { KonvaNodeChange, KonvaEdgeChange, KonvaConnection } from '../../canvas/types/canvas.types';
import { useVFSStore, withoutUndo } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { useToastStore } from '../../store/toast.store';
import {
  standaloneModelOps,
  getLocalModel,
} from '../../store/standaloneModelOps';
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
  /**
   * onNodesChange handler wired to the VFS layer.
   * POSITION: persists x,y → DiagramView.ViewNode.
   * REMOVE: view-only — removes ViewNode + prunes dangling ViewEdges from this
   *         diagram only. Semantic element stays in ModelStore.
   */
  onNodesChange: (changes: KonvaNodeChange[]) => void;
  /**
   * onEdgesChange handler wired to the VFS layer.
   * REMOVE: deletes IRRelation from ModelStore + removes ViewEdge from DiagramView.
   */
  onEdgesChange: (changes: KonvaEdgeChange[]) => void;
  /**
   * onConnect handler: creates IRRelation in ModelStore + ViewEdge in DiagramView.
   * Default relation kind is ASSOCIATION.
   */
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

      // Read current state directly — this is an event handler, not a render.
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      let updatedViewNodes = currentView.nodes;
      let updatedViewEdges = currentView.edges;
      let dirty = false;

      for (const change of changes) {
        if (change.type === 'position') {
          updatedViewNodes = updatedViewNodes.map((vn) =>
            vn.id === change.id
              ? { ...vn, x: change.position.x, y: change.position.y }
              : vn,
          );
          dirty = true;
        } else if (change.type === 'remove') {
          const removedVN = currentView.nodes.find((vn) => vn.id === change.id);
          if (removedVN) {
            updatedViewNodes = updatedViewNodes.filter((vn) => vn.id !== change.id);

            if (removedVN.elementId) {
              const activeModel = isStandalone && activeTabId
                ? getLocalModel(activeTabId)
                : useModelStore.getState().model;
              if (activeModel) {
                updatedViewEdges = updatedViewEdges.filter((ve) => {
                  const relation = activeModel.relations[ve.relationId];
                  if (!relation) return false;
                  return (
                    relation.sourceId !== removedVN.elementId &&
                    relation.targetId !== removedVN.elementId
                  );
                });
              }
            }
            dirty = true;
          }
        }
      }

      if (dirty) {
        const hasSemanticChange = changes.some((c) => c.type === 'remove');
        const commit = () =>
          updateFileContent(activeTabId, {
            ...currentView,
            nodes: updatedViewNodes,
            edges: updatedViewEdges,
          });

        if (hasSemanticChange) {
          commit();
        } else {
          withoutUndo(commit);
        }
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
      let updatedEdges = currentView.edges;
      let dirty = false;

      // CRITICAL FIX: Pause temporal tracking on BOTH stores before making changes
      const vfsTemporalStore = useVFSStore.temporal.getState();
      const modelTemporalStore = useModelStore.temporal.getState();
      
      vfsTemporalStore.pause();
      modelTemporalStore.pause();

      try {
        for (const change of changes) {
          if (change.type === 'remove') {
            const viewEdge = currentView.edges.find((ve) => ve.id === change.id);
            if (viewEdge) {
              if (isStandalone) {
                standaloneModelOps(activeTabId).deleteRelation(viewEdge.relationId);
              } else {
                const ms = useModelStore.getState();
                if (ms.model && ms.model.relations[viewEdge.relationId]) {
                  ms.deleteRelation(viewEdge.relationId);
                }
              }
              updatedEdges = updatedEdges.filter((ve) => ve.id !== change.id);
              dirty = true;
            }
          }
        }

        if (dirty) {
          updateFileContent(activeTabId, { ...currentView, edges: updatedEdges });
        }
      } finally {
        // CRITICAL: Resume tracking and create a single undo checkpoint
        vfsTemporalStore.resume();
        modelTemporalStore.resume();
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
      if (!sourceVN || !targetVN) return;

      if (!sourceVN.elementId || !targetVN.elementId) return;

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
        const activeModel = isStandalone && activeTabId
          ? getLocalModel(activeTabId)
          : useModelStore.getState().model;
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

      // CRITICAL FIX: Pause temporal tracking on BOTH stores before making changes
      const vfsTemporalStore = useVFSStore.temporal.getState();
      const modelTemporalStore = useModelStore.temporal.getState();
      
      vfsTemporalStore.pause();
      modelTemporalStore.pause();

      try {
        let relationId: string;
        if (isStandalone) {
          relationId = standaloneModelOps(activeTabId).createRelation({
            kind,
            sourceId: sourceVN.elementId,
            targetId: targetVN.elementId,
          });
        } else {
          const ms = useModelStore.getState();
          if (!ms.model) return;
          const isExternalFile = !!(fileNode as VFSFile).isExternal;
          relationId = ms.createRelation({
            kind,
            sourceId: sourceVN.elementId,
            targetId: targetVN.elementId,
            ...(isExternalFile ? { isExternal: true } : {}),
          });
        }

        // Create visual ViewEdge linked to the new relation.
        const viewEdge: ViewEdge = {
          id: crypto.randomUUID(),
          relationId,
          waypoints: [],
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
        };

        updateFileContent(activeTabId, {
          ...currentView,
          edges: [...currentView.edges, viewEdge],
        });
      } finally {
        // CRITICAL: Resume tracking and create a single undo checkpoint
        vfsTemporalStore.resume();
        modelTemporalStore.resume();
      }
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  return {
    onNodesChange,
    onEdgesChange,
    onConnect,
  };
}
