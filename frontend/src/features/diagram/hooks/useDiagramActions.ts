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

  /**
   * HANDLE OPEN
   */
  const handleOpen = useCallback((webTrigger?: () => void) => {
    if (window.electronAPI?.isElectron()) {
      // Desktop: Usar diálogo nativo
      executeSafeAction(fileLifecycle.openDiagramFromDisk);
    } else {
      // Web: Usar el disparador del input HTML si existe
      if (webTrigger) {
        executeSafeAction(webTrigger);
      }
    }
  }, [executeSafeAction, fileLifecycle]);

  const handleExit = useCallback(() => {
    executeSafeAction(appLifecycle.handleExit, {
      requireConfirm: true,
      confirmTitle: t("menubar.file.exit"),
      confirmMessage: t("modals.confirmation.exitMessage") || "Are you sure you want to exit?", 
    });
  }, [executeSafeAction, appLifecycle, t]);

  const handleDiscardChangesAction = useCallback(() => {
    const action = hasFilePath ? fileLifecycle.revertDiagram : fileLifecycle.createNewDiagram;
    executeSafeAction(action);
  }, [executeSafeAction, hasFilePath, fileLifecycle]);

  const handleSave = fileLifecycle.saveDiagram;
  const handleSaveAs = fileLifecycle.saveDiagramAs;

  // --- CORRECCIÓN 1: Acceso correcto a 'unsaved' ---
  // Inyectamos la función real de guardado (handleSave) en la lógica del guard
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

    // --- CORRECCIÓN 2: Sobresritura anidada correcta ---
    modalState: {
      ...modalState,
      unsaved: {
        ...modalState.unsaved, // Mantenemos las otras props (isOpen, fileName, etc)
        onSave: handleModalSave // Sobrescribimos onSave con la versión sin argumentos
      }
    }
  };
};