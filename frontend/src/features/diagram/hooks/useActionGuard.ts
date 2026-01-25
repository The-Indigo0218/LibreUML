import { useState, useCallback } from "react";
import { useDiagramStore } from "../../../store/diagramStore";
import { useTranslation } from "react-i18next";

export const useActionGuard = () => {
  const { t } = useTranslation();
  const isDirty = useDiagramStore((s) => s.isDirty);
  const currentFilePath = useDiagramStore((s) => s.currentFilePath);

  // --- MODAL STATES ---

  const [unsavedModal, setUnsavedModal] = useState({
    isOpen: false,
    fileName: "Untitled",
    pendingAction: null as (() => void) | null,
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null as (() => void) | null,
  });

  // --- DECISION LOGIC ---

  const executeGuard = useCallback(
    (
      action: () => void,
      options?: {
        requireConfirm?: boolean;
        confirmTitle?: string;
        confirmMessage?: string;
      },
    ) => {
      if (isDirty) {
        setUnsavedModal({
          isOpen: true,
          fileName: currentFilePath || "Untitled",
          pendingAction: action,
        });
        return;
      }

      if (options?.requireConfirm) {
        setConfirmModal({
          isOpen: true,
          title: options.confirmTitle || t("modals.confirmation.defaultTitle"),
          message:
            options.confirmMessage || t("modals.confirmation.defaultMessage"),
          onConfirm: action,
        });
        return;
      }

      action();
    },
    [isDirty, currentFilePath, t],
  );

  const executeDiscardGuard = useCallback(
    (action: () => void) => {
      if (!isDirty) return;

      setConfirmModal({
        isOpen: true,
        title: t("menubar.file.discard"),
        message: t("modals.confirmation.discardMessage"),
        onConfirm: action,
      });
    },
    [isDirty, t],
  );

  // --- Handles ---

  const closeModals = useCallback(() => {
    setUnsavedModal((s) => ({ ...s, isOpen: false }));
    setConfirmModal((s) => ({ ...s, isOpen: false }));
  }, []);

  const handleUnsavedDiscard = useCallback(() => {
    if (unsavedModal.pendingAction) unsavedModal.pendingAction();
    closeModals();
  }, [unsavedModal, closeModals]);

  // Wrapper for saving: the parent component must pass the real save function
  const handleUnsavedSave = useCallback(
    async (saveFn: () => Promise<boolean>) => {
      const success = await saveFn();
      if (success) {
        if (unsavedModal.pendingAction) unsavedModal.pendingAction();
        closeModals();
      }
    },
    [unsavedModal, closeModals],
  );

  const handleConfirmYes = useCallback(() => {
    if (confirmModal.onConfirm) confirmModal.onConfirm();
    closeModals();
  }, [confirmModal, closeModals]);

  return {
    executeGuard,
    executeDiscardGuard,
    modals: {
      unsaved: {
        isOpen: unsavedModal.isOpen,
        fileName: unsavedModal.fileName,
        onDiscard: handleUnsavedDiscard,
        onSave: handleUnsavedSave,
        onCancel: closeModals,
      },
      confirmation: {
        isOpen: confirmModal.isOpen,
        title: confirmModal.title,
        message: confirmModal.message,
        onConfirm: handleConfirmYes,
        onCancel: closeModals,
      },
    },
  };
};
