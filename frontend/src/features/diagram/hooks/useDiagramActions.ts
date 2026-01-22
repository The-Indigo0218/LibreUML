import { useCallback } from "react";
import { useDiagramStore } from "../../../store/diagramStore";

// Import Specialists
import { useActionGuard } from "./useActionGuard";
import { useFileLifecycle } from "./actions/useFileLifecycle";
import { useEditorControls } from "./actions/useEditorControls";
import { useAppLifecycle } from "./actions/useAppLifecycle";

export const useDiagramActions = () => {
  // REACTIVE STATE (For UI)
  const isDirty = useDiagramStore((s) => s.isDirty);
  const currentFilePath = useDiagramStore((s) => s.currentFilePath);
  const hasFilePath = !!currentFilePath;

  // INITIALIZE SPECIALISTS
  const { executeSafeAction, modalState } = useActionGuard();
  
  // Specialists
  const fileLifecycle = useFileLifecycle();
  const editorControls = useEditorControls();
  
  // App Lifecycle needs the guard to handle safe exit
  const appLifecycle = useAppLifecycle({ executeSafeAction });

  //  ORCHESTRATED ACTIONS
  const handleOpen = useCallback(async () => {
    if (window.electronAPI?.isElectron()) {
      executeSafeAction(fileLifecycle.openDiagramFromDisk);
      return null;
    } else {
      const isClean = !useDiagramStore.getState().isDirty;
      if (isClean) {
        return "TRIGGER_WEB_INPUT";
      } else {

        executeSafeAction(fileLifecycle.createNewDiagram); 
        return null;
      }
    }
  }, [executeSafeAction, fileLifecycle]);


  const handleNew = useCallback(() => {
    executeSafeAction(fileLifecycle.createNewDiagram);
  }, [executeSafeAction, fileLifecycle]);

  const handleDiscardChangesAction = useCallback(() => {
    const hasPath = !!useDiagramStore.getState().currentFilePath;
    
    const discardStrategy = hasPath 
      ? fileLifecycle.revertDiagram 
      : fileLifecycle.createNewDiagram;

    executeSafeAction(discardStrategy);
  }, [executeSafeAction, fileLifecycle]);

  /**
   * SAVE FLOW:
   * Direct execution (no guard needed to save)
   */
  const handleSave = useCallback(async () => {
    return await fileLifecycle.saveDiagram();
  }, [fileLifecycle]);

  //  PUBLIC API
  return {
    // File Actions
    handleNew,
    handleOpen,
    handleWebImport: fileLifecycle.importFromWeb,
    handleSave,
    handleSaveAs: fileLifecycle.saveDiagramAs,
    handleCloseFile: handleNew, // Alias
    handleDiscardChangesAction,
    
    // App Actions
    handleExit: appLifecycle.handleExit,
    
    // Editor Actions
    handleFitView: editorControls.handleFitView,
    undo: editorControls.undo,
    redo: editorControls.redo,
    
    // State
    hasFilePath,
    isDirty,

    // Modal (Managed by the Guard)
    modalState
  };
};