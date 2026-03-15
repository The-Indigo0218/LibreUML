import { useCallback } from "react";
import { useUiStore } from "../../../../store/uiStore";
import { useProjectStore } from "../../../../store/project.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useReactFlow } from "reactflow";
import { useHistoryActions } from "./useHistoryActions";

/**
 * PHASE 4.5: Edit Actions - SSOT Implementation
 * PHASE 7: Integrated with History (Undo/Redo)
 * PHASE 9.6.3: Integrated with per-file history system
 * 
 * Provides edit operations that work with the SSOT architecture:
 * - Selection management via React Flow
 * - Duplicate/Delete operations via ProjectStore + WorkspaceStore
 * - Undo/Redo via per-file history system
 * - Automatic snapshot saving after modifications
 */
export const useEditActions = () => {
  const { openClassEditor } = useUiStore();
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  // PHASE 9.6.3: Per-file history actions
  const { undo: historyUndo, redo: historyRedo, canUndo, canRedo, saveSnapshot } = useHistoryActions();

  // ProjectStore actions
  const getNode = useProjectStore((s) => s.getNode);
  const addNode = useProjectStore((s) => s.addNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const removeEdge = useProjectStore((s) => s.removeEdge);
  const getEdgeIdsForNode = useProjectStore((s) => s.getEdgeIdsForNode);

  // WorkspaceStore actions
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  const addNodeToFile = useWorkspaceStore((s) => s.addNodeToFile);
  const removeNodeFromFile = useWorkspaceStore((s) => s.removeNodeFromFile);
  const removeEdgeFromFile = useWorkspaceStore((s) => s.removeEdgeFromFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);

  const selectAll = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    
    setNodes(nodes.map((node) => ({ ...node, selected: true })));
    setEdges(edges.map((edge) => ({ ...edge, selected: true })));
  }, [getNodes, getEdges, setNodes, setEdges]);

  const deselectAll = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    
    setNodes(nodes.map((node) => ({ ...node, selected: false })));
    setEdges(edges.map((edge) => ({ ...edge, selected: false })));
  }, [getNodes, getEdges, setNodes, setEdges]);

  const duplicateSelected = useCallback(() => {
    const file = getActiveFile();
    if (!file) return;

    const nodes = getNodes();
    const selectedNodes = nodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) return;

    selectedNodes.forEach((viewNode) => {
      const originalNode = getNode(viewNode.id);
      if (!originalNode) return;

      // Create new node with copied properties
      const newNode = {
        ...originalNode,
        id: crypto.randomUUID(),
        name: `${(originalNode as any).name}_copy`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any;

      // Add to ProjectStore
      addNode(newNode);

      // Add to file
      addNodeToFile(file.id, newNode.id);

      // Update position map
      const metadata = file.metadata as any;
      const positionMap = metadata?.positionMap || {};
      const originalPosition = viewNode.position;

      const newPositionMap = {
        ...positionMap,
        [newNode.id]: {
          x: originalPosition.x + 50,
          y: originalPosition.y + 50,
        },
      };

      updateFile(file.id, {
        metadata: {
          ...file.metadata,
          positionMap: newPositionMap,
        } as any,
      });
    });

    markFileDirty(file.id);
    
    // PHASE 9.6.3: Save snapshot after modification
    saveSnapshot();
  }, [getNodes, getNode, addNode, addNodeToFile, getActiveFile, updateFile, markFileDirty, saveSnapshot]);

  const deleteSelected = useCallback(() => {
    const file = getActiveFile();
    if (!file) return;

    const nodes = getNodes();
    const edges = getEdges();
    
    const selectedNodes = nodes.filter((node) => node.selected);
    const selectedEdges = edges.filter((edge) => edge.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    // Delete selected nodes (cascade delete will handle connected edges)
    selectedNodes.forEach((viewNode) => {
      const connectedEdgeIds = getEdgeIdsForNode(viewNode.id);

      // Remove from WorkspaceStore
      removeNodeFromFile(file.id, viewNode.id);
      connectedEdgeIds.forEach((edgeId) => {
        removeEdgeFromFile(file.id, edgeId);
      });

      // Remove from ProjectStore (cascade delete)
      removeNode(viewNode.id);
    });

    // Delete selected edges
    selectedEdges.forEach((viewEdge) => {
      removeEdgeFromFile(file.id, viewEdge.id);
      removeEdge(viewEdge.id);
    });

    markFileDirty(file.id);
    
    // PHASE 9.6.3: Save snapshot after modification
    saveSnapshot();
  }, [
    getNodes,
    getEdges,
    getActiveFile,
    getEdgeIdsForNode,
    removeNodeFromFile,
    removeEdgeFromFile,
    removeNode,
    removeEdge,
    markFileDirty,
    saveSnapshot,
  ]);

  const editSelected = useCallback(() => {
    const nodes = getNodes();
    const selectedNodes = nodes.filter((node) => node.selected);

    if (selectedNodes.length === 1) {
      openClassEditor(selectedNodes[0].id);
    }
  }, [getNodes, openClassEditor]);

  const undo = useCallback(() => {
    historyUndo();
  }, [historyUndo]);

  const redo = useCallback(() => {
    historyRedo();
  }, [historyRedo]);

  return {
    selectAll,
    deselectAll,
    duplicateSelected,
    deleteSelected,
    editSelected,
    undo,
    redo,
    canUndo,
    canRedo,
    openClassEditor,
  };
};
