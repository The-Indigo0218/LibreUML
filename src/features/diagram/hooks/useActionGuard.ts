import { useState, useCallback } from "react";
import { useWorkspaceStore } from "../../../store/workspace.store";

interface ConfirmationOptions {
  requireConfirm?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
}

export const useActionGuard = () => {
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  
  const activeFile = activeFileId ? getFile(activeFileId) : undefined;
  const isDirty = activeFile?.isDirty ?? false;
  
  // Estado Unificado de Modales
  const [modals, setModals] = useState({
    unsaved: {
      isOpen: false,
      fileName: "",
      pendingAction: null as (() => void) | null,
    },
    confirmation: {
      isOpen: false,
      title: "",
      message: "",
      pendingAction: null as (() => void) | null,
    }
  });

  // --- ACTIONS ---

  const closeAll = useCallback(() => {
    setModals(prev => ({
      unsaved: { ...prev.unsaved, isOpen: false, pendingAction: null },
      confirmation: { ...prev.confirmation, isOpen: false, pendingAction: null }
    }));
  }, []);


  const executeSafeAction = useCallback((action: () => void, options?: ConfirmationOptions) => {
    if (isDirty) {
      const currentFile = activeFileId ? useWorkspaceStore.getState().getFile(activeFileId) : undefined;
      setModals(prev => ({
        ...prev,
        unsaved: {
          isOpen: true,
          fileName: currentFile?.name || "Untitled",
          pendingAction: action
        }
      }));
      return;
    }

    if (options?.requireConfirm) {
      setModals(prev => ({
        ...prev,
        confirmation: {
          isOpen: true,
          title: options.confirmTitle || "Confirm Action",
          message: options.confirmMessage || "Are you sure?",
          pendingAction: action
        }
      }));
      return;
    }

    action();
  }, [isDirty, activeFileId]);


  const handleDiscard = useCallback(() => {
    const action = modals.unsaved.pendingAction;
    closeAll();
    if (action) action();
  }, [modals.unsaved.pendingAction, closeAll]);

  const handleSaveRequest = useCallback((saveFn: () => Promise<boolean>) => {
    const action = modals.unsaved.pendingAction;
    saveFn().then((success) => {
      if (success) {
        closeAll();
        if (action) action();
      }
    });
  }, [modals.unsaved.pendingAction, closeAll]);

  const handleConfirm = useCallback(() => {
    const action = modals.confirmation.pendingAction;
    closeAll();
    if (action) action();
  }, [modals.confirmation.pendingAction, closeAll]);

  return {
    executeSafeAction,
    modalState: {      
      unsaved: {
        isOpen: modals.unsaved.isOpen,
        fileName: modals.unsaved.fileName,
        onDiscard: handleDiscard,
        onSave: handleSaveRequest, 
        onCancel: closeAll
      },
      confirmation: {
        isOpen: modals.confirmation.isOpen,
        title: modals.confirmation.title,
        message: modals.confirmation.message,
        onConfirm: handleConfirm,
        onCancel: closeAll
      }
    }
  };
};