import { useState, useCallback } from "react";
import { useDiagramStore } from "../../../store/diagramStore";

interface ConfirmationOptions {
  requireConfirm?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
}

export const useActionGuard = () => {
  const isDirty = useDiagramStore((s) => s.isDirty);
  
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

  /**
   * LA FUNCIÓN MAESTRA: executeSafeAction
   * Reemplaza a 'executeGuard' y 'executeDiscardGuard'.
   * Maneja tanto cambios sin guardar como confirmaciones simples.
   */
  const executeSafeAction = useCallback((action: () => void, options?: ConfirmationOptions) => {
    // CASO 1: Cambios sin guardar (Prioridad Alta)
    if (isDirty) {
      setModals(prev => ({
        ...prev,
        unsaved: {
          isOpen: true,
          fileName: useDiagramStore.getState().diagramName,
          pendingAction: action
        }
      }));
      return;
    }

    // CASO 2: Acción peligrosa que requiere confirmación (ej: Salir)
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

    // CASO 3: Seguro de ejecutar
    action();
  }, [isDirty]);

  // --- HANDLERS DE MODALES ---

  // Unsaved Modal: Discard -> Ejecuta la acción pendiente
  const handleDiscard = useCallback(() => {
    const action = modals.unsaved.pendingAction;
    closeAll();
    if (action) action();
  }, [modals.unsaved.pendingAction, closeAll]);

  // Unsaved Modal: Save -> El padre inyectará la lógica de guardado
  const handleSaveRequest = useCallback((saveFn: () => Promise<boolean>) => {
    const action = modals.unsaved.pendingAction;
    // Intentar guardar. Si tiene éxito, ejecutar la acción pendiente.
    saveFn().then((success) => {
      if (success) {
        closeAll();
        if (action) action();
      }
    });
  }, [modals.unsaved.pendingAction, closeAll]);

  // Confirmation Modal: Confirm -> Ejecuta la acción
  const handleConfirm = useCallback(() => {
    const action = modals.confirmation.pendingAction;
    closeAll();
    if (action) action();
  }, [modals.confirmation.pendingAction, closeAll]);

  return {
    executeSafeAction, // <--- Ahora sí existe
    modalState: {      // <--- Unificamos todo bajo 'modalState'
      unsaved: {
        isOpen: modals.unsaved.isOpen,
        fileName: modals.unsaved.fileName,
        onDiscard: handleDiscard,
        onSave: handleSaveRequest, // Se sobreescribe en useDiagramActions
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