import { useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import {
  standaloneModelOps,
  getLocalModel,
} from '../../store/standaloneModelOps';
import type {
  DiagramView,
  VFSFile,
  RelationKind,
} from '../../core/domain/vfs/vfs.types';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';

export interface UseEdgeActionsParams {
  activeTabId: string | null;
  isStandalone: boolean;
  updateFileContent: (fileId: string, content: DiagramView) => void;
}

export interface UseEdgeActionsResult {
  /** Deletes a VFS edge by ViewEdge.id (removes IRRelation + ViewEdge). */
  deleteEdgeById: (viewEdgeId: string) => void;
  /** Reverses a VFS edge by swapping IRRelation.sourceId ↔ targetId. */
  reverseEdgeById: (viewEdgeId: string) => void;
  /** Updates a VFS edge's IRRelation.kind (e.g. ASSOCIATION → GENERALIZATION). */
  changeEdgeKind: (viewEdgeId: string, kind: RelationKind) => void;
  /** Updates display properties (multiplicity, roles, anchor) stored on ViewEdge. */
  updateVFSEdgeProps: (
    viewEdgeId: string,
    props: {
      sourceMultiplicity?: string;
      targetMultiplicity?: string;
      sourceRole?: string;
      targetRole?: string;
      anchorLocked?: boolean;
    },
  ) => void;
}

export function useEdgeActions({
  activeTabId,
  isStandalone,
  updateFileContent,
}: UseEdgeActionsParams): UseEdgeActionsResult {
  const deleteEdgeById = useCallback(
    (viewEdgeId: string) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const viewEdge = currentView.edges.find((ve) => ve.id === viewEdgeId);
      if (!viewEdge) return;

      // CRITICAL FIX: Pause temporal tracking on BOTH stores before making changes
      // This ensures all updates are treated as a single atomic operation for undo/redo
      const vfsTemporalStore = useVFSStore.temporal.getState();
      const modelTemporalStore = useModelStore.temporal.getState();
      
      vfsTemporalStore.pause();
      modelTemporalStore.pause();

      try {
        if (isStandalone) {
          standaloneModelOps(activeTabId).deleteRelation(viewEdge.relationId);
        } else {
          const ms = useModelStore.getState();
          if (ms.model && ms.model.relations[viewEdge.relationId]) {
            ms.deleteRelation(viewEdge.relationId);
          }
        }
        updateFileContent(activeTabId, {
          ...currentView,
          edges: currentView.edges.filter((ve) => ve.id !== viewEdgeId),
        });
      } finally {
        // CRITICAL: Resume tracking and create a single undo checkpoint
        vfsTemporalStore.resume();
        modelTemporalStore.resume();
      }
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  const reverseEdgeById = useCallback(
    (viewEdgeId: string) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const viewEdge = currentView.edges.find((ve) => ve.id === viewEdgeId);
      if (!viewEdge) return;

      // CRITICAL FIX: Pause temporal tracking on model store (only model changes)
      const modelTemporalStore = useModelStore.temporal.getState();
      modelTemporalStore.pause();

      try {
        if (isStandalone) {
          const localM = getLocalModel(activeTabId);
          if (!localM) return;
          const relation = localM.relations[viewEdge.relationId];
          if (!relation) return;
          standaloneModelOps(activeTabId).updateRelation(viewEdge.relationId, {
            sourceId: relation.targetId,
            targetId: relation.sourceId,
          });
        } else {
          const ms = useModelStore.getState();
          if (!ms.model) return;
          const relation = ms.model.relations[viewEdge.relationId];
          if (!relation) return;
          ms.updateRelation(viewEdge.relationId, {
            sourceId: relation.targetId,
            targetId: relation.sourceId,
          });
        }
      } finally {
        // CRITICAL: Resume tracking and create a single undo checkpoint
        modelTemporalStore.resume();
      }
    },
    [activeTabId, isStandalone],
  );

  const updateVFSEdgeProps = useCallback(
    (
      viewEdgeId: string,
      props: {
        sourceMultiplicity?: string;
        targetMultiplicity?: string;
        sourceRole?: string;
        targetRole?: string;
        anchorLocked?: boolean;
      },
    ) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const updatedEdges = currentView.edges.map((ve) =>
        ve.id === viewEdgeId ? { ...ve, ...props } : ve,
      );
      updateFileContent(activeTabId, { ...currentView, edges: updatedEdges });
    },
    [activeTabId, updateFileContent],
  );

  const changeEdgeKind = useCallback(
    (viewEdgeId: string, kind: RelationKind) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const viewEdge = currentView.edges.find((ve) => ve.id === viewEdgeId);
      if (!viewEdge) return;

      // CRITICAL FIX: Pause temporal tracking on model store (only model changes)
      const modelTemporalStore = useModelStore.temporal.getState();
      modelTemporalStore.pause();

      try {
        if (isStandalone) {
          standaloneModelOps(activeTabId).updateRelation(viewEdge.relationId, { kind });
        } else {
          const ms = useModelStore.getState();
          if (!ms.model) return;
          ms.updateRelation(viewEdge.relationId, { kind });
        }
      } finally {
        // CRITICAL: Resume tracking and create a single undo checkpoint
        modelTemporalStore.resume();
      }
    },
    [activeTabId, isStandalone],
  );

  return {
    deleteEdgeById,
    reverseEdgeById,
    changeEdgeKind,
    updateVFSEdgeProps,
  };
}
