import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useUiStore } from "../../../../store/uiStore";
import { useSelectionStore } from "../../../../store/selection.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useModelStore } from "../../../../store/model.store";
import { standaloneModelOps, getLocalModel } from "../../../../store/standaloneModelOps";
import { isDiagramView } from "../useVFSCanvasController";
import type { VFSFile, DiagramView } from "../../../../core/domain/vfs/vfs.types";

/**
 * Edit Actions — reads selection from useSelectionStore (Zustand).
 *
 * Selection is synced from React Flow → store via DiagramCanvas.onSelectionChange.
 * All actions here read from the store, making selection state accessible outside
 * the React Flow context (clipboard, toolbars, future integrations).
 */
export const useEditActions = () => {
  const { openSSoTClassEditor } = useUiStore();
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  // ── Selection actions ────────────────────────────────────────────────────

  const selectAll = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    setNodes(nodes.map((node) => ({ ...node, selected: true })));
    setEdges(edges.map((edge) => ({ ...edge, selected: true })));

    // Sync to store (onSelectionChange will also fire, but this is immediate)
    useSelectionStore.getState().setSelection(
      nodes.map((n) => n.id),
      edges.map((e) => e.id),
    );
  }, [getNodes, getEdges, setNodes, setEdges]);

  const deselectAll = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    setNodes(nodes.map((node) => ({ ...node, selected: false })));
    setEdges(edges.map((edge) => ({ ...edge, selected: false })));

    useSelectionStore.getState().clear();
  }, [getNodes, getEdges, setNodes, setEdges]);

  // ── Edit selected ────────────────────────────────────────────────────────

  const editSelected = useCallback(() => {
    const { selectedNodeIds } = useSelectionStore.getState();
    if (selectedNodeIds.length !== 1) return;

    const viewNodeId = selectedNodeIds[0];

    // Resolve the semantic elementId for the SSoT editor
    const activeTabId = useWorkspaceStore.getState().activeTabId;
    if (!activeTabId) return;
    const project = useVFSStore.getState().project;
    if (!project) return;
    const fileNode = project.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') return;
    if (!isDiagramView((fileNode as VFSFile).content)) return;

    const view = (fileNode as VFSFile).content as DiagramView;
    const viewNode = view.nodes.find((vn) => vn.id === viewNodeId);
    if (viewNode?.elementId) {
      openSSoTClassEditor(viewNode.elementId);
    }
  }, [openSSoTClassEditor]);

  // ── Delete selected (VFS) ────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    const { selectedNodeIds, selectedEdgeIds } = useSelectionStore.getState();
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;

    const activeTabId = useWorkspaceStore.getState().activeTabId;
    if (!activeTabId) return;
    const currentProject = useVFSStore.getState().project;
    if (!currentProject) return;
    const fileNode = currentProject.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') return;
    if (!isDiagramView((fileNode as VFSFile).content)) return;

    const currentView = (fileNode as VFSFile).content as DiagramView;
    const isStandalone = (fileNode as VFSFile).standalone === true;

    // Remove selected edges from model + view
    let updatedEdges = currentView.edges;
    for (const edgeId of selectedEdgeIds) {
      const viewEdge = updatedEdges.find((ve) => ve.id === edgeId);
      if (!viewEdge) continue;

      if (isStandalone) {
        standaloneModelOps(activeTabId).deleteRelation(viewEdge.relationId);
      } else {
        const ms = useModelStore.getState();
        if (ms.model?.relations[viewEdge.relationId]) {
          ms.deleteRelation(viewEdge.relationId);
        }
      }
      updatedEdges = updatedEdges.filter((ve) => ve.id !== edgeId);
    }

    // Remove selected nodes from view + prune their edges
    let updatedNodes = currentView.nodes;
    for (const nodeId of selectedNodeIds) {
      const removedVN = updatedNodes.find((vn) => vn.id === nodeId);
      if (!removedVN) continue;

      updatedNodes = updatedNodes.filter((vn) => vn.id !== nodeId);

      // Prune dangling edges whose relation involves this element
      if (removedVN.elementId) {
        const activeModel = isStandalone
          ? getLocalModel(activeTabId)
          : useModelStore.getState().model;
        if (activeModel) {
          updatedEdges = updatedEdges.filter((ve) => {
            const relation = activeModel.relations[ve.relationId];
            if (!relation) return false;
            return (
              relation.sourceId !== removedVN.elementId &&
              relation.targetId !== removedVN.elementId
            );
          });
        }
      }
    }

    useVFSStore.getState().updateFileContent(activeTabId, {
      ...currentView,
      nodes: updatedNodes,
      edges: updatedEdges,
    });

    useSelectionStore.getState().clear();
  }, []);

  // ── Duplicate selected (TODO: VFS implementation) ────────────────────────

  const duplicateSelected = useCallback(() => {
    const { selectedNodeIds } = useSelectionStore.getState();
    if (selectedNodeIds.length === 0) return;

    // TODO: Implement VFS-based duplication.
    // This requires creating new IR elements in ModelStore/localModel,
    // cloning their attributes/operations, and adding new ViewNodes.
    console.warn("TODO: VFS duplicate not yet implemented");
  }, []);

  // ── Undo/Redo stubs ─────────────────────────────────────────────────────

  const undo = useCallback(() => {
    console.warn("TODO: SSOT - Undo not implemented. Requires history middleware (e.g., zundo)");
  }, []);

  const redo = useCallback(() => {
    console.warn("TODO: SSOT - Redo not implemented. Requires history middleware (e.g., zundo)");
  }, []);

  return {
    selectAll,
    deselectAll,
    duplicateSelected,
    deleteSelected,
    editSelected,
    undo,
    redo,
  };
};
