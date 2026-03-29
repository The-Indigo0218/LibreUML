import { useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useToastStore } from '../../store/toast.store';
import {
  standaloneModelOps,
  getLocalModel,
} from '../../store/standaloneModelOps';
import type {
  DiagramView,
  VFSFile,
} from '../../core/domain/vfs/vfs.types';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';

export interface UseNodeActionsParams {
  activeTabId: string | null;
  isStandalone: boolean;
  updateFileContent: (fileId: string, content: DiagramView) => void;
}

export interface UseNodeActionsResult {
  /**
   * View-only removal: removes ViewNode + prunes dangling ViewEdges from THIS
   * diagram only. Semantic element stays in ModelStore (appears in other diagrams).
   */
  removeNodeFromDiagram: (viewNodeId: string) => void;
  /**
   * Full cascade: deletes semantic element from ModelStore + sweeps ViewNodes from
   * ALL diagrams where the element appears. Use for "Delete from Model".
   */
  deleteElementFromModel: (viewNodeId: string) => void;
}

export function useNodeActions({
  activeTabId,
  isStandalone,
  updateFileContent,
}: UseNodeActionsParams): UseNodeActionsResult {
  // ── removeNodeFromDiagram: view-only removal (context menu "Remove from Diagram") ──

  const removeNodeFromDiagram = useCallback(
    (viewNodeId: string) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const removedVN = currentView.nodes.find((vn) => vn.id === viewNodeId);
      if (!removedVN) return;

      const updatedNodes = currentView.nodes.filter((vn) => vn.id !== viewNodeId);

      // Prune ViewEdges involving this element — no cascade into any model store.
      let updatedEdges = currentView.edges;
      if (removedVN.elementId) {
        const activeModel = isStandalone && activeTabId
          ? getLocalModel(activeTabId)
          : useModelStore.getState().model;
        if (activeModel) {
          updatedEdges = currentView.edges.filter((ve) => {
            const relation = activeModel.relations[ve.relationId];
            if (!relation) return false;
            return (
              relation.sourceId !== removedVN.elementId &&
              relation.targetId !== removedVN.elementId
            );
          });
        }
      }

      updateFileContent(activeTabId, { ...currentView, nodes: updatedNodes, edges: updatedEdges });
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  // ── deleteElementFromModel: cascade delete + sweep all diagrams ─────────────

  const deleteElementFromModel = useCallback(
    (viewNodeId: string) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const removedVN = currentView.nodes.find((vn) => vn.id === viewNodeId);
      if (!removedVN?.elementId) return;

      const elementId = removedVN.elementId;

      if (isStandalone) {
        // Standalone path: delete from localModel only — no global cascade.
        const localM = getLocalModel(activeTabId);
        if (!localM) return;

        const elementName =
          localM.classes[elementId]?.name ??
          localM.interfaces[elementId]?.name ??
          localM.enums[elementId]?.name ??
          'Element';

        const ops = standaloneModelOps(activeTabId);
        if (localM.classes[elementId])         ops.deleteClass(elementId);
        else if (localM.interfaces[elementId]) ops.deleteInterface(elementId);
        else if (localM.enums[elementId])      ops.deleteEnum(elementId);

        useToastStore.getState().show(`"${elementName}" deleted from standalone diagram`);

        // Sweep this file's DiagramView only (relations cascade-deleted inside ops).
        const modelAfterDelete = getLocalModel(activeTabId);
        const updatedNodes = currentView.nodes.filter((vn) => vn.elementId !== elementId);
        const updatedEdges = currentView.edges.filter(
          (ve) => modelAfterDelete && !!modelAfterDelete.relations[ve.relationId],
        );
        updateFileContent(activeTabId, { ...currentView, nodes: updatedNodes, edges: updatedEdges });
        return;
      }

      // Cascade delete from ModelStore (removes IRRelation entries too).
      const ms = useModelStore.getState();
      if (ms.model) {
        const elementName =
          ms.model.classes[elementId]?.name ??
          ms.model.interfaces[elementId]?.name ??
          ms.model.enums[elementId]?.name ??
          'Element';

        if (ms.model.classes[elementId])         ms.deleteClass(elementId);
        else if (ms.model.interfaces[elementId]) ms.deleteInterface(elementId);
        else if (ms.model.enums[elementId])      ms.deleteEnum(elementId);

        useToastStore.getState().show(`"${elementName}" deleted from model`);
      }

      // Sweep ALL diagram files: remove the ViewNode and prune orphaned ViewEdges.
      const modelAfterDelete = useModelStore.getState().model;
      const projectAfterDelete = useVFSStore.getState().project;
      if (!projectAfterDelete) return;

      for (const [nodeId, node] of Object.entries(projectAfterDelete.nodes)) {
        if (node.type !== 'FILE') continue;
        const content = (node as VFSFile).content;
        if (!isDiagramView(content)) continue;

        const view = content as DiagramView;
        const hasElement = view.nodes.some((vn) => vn.elementId === elementId);
        if (!hasElement) continue;

        const updatedNodes = view.nodes.filter((vn) => vn.elementId !== elementId);
        const updatedEdges = view.edges.filter(
          (ve) => modelAfterDelete && !!modelAfterDelete.relations[ve.relationId],
        );
        useVFSStore.getState().updateFileContent(nodeId, { ...view, nodes: updatedNodes, edges: updatedEdges });
      }
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  return {
    removeNodeFromDiagram,
    deleteElementFromModel,
  };
}
