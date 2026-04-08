import { useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { getLocalModel } from '../../store/standaloneModelOps';
import { undoTransaction, withUndo } from '../../core/undo/undoBridge';
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
  deleteEdgeById: (viewEdgeId: string) => void;
  reverseEdgeById: (viewEdgeId: string) => void;
  changeEdgeKind: (viewEdgeId: string, kind: RelationKind) => void;
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

      const { relationId } = viewEdge;

      if (isStandalone) {
        undoTransaction({
          label: 'Delete Relation',
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE') return;
              if (node.localModel?.relations[relationId]) {
                delete node.localModel.relations[relationId];
                node.localModel.updatedAt = Date.now();
              }
              if (isDiagramView(node.content)) {
                node.content.edges = node.content.edges.filter((ve: any) => ve.id !== viewEdgeId);
              }
            },
          }],
        });
      } else {
        const modelHasRelation = !!(useModelStore.getState().model?.relations[relationId]);
        undoTransaction({
          label: 'Delete Relation',
          scope: 'global',
          mutations: [
            ...(modelHasRelation ? [{
              store: 'model' as const,
              mutate: (draft: any) => {
                if (!draft.model?.relations[relationId]) return;
                delete draft.model.relations[relationId];
                draft.model.updatedAt = Date.now();
              },
            }] : []),
            {
              store: 'vfs' as const,
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                node.content.edges = node.content.edges.filter((ve: any) => ve.id !== viewEdgeId);
              },
            },
          ],
        });
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

      const { relationId } = viewEdge;

      if (isStandalone) {
        const localM = getLocalModel(activeTabId);
        if (!localM) return;
        const relation = localM.relations[relationId];
        if (!relation) return;
        withUndo('vfs', 'Reverse Relation', activeTabId, (draft: any) => {
          const node = draft.project?.nodes[activeTabId];
          if (!node?.localModel?.relations[relationId]) return;
          const rel = node.localModel.relations[relationId];
          const tmp = rel.sourceId;
          rel.sourceId = rel.targetId;
          rel.targetId = tmp;
          node.localModel.updatedAt = Date.now();
        });
      } else {
        const ms = useModelStore.getState();
        if (!ms.model?.relations[relationId]) return;
        withUndo('model', 'Reverse Relation', 'global', (draft: any) => {
          if (!draft.model?.relations[relationId]) return;
          const rel = draft.model.relations[relationId];
          const tmp = rel.sourceId;
          rel.sourceId = rel.targetId;
          rel.targetId = tmp;
          draft.model.updatedAt = Date.now();
        });
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
      withUndo('vfs', 'Update Edge Props', activeTabId, (draft: any) => {
        const node = draft.project?.nodes[activeTabId];
        if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
        const idx = node.content.edges.findIndex((ve: any) => ve.id === viewEdgeId);
        if (idx === -1) return;
        node.content.edges[idx] = { ...node.content.edges[idx], ...props };
      });
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

      const { relationId } = viewEdge;

      if (isStandalone) {
        withUndo('vfs', 'Change Relation Kind', activeTabId, (draft: any) => {
          const node = draft.project?.nodes[activeTabId];
          if (!node?.localModel?.relations[relationId]) return;
          node.localModel.relations[relationId].kind = kind;
          node.localModel.updatedAt = Date.now();
        });
      } else {
        withUndo('model', 'Change Relation Kind', 'global', (draft: any) => {
          if (!draft.model?.relations[relationId]) return;
          draft.model.relations[relationId].kind = kind;
          draft.model.updatedAt = Date.now();
        });
      }
    },
    [activeTabId, isStandalone],
  );

  return { deleteEdgeById, reverseEdgeById, changeEdgeKind, updateVFSEdgeProps };
}
