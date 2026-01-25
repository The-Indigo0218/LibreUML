import { useCallback } from "react";
import { useDiagramStore } from "../../../store/diagramStore";
import { useTranslation } from "react-i18next";

// Specialists
import { useActionGuard } from "./useActionGuard";
import { useFileLifecycle } from "./actions/useFileLifecycle";
import { useEditorControls } from "./actions/useEditorControls";
import { useAppLifecycle } from "./actions/useAppLifecycle";

export const useDiagramActions = () => {
  const { t } = useTranslation();
  
  // Reactive State
  const isDirty = useDiagramStore((s) => s.isDirty);
  const currentFilePath = useDiagramStore((s) => s.currentFilePath);
  const hasFilePath = !!currentFilePath;

  //  Initialize Guard
  const { executeGuard, executeDiscardGuard, modals } = useActionGuard();
  
  //  Initialize Logic Hooks
  const fileLifecycle = useFileLifecycle();
  const editorControls = useEditorControls();
  const appLifecycle = useAppLifecycle(); // ✅ YA NO DA ERROR

  // --- ORCHESTRATION ---

  const handleNew = useCallback(() => {
    executeGuard(fileLifecycle.createNewDiagram);
  }, [executeGuard, fileLifecycle]);

  const handleOpen = useCallback(async () => {
    const openAction = window.electronAPI?.isElectron() 
      ? fileLifecycle.openDiagramFromDisk 
      : () => console.log("Web Import trigger"); 

    executeGuard(openAction as () => void);
    return null; 
  }, [executeGuard, fileLifecycle]);

  const handleExit = useCallback(() => {
 
    executeGuard(appLifecycle.handleExit, {
      requireConfirm: true,
      confirmTitle: t("menubar.file.exit"),
      confirmMessage: t("modals.confirmation.exitMessage") || "Are you sure you want to exit?", 
    });
  }, [executeGuard, appLifecycle, t]);

  const handleDiscardChangesAction = useCallback(() => {
    const action = hasFilePath ? fileLifecycle.revertDiagram : fileLifecycle.createNewDiagram;
    executeDiscardGuard(action);
  }, [executeDiscardGuard, hasFilePath, fileLifecycle]);

  const handleSave = fileLifecycle.saveDiagram;
  const handleSaveAs = fileLifecycle.saveDiagramAs;

  const handleModalSave = useCallback(() => {
    modals.unsaved.onSave(handleSave);
  }, [modals.unsaved, handleSave]);

  return {
    // File Actions
    handleNew,
    handleOpen,
    handleWebImport: fileLifecycle.importFromWeb,
    handleSave,
    handleSaveAs,
    handleCloseFile: handleNew,
    handleDiscardChangesAction,
    
    // App Actions
    handleExit,
    
    // Editor Actions
    handleFitView: editorControls.handleFitView,
    undo: editorControls.undo,
    redo: editorControls.redo,
    
    // State
    isDirty,
    hasFilePath,

    // Modals for UI
    modals: {
      ...modals,
      unsaved: {
        ...modals.unsaved,
        onSave: handleModalSave 
      }
    }
  };
};