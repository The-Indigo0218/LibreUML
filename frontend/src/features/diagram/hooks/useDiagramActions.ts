import { useCallback, useEffect, useState } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../store/diagramStore";
import { StorageService } from "../../../services/storage.service";


export const useDiagramActions = () => {
  const { toObject, fitView } = useReactFlow();
  
  // Local state for modals
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"closeFile" | "exit" | null>(null);


  const storeApi = useDiagramStore.getState;
  const temporalApi = useDiagramStore.temporal.getState;

  useEffect(() => {
    if (!window.electronAPI?.isElectron()) return;

    const unsubscribe = window.electronAPI.onAppRequestClose(() => {
      const { isDirty } = storeApi();
      
      if (isDirty) {
        setPendingAction("exit");
        setShowUnsavedModal(true);
      } else {
        window.electronAPI?.sendForceClose();
      }
    });

    return () => unsubscribe();
  }, []);

  // ---  ACTION: CLOSE FILE / NEW ---
  const handleCloseFile = useCallback(() => {
    const { isDirty, resetDiagram } = storeApi(); 
    
    if (isDirty) {
      setPendingAction("closeFile");
      setShowUnsavedModal(true);
    } else {
      resetDiagram();
    }
  }, []);

  // --- 2. ACTION: EXIT ---
  const handleExit = useCallback(() => {
    if (window.electronAPI?.isElectron()) {
       const { isDirty } = storeApi();
       
       if (isDirty) {
         setPendingAction("exit");
         setShowUnsavedModal(true);
       } else {
         window.electronAPI.close();
       }
    }
  }, []);

  // --- ACTION: SAVE ---
  const handleSave = useCallback(async () => {
    const { diagramId, diagramName, currentFilePath, setFilePath, setDirty } = storeApi();
    const flowObject = toObject();
    
    document.body.style.cursor = "wait";
    
    const result = await StorageService.saveDiagram(
      flowObject,
      diagramId,
      diagramName,
      currentFilePath
    );
    
    document.body.style.cursor = "default";

    if (result.success && result.filePath) {
      setFilePath(result.filePath);
      setDirty(false);
      return true;
    }
    return false;
  }, [toObject]); 

  // ---  MODAL'S HANDLER ---
  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedModal(false);
    localStorage.removeItem('libreuml-backup');
    
    const { resetDiagram } = storeApi();

    if (pendingAction === "closeFile") {
      resetDiagram();
    } else if (pendingAction === "exit") {
       window.electronAPI?.sendForceClose();
    }
    setPendingAction(null);
  }, [pendingAction]);

  const handleSaveAndAction = useCallback(async () => {
    const saved = await handleSave();
    if (saved) {
      localStorage.removeItem('libreuml-backup');
      setShowUnsavedModal(false);
      
      const { resetDiagram } = storeApi();

      if (pendingAction === "closeFile") {
        resetDiagram();
      } else if (pendingAction === "exit") {
        window.electronAPI?.sendForceClose();
      }
      setPendingAction(null);
    }
  }, [handleSave, pendingAction]);

  // ---  VIEW ---
  const handleFitView = useCallback(() => {
    fitView({ duration: 800 });
  }, [fitView]);

  return {
    handleNew: handleCloseFile,
    handleCloseFile,
    handleSave,
    handleExit,
    handleFitView,
    undo: () => temporalApi().undo(),
    redo: () => temporalApi().redo(),
    
    modalState: {
      isOpen: showUnsavedModal,
      close: () => setShowUnsavedModal(false),
      onDiscard: handleDiscardChanges,
      onSave: handleSaveAndAction,
      fileName: storeApi().diagramName 
    }
  };
};