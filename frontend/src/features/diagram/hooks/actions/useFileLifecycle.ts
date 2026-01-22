import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../../store/diagramStore";
import { StorageService } from "../../../../services/storage.service";

export const useFileLifecycle = () => {
  const { toObject, fitView, setViewport } = useReactFlow();
  const storeApi = useDiagramStore.getState;

  // --- HELPERS ---
  
  const fitViewAfterLoad = useCallback(() => {
    setTimeout(() => fitView({ duration: 800 }), 100);
  }, [fitView]);

  // --- ACTIONS ---

  // CREATE NEW / RESET
  const createNewDiagram = useCallback(() => {
    const { resetDiagram } = storeApi();
    resetDiagram();
  }, [storeApi]);

  // OPEN FROM DISK
  const openDiagramFromDisk = useCallback(async () => {
    if (!window.electronAPI?.isElectron()) return;

    const result = await StorageService.openDiagram();
    if (result) {
      const { loadDiagram, setFilePath, setDiagramName } = storeApi();
      loadDiagram(result.data);
      
      if (result.filePath) {
        setFilePath(result.filePath);
        const fileName = result.filePath.split(/[\\/]/).pop()?.replace(".luml", "");
        if (fileName) setDiagramName(fileName);
      }
      fitViewAfterLoad();
    }
  }, [storeApi, fitViewAfterLoad]);

  // IMPORT FROM WEB (JSON)
  const importFromWeb = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        const { loadDiagram } = storeApi();

        loadDiagram(parsedData);

        if (parsedData.viewport) {
          const { x, y, zoom } = parsedData.viewport;
          setViewport({ x, y, zoom });
        } else {
          fitViewAfterLoad();
        }
      } catch (error) {
        console.error("Error loading file:", error);
        alert("Error loading file. Please ensure it is a valid .json or .luml.");
      }
    };
    reader.readAsText(file);
    event.target.value = ""; 
  }, [storeApi, setViewport, fitViewAfterLoad]);

  // SAVE (Current Path)
  const saveDiagram = useCallback(async () => {
    const { diagramId, diagramName, currentFilePath, setFilePath, setDirty } = storeApi();
    
    if (!currentFilePath) return false;

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
  }, [storeApi, toObject]);

  // SAVE AS (New Path)
  const saveDiagramAs = useCallback(async () => {
    const { diagramId, diagramName } = storeApi();
    const flowObject = toObject();

    document.body.style.cursor = "wait";

    const result = await StorageService.saveDiagram(
      flowObject,
      diagramId,
      diagramName,
      undefined 
    );

    document.body.style.cursor = "default";

    if (result.success && result.filePath) {
      const { setFilePath, setDirty, setDiagramName } = storeApi();
      setFilePath(result.filePath);

      const fileName = result.filePath.split(/[\\/]/).pop()?.replace(".luml", "");
      if (fileName) setDiagramName(fileName);

      setDirty(false);
      return true;
    }
    return false;
  }, [storeApi, toObject]);

  // REVERT (Reload from Disk)
  const revertDiagram = useCallback(async () => {
    const { currentFilePath, loadDiagram, setDirty } = storeApi();

    if (currentFilePath && window.electronAPI?.isElectron()) {
      const data = await StorageService.reloadDiagram(currentFilePath);
      if (data) {
        loadDiagram(data, true);
        setDirty(false);
        fitViewAfterLoad();
      }
    }
  }, [storeApi, fitViewAfterLoad]);

  return {
    createNewDiagram,
    openDiagramFromDisk,
    importFromWeb,
    saveDiagram,
    saveDiagramAs,
    revertDiagram,
  };
};