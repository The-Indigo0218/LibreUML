import { useState, useCallback } from "react";
import { useDiagramStore } from "../../../store/diagramStore";

type PendingAction = () => void | Promise<void>;

export const useActionGuard = () => {
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  /**
   * Executes an action safely.
   * Checks current dirty state directly from store.
   */
  const executeSafeAction = useCallback((action: PendingAction) => {
    const currentIsDirty = useDiagramStore.getState().isDirty;

    if (!currentIsDirty) {
      action();
    } else {
      setPendingAction(() => action);
      setShowModal(true);
    }
  }, []);

  const confirmDiscard = useCallback(() => {
    setShowModal(false);
    localStorage.removeItem("libreuml-backup");
    
    if (pendingAction) {
      pendingAction();
    }
    setPendingAction(null);
  }, [pendingAction]);

  const confirmSave = useCallback(async (saveFn: () => Promise<boolean>) => {
    const success = await saveFn();
    if (success) {
      setShowModal(false);
      localStorage.removeItem("libreuml-backup");
      
      if (pendingAction) {
        pendingAction();
      }
      setPendingAction(null);
    }
  }, [pendingAction]);

  const cancelAction = useCallback(() => {
    setShowModal(false);
    setPendingAction(null);
  }, []);

  return {
    executeSafeAction,
    modalState: {
      isOpen: showModal,
      close: cancelAction,
      onDiscard: confirmDiscard,
      onSave: confirmSave,
    }
  };
};