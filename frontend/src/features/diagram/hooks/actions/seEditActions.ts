import { useCallback } from "react";
import { useDiagramStore } from "../../../../store/diagramStore";
import { useUiStore } from "../../../../store/uiStore";

export const useEditActions = () => {
  // --- STORES ---
  const storeApi = useDiagramStore.getState;
  const temporalApi = useDiagramStore.temporal.getState;
  const { openClassEditor } = useUiStore();

  // --- ACTIONS ---
  const handleUndo = useCallback(() => {
    temporalApi().undo();
  }, [temporalApi]);


  const handleRedo = useCallback(() => {
    temporalApi().redo();
  }, [temporalApi]);

  const handleDuplicate = useCallback(() => {
    const { nodes, duplicateNode } = storeApi();
    const selectedNodes = nodes.filter((n) => n.selected);
    
    selectedNodes.forEach((node) => {
      duplicateNode(node.id);
    });
  }, [storeApi]);

  const handleDelete = useCallback(() => {
    const { nodes, edges, deleteNode, deleteEdge } = storeApi();
    
    nodes.filter((n) => n.selected).forEach((n) => deleteNode(n.id));

    edges.filter((e) => e.selected).forEach((e) => deleteEdge(e.id));
  }, [storeApi]);

  const handleSelectAll = useCallback(() => {
    const { nodes, onNodesChange } = storeApi();
    
    const changes = nodes.map((node) => ({
      id: node.id,
      type: "select" as const,
      selected: true,
    }));

    onNodesChange(changes);
  }, [storeApi]);

  const handleEditSelected = useCallback(() => {
    const { nodes } = storeApi();
    const selectedNodes = nodes.filter((n) => n.selected);

    if (selectedNodes.length === 1) {
      openClassEditor(selectedNodes[0].id);
    }
  }, [storeApi, openClassEditor]);

  return {
    handleUndo,
    handleRedo,
    handleDuplicate,
    handleDelete,
    handleSelectAll,
    handleEditSelected
  };
};