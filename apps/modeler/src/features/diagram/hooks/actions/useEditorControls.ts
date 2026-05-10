import { useCallback } from "react";
import { useViewportControlStore } from "../../../../canvas/store/viewportControlStore";

export const useEditorControls = () => {
  const fitView = useViewportControlStore((s) => s.fitView);

  const handleFitView = useCallback(() => {
    fitView();
  }, [fitView]);

  const undo = useCallback(() => {
    console.warn("TODO: SSOT - Undo not implemented. Requires history middleware (e.g., zundo)");
  }, []);

  const redo = useCallback(() => {
    console.warn("TODO: SSOT - Redo not implemented. Requires history middleware (e.g., zundo)");
  }, []);

  return {
    handleFitView,
    undo,
    redo,
  };
};
