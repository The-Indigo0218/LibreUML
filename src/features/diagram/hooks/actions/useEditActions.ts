import { useCallback } from "react";
import { useUiStore } from "../../../../store/uiStore";

/**
 * TODO: SSOT Migration - Edit Actions
 * 
 * This hook used useDiagramStore for node selection and temporal undo/redo.
 * Needs migration to use WorkspaceStore for selection state and implement
 * SSOT-compatible history.
 * 
 * For now, returning stub functions to prevent build errors.
 */
export const useEditActions = () => {
  const { openClassEditor } = useUiStore();

  const selectAll = useCallback(() => {
    console.warn("TODO: SSOT - selectAll not implemented");
  }, []);

  const deselectAll = useCallback(() => {
    console.warn("TODO: SSOT - deselectAll not implemented");
  }, []);

  const undo = useCallback(() => {
    console.warn("TODO: SSOT - Undo not implemented");
  }, []);

  const redo = useCallback(() => {
    console.warn("TODO: SSOT - Redo not implemented");
  }, []);

  return {
    selectAll,
    deselectAll,
    undo,
    redo,
    openClassEditor,
  };
};
