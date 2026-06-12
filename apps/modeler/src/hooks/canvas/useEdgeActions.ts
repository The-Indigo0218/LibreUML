import { useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { getLocalModel } from '../../store/standaloneModelOps';
import { undoTransaction, withUndo } from '../../core/undo/undoBridge';
import type {
  DiagramView,
  VFSFile,
  RelationKind,
  EdgeRoutingMode,
  NodeBorderStyle,
} from '../../core/domain/vfs/vfs.types';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { useToastStore } from '../../store/toast.store';

/**
 * Partial visual-style patch for an edge. Only keys present are touched;
 * a `null` value clears that property (falls back to the kind/base default).
 */
export interface EdgeStylePatch {
  color?: string | null;
  lineWidth?: number | null;
  lineStyle?: NodeBorderStyle | null;
  fontFamily?: string | null;
  fontSize?: number | null;
}

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
      sourceHandle?: string;
      targetHandle?: string;
      sourceAnchor?: { nx: number; ny: number };
      targetAnchor?: { nx: number; ny: number };
    },
  ) => void;
  /**
   * Re-links one end of an edge to a different node (P3 endpoint drag). Mutates
   * the underlying relation's sourceId/targetId and clears the edge's locked
   * anchoring so it floats to the new node. Blocks self-loops for kinds that
   * forbid them. Returns true if the re-link was applied.
   */
  relinkEdgeEndpoint: (
    viewEdgeId: string,
    end: 'source' | 'target',
    newNodeViewId: string,
  ) => boolean;
  /** Replaces an edge's manual waypoints. One undo transaction per call. */
  updateEdgeWaypoints: (
    viewEdgeId: string,
    waypoints: { x: number; y: number }[],
  ) => void;
  /** Sets an edge's line routing style (straight/orthogonal/curved). */
  updateEdgeRoutingMode: (
    viewEdgeId: string,
    routingMode: EdgeRoutingMode,
  ) => void;
  /** Applies a visual style patch (color / line width / line style) to an edge. */
  updateEdgeStyle: (viewEdgeId: string, style: EdgeStylePatch) => void;
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

  const relinkEdgeEndpoint = useCallback(
    (viewEdgeId: string, end: 'source' | 'target', newNodeViewId: string): boolean => {
      if (!activeTabId) return false;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return false;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return false;
      if (!isDiagramView((fileNode as VFSFile).content)) return false;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const viewEdge = currentView.edges.find((ve) => ve.id === viewEdgeId);
      if (!viewEdge) return false;
      const { relationId } = viewEdge;

      // Resolve the dropped node's model element id from its view node.
      const newVN = currentView.nodes.find((vn) => vn.id === newNodeViewId);
      if (!newVN) return false;
      const newElementId = newVN.elementId ?? newVN.id;

      const SELF_LOOP_FORBIDDEN = new Set<RelationKind>(['GENERALIZATION', 'REALIZATION']);
      // No-op + warn if the re-link would create a forbidden self-loop.
      const guardSelfLoop = (rel: { kind: RelationKind; sourceId: string; targetId: string }) => {
        const otherId = end === 'source' ? rel.targetId : rel.sourceId;
        if (newElementId === otherId && SELF_LOOP_FORBIDDEN.has(rel.kind)) {
          useToastStore.getState().show('⚠️ Una relación de herencia no puede apuntar a sí misma');
          return false;
        }
        return true;
      };

      // Clears any anchoring (locked handles + free P4 anchors) so the re-linked
      // edge floats to the new node.
      const clearAnchoring = (ve: any) => {
        delete ve.anchorLocked;
        delete ve.sourceHandle;
        delete ve.targetHandle;
        delete ve.sourceAnchor;
        delete ve.targetAnchor;
      };

      if (isStandalone) {
        const rel = getLocalModel(activeTabId)?.relations[relationId];
        if (!rel || !guardSelfLoop(rel)) return false;
        withUndo('vfs', 'Reconnect Relation', activeTabId, (draft: any) => {
          const node = draft.project?.nodes[activeTabId];
          const r = node?.localModel?.relations[relationId];
          if (!r) return;
          if (end === 'source') r.sourceId = newElementId;
          else r.targetId = newElementId;
          node.localModel.updatedAt = Date.now();
          if (isDiagramView(node.content)) {
            const ve = node.content.edges.find((e: any) => e.id === viewEdgeId);
            if (ve) clearAnchoring(ve);
          }
        });
        return true;
      }

      const rel = useModelStore.getState().model?.relations[relationId];
      if (!rel || !guardSelfLoop(rel)) return false;
      undoTransaction({
        label: 'Reconnect Relation',
        scope: 'global',
        mutations: [
          {
            store: 'model',
            mutate: (draft: any) => {
              const r = draft.model?.relations[relationId];
              if (!r) return;
              if (end === 'source') r.sourceId = newElementId;
              else r.targetId = newElementId;
              draft.model.updatedAt = Date.now();
            },
          },
          {
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
              const ve = node.content.edges.find((e: any) => e.id === viewEdgeId);
              if (ve) clearAnchoring(ve);
            },
          },
        ],
      });
      return true;
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
        sourceHandle?: string;
        targetHandle?: string;
        sourceAnchor?: { nx: number; ny: number };
        targetAnchor?: { nx: number; ny: number };
      },
    ) => {
      if (!activeTabId) return;
      withUndo('vfs', 'Update Edge Properties', activeTabId, (draft: any) => {
        const node = draft.project?.nodes[activeTabId];
        if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
        const idx = node.content.edges.findIndex((ve: any) => ve.id === viewEdgeId);
        if (idx === -1) return;
        node.content.edges[idx] = { ...node.content.edges[idx], ...props };
      });
    },
    [activeTabId, updateFileContent],
  );

  const updateEdgeWaypoints = useCallback(
    (viewEdgeId: string, waypoints: { x: number; y: number }[]) => {
      if (!activeTabId) return;
      withUndo('vfs', 'Edit Edge Waypoints', activeTabId, (draft: any) => {
        const node = draft.project?.nodes[activeTabId];
        if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
        const idx = node.content.edges.findIndex((ve: any) => ve.id === viewEdgeId);
        if (idx === -1) return;
        node.content.edges[idx] = { ...node.content.edges[idx], waypoints };
      });
    },
    [activeTabId],
  );

  const updateEdgeRoutingMode = useCallback(
    (viewEdgeId: string, routingMode: EdgeRoutingMode) => {
      if (!activeTabId) return;
      withUndo('vfs', 'Change Edge Routing', activeTabId, (draft: any) => {
        const node = draft.project?.nodes[activeTabId];
        if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
        const idx = node.content.edges.findIndex((ve: any) => ve.id === viewEdgeId);
        if (idx === -1) return;
        node.content.edges[idx] = { ...node.content.edges[idx], routingMode };
      });
    },
    [activeTabId],
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

  const updateEdgeStyle = useCallback(
    (viewEdgeId: string, style: EdgeStylePatch) => {
      if (!activeTabId) return;
      // View-only change (style lives on the ViewEdge) → single vfs transaction.
      // Only keys present in the patch are touched; null clears the property.
      withUndo('vfs', 'Edit Edge Style', activeTabId, (draft: any) => {
        const node = draft.project?.nodes[activeTabId];
        if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
        const ve = node.content.edges.find((e: any) => e.id === viewEdgeId);
        if (!ve) return;
        if ('color' in style) {
          if (style.color == null) delete ve.color;
          else ve.color = style.color;
        }
        if ('lineWidth' in style) {
          if (style.lineWidth == null) delete ve.lineWidth;
          else ve.lineWidth = style.lineWidth;
        }
        if ('lineStyle' in style) {
          if (style.lineStyle == null) delete ve.lineStyle;
          else ve.lineStyle = style.lineStyle;
        }
        if ('fontFamily' in style) {
          if (style.fontFamily == null) delete ve.fontFamily;
          else ve.fontFamily = style.fontFamily;
        }
        if ('fontSize' in style) {
          if (style.fontSize == null) delete ve.fontSize;
          else ve.fontSize = style.fontSize;
        }
      });
    },
    [activeTabId],
  );

  return { deleteEdgeById, reverseEdgeById, changeEdgeKind, updateVFSEdgeProps, updateEdgeWaypoints, updateEdgeRoutingMode, updateEdgeStyle, relinkEdgeEndpoint };
}
