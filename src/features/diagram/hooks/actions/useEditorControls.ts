import { useCallback } from "react";
import { useReactFlow } from "reactflow";

/**
 * TODO: SSOT Migration - Editor Controls
 * 
 * This hook used useDiagramStore.temporal for undo/redo.
 * SSOT-compatible undo/redo needs to be implemented using a history system
 * that tracks changes to ProjectStore and WorkspaceStore.
 * 
 * For now, returning stub functions to prevent build errors.
 */
export const useEditorControls = () => {
  const { fitView } = useReactFlow();

  const handleFitView = useCallback(() => {
    fitView({ duration: 800 });
  }, [fitView]);

  const undo = useCallback(() => {
    console.warn("TODO: SSOT - Undo not implemented. Need history system for ProjectStore/WorkspaceStore");
  }, []);

  const redo = useCallback(() => {
    console.warn("TODO: SSOT - Redo not implemented. Need history system for ProjectStore/WorkspaceStore");
  }, []);

  return {
    handleFitView,
    undo,
    redo,
  };
};
