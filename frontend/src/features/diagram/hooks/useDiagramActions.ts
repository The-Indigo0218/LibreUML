import { useCallback, useEffect, useState } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../store/diagramStore";
import { StorageService } from "../../../services/storage.service";

export const useDiagramActions = () => {
  // HOOKS & LOCAL STATE

  const { toObject, fitView, setViewport } = useReactFlow();

  // State to control modals and pending actions
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "closeFile" | "exit" | "open" | "revert" | null
  >(null);

  // Store Access (Lazy)
  const storeApi = useDiagramStore.getState;
  const temporalApi = useDiagramStore.temporal.getState;

  // Reactive State (for UI)
  const currentFilePath = useDiagramStore((s) => s.currentFilePath);
  const hasFilePath = !!currentFilePath;
  const isDirty = useDiagramStore((s) => s.isDirty);

  //  LIFECYCLE LISTENERS

  // Listen for window close attempt (X button or Alt+F4)
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
  }, [storeApi]);

  //FILE OPERATIONS

  // --- OPEN IN WEB ---
  const handleWebImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsedData = JSON.parse(content);
          const { loadDiagram } = storeApi();

          loadDiagram(parsedData);

          // Restaurar viewport si existe
          if (parsedData.viewport) {
            const { x, y, zoom } = parsedData.viewport;
            setViewport({ x, y, zoom });
          } else {
            setTimeout(() => fitView({ duration: 800 }), 100);
          }
        } catch (error) {
          console.error("Error loading file:", error);
          alert("Error al leer el archivo. Asegúrate de que sea válido.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [storeApi, fitView, setViewport],
  );

  // --- HANDLER OPEN  ---
  const handleOpen = useCallback(async () => {
    const { isDirty } = storeApi();

    if (isDirty) {
      setPendingAction("open");
      setShowUnsavedModal(true);
      return;
    }

    if (window.electronAPI?.isElectron()) {
      const result = await StorageService.openDiagram();
      if (result) {
        const { loadDiagram, setFilePath, setDiagramName } = storeApi();
        loadDiagram(result.data);

        if (result.filePath) {
          setFilePath(result.filePath);
          const fileName = result.filePath
            .split(/[\\/]/)
            .pop()
            ?.replace(".luml", "");
          if (fileName) setDiagramName(fileName);
        }
        setTimeout(() => fitView({ duration: 800 }), 100);
      }
    } else {
      return "TRIGGER_WEB_INPUT";
    }
  }, [fitView, storeApi]);

  // --- SAVE ---
  const handleSave = useCallback(async () => {
    const { diagramId, diagramName, currentFilePath, setFilePath, setDirty } =
      storeApi();
    const flowObject = toObject();

    document.body.style.cursor = "wait";

    // Save to current path
    const result = await StorageService.saveDiagram(
      flowObject,
      diagramId,
      diagramName,
      currentFilePath,
    );

    document.body.style.cursor = "default";

    if (result.success && result.filePath) {
      setFilePath(result.filePath);
      setDirty(false);
      return true;
    }
    return false;
  }, [storeApi, toObject]);

  // --- SAVE AS ---
  const handleSaveAs = useCallback(async () => {
    const { diagramId, diagramName } = storeApi();
    const flowObject = toObject();

    document.body.style.cursor = "wait";

    const result = await StorageService.saveDiagram(
      flowObject,
      diagramId,
      diagramName,
      undefined,
    );

    document.body.style.cursor = "default";

    if (result.success && result.filePath) {
      const { setFilePath, setDirty, setDiagramName } = storeApi();
      setFilePath(result.filePath);

      const fileName = result.filePath
        .split(/[\\/]/)
        .pop()
        ?.replace(".luml", "");
      if (fileName) setDiagramName(fileName);

      setDirty(false);
      return true;
    }
    return false;
  }, [storeApi, toObject]);

  // --- CLOSE FILE / NEW ---
  const handleCloseFile = useCallback(() => {
    const { isDirty, resetDiagram } = storeApi();

    if (isDirty) {
      setPendingAction("closeFile");
      setShowUnsavedModal(true);
    } else {
      resetDiagram();
    }
  }, [storeApi]);

  // --- DISCARD CHANGES (REVERT) ---
  const handleReloadLogic = useCallback(async () => {
    const { currentFilePath, loadDiagram, setDirty } = storeApi();

    if (currentFilePath && window.electronAPI?.isElectron()) {
      const data = await StorageService.reloadDiagram(currentFilePath);
      if (data) {
        loadDiagram(data, true);

        setDirty(false);
        setTimeout(() => fitView({ duration: 800 }), 100);
      }
    }
  }, [storeApi, fitView]);

  const handleDiscardChangesTrigger = useCallback(() => {
    const { isDirty: dirtyNow, currentFilePath: pathNow } = storeApi();

    if (!pathNow) {
      handleCloseFile();
      return;
    }

    if (dirtyNow) {
      setPendingAction("revert");
      setShowUnsavedModal(true);
    } else {
      handleReloadLogic();
    }
  }, [storeApi, handleReloadLogic, handleCloseFile]);

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedModal(false);
    localStorage.removeItem("libreuml-backup");

    const { resetDiagram } = storeApi();

    if (pendingAction === "closeFile") {
      resetDiagram();
    } else if (pendingAction === "exit") {
      window.electronAPI?.sendForceClose();
    } else if (pendingAction === "open") {
      resetDiagram();
      handleOpen();
    }
    // --- CASO REVERT ---
    else if (pendingAction === "revert") {
      handleReloadLogic();
    }

    setPendingAction(null);
  }, [pendingAction, storeApi, handleOpen, handleReloadLogic]);

  // --- EXIT APP ---
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
  }, [storeApi]);

  //MODAL HANDLERS (CONFIRMATION)

  const handleSaveAndAction = useCallback(async () => {
    const saved = await handleSave();

    if (saved) {
      localStorage.removeItem("libreuml-backup");
      setShowUnsavedModal(false);

      const { resetDiagram } = storeApi();

      if (pendingAction === "closeFile") {
        resetDiagram();
      } else if (pendingAction === "exit") {
        window.electronAPI?.sendForceClose();
      } else if (pendingAction === "open") {
        handleOpen();
      }
      setPendingAction(null);
    }
  }, [handleSave, pendingAction, storeApi, handleOpen]);

  //  VIEW & UTILS

  const handleFitView = useCallback(() => {
    fitView({ duration: 800 });
  }, [fitView]);

  //  PUBLIC API

  return {
    // Actions
    handleWebImport,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleNew: handleCloseFile,
    handleCloseFile,
    handleExit,
    handleFitView,
    handleDiscardChangesAction: handleDiscardChangesTrigger,

    // Edit Actions
    undo: () => temporalApi().undo(),
    redo: () => temporalApi().redo(),

    // State Flags
    hasFilePath,
    isDirty,

    // Modal State Control
    modalState: {
      isOpen: showUnsavedModal,
      close: () => setShowUnsavedModal(false),
      onDiscard: handleDiscardChanges,
      onSave: handleSaveAndAction,
      fileName: storeApi().diagramName,
    },
  };
};
