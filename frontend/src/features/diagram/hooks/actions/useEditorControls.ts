import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../../store/diagramStore";

export const useEditorControls = () => {
  const { fitView } = useReactFlow();
  const temporalApi = useDiagramStore.temporal.getState;

  // --- VIEW ACTIONS ---
  
  const handleFitView = useCallback(() => {
    fitView({ duration: 800 });
  }, [fitView]);

  // --- HISTORY ACTIONS ---

  const undo = useCallback(() => {
    temporalApi().undo();
  }, [temporalApi]);

  const redo = useCallback(() => {
    temporalApi().redo();
  }, [temporalApi]);

  return {
    handleFitView,
    undo,
    redo,
  };
};