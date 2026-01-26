import { useCallback, useEffect } from "react"; 
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

  // Initialize Guard
  const { executeSafeAction, modalState } = useActionGuard();
  
  // Specialists
  const fileLifecycle = useFileLifecycle();
  const editorControls = useEditorControls();
  const appLifecycle = useAppLifecycle();

  // --- ORCHESTRATION ---

  const handleNew = useCallback(() => {
    executeSafeAction(fileLifecycle.createNewDiagram);
  }, [executeSafeAction, fileLifecycle]);

  const handleOpen = useCallback((webTrigger?: () => void) => {
    if (window.electronAPI?.isElectron()) {
      executeSafeAction(fileLifecycle.openDiagramFromDisk);
    } else {
      if (webTrigger) {
        executeSafeAction(webTrigger);
      }
    }
  }, [executeSafeAction, fileLifecycle]);

  // --- SAFE EXIT LOGIC ---
  const handleExit = useCallback(() => {
    executeSafeAction(appLifecycle.quitApplication, { 
      requireConfirm: true,
      confirmTitle: t("menubar.file.exit"),
      confirmMessage: t("modals.confirmation.exitMessage") || "Are you sure you want to exit?", 
    });
  }, [executeSafeAction, appLifecycle, t]);

  // --- OS SYSTEM EVENT LISTENER (FIX LINUX/WINDOWS/MAC) ---
  useEffect(() => {
    if (!window.electronAPI?.isElectron()) return;

    const unsubscribe = window.electronAPI.onAppRequestClose(() => {
      handleExit(); 
    });

    return unsubscribe;
  }, [handleExit]);


  const handleDiscardChangesAction = useCallback(() => {
    const action = hasFilePath ? fileLifecycle.revertDiagram : fileLifecycle.createNewDiagram;
    executeSafeAction(action);
  }, [executeSafeAction, hasFilePath, fileLifecycle]);

  const handleSave = fileLifecycle.saveDiagram;
  const handleSaveAs = fileLifecycle.saveDiagramAs;

  const handleModalSave = useCallback(() => {
    if (modalState.unsaved.onSave) {
      modalState.unsaved.onSave(handleSave);
    }
  }, [modalState.unsaved, handleSave]);

  return {
    handleNew,
    handleOpen,
    handleWebImport: fileLifecycle.importFromWeb,
    handleSave,
    handleSaveAs,
    handleCloseFile: handleNew,
    handleDiscardChangesAction,
    
    handleExit,
    
    handleFitView: editorControls.handleFitView,
    undo: editorControls.undo,
    redo: editorControls.redo,
    
    isDirty,
    hasFilePath,

    modalState: {
      ...modalState,
      unsaved: {
        ...modalState.unsaved,
        onSave: handleModalSave
      }
    }
  };
};