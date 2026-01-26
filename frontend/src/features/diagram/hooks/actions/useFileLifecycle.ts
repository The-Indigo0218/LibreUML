import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../../store/diagramStore";
import type { 
  DiagramState, 
  UmlClassNode, 
  UmlEdge, 
  UmlClassData 
} from "../../../diagram/types/diagram.types";

export const useFileLifecycle = () => {
  const { toObject, fitView } = useReactFlow();
  const storeApi = useDiagramStore.getState;
  const loadDiagram = useDiagramStore((s) => s.loadDiagram);
  const resetDiagram = useDiagramStore((s) => s.resetDiagram);
  const setFilePath = useDiagramStore((s) => s.setFilePath);

  // --- HELPERS ---
  const fitViewAfterLoad = useCallback(() => {
    setTimeout(() => fitView({ duration: 800 }), 100);
  }, [fitView]);

  // --- INTERNAL LOADER ---
  const loadFromFileContent = useCallback((content: string, filePath?: string) => {
    try {
      const data = JSON.parse(content) as DiagramState;

      if (!data.nodes || !Array.isArray(data.nodes)) {
        throw new Error("Formato inválido: falta array de nodos");
      }

      const safeData: DiagramState = {
        ...data,
        viewport: data.viewport || { x: 0, y: 0, zoom: 1 }
      };

      loadDiagram(safeData);
      
      if (filePath) {
        setFilePath(filePath);
      }
      
      fitViewAfterLoad();

    } catch (error) {
      console.error("Error parsing diagram file:", error);
      alert("Error al abrir el archivo. El formato es inválido o está corrupto.");
    }
  }, [loadDiagram, setFilePath, fitViewAfterLoad]);


  // --- ACTIONS ---

  const createNewDiagram = useCallback(() => {
    resetDiagram();
  }, [resetDiagram]);

  const openDiagramFromDisk = useCallback(async () => {
    if (!window.electronAPI?.isElectron()) return;

    try {
      const result = await window.electronAPI.openFile();
      
      if (!result.canceled && result.content) {
        loadFromFileContent(result.content, result.filePath);
      }
    } catch (error) {
      console.error("IPC Error opening file:", error);
    }
  }, [loadFromFileContent]);

  const importFromWeb = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      loadFromFileContent(content);
    };
    reader.readAsText(file);
    event.target.value = "";
  }, [loadFromFileContent]);

  const saveDiagram = useCallback(async () => {
    const state = storeApi();
    const flowObject = toObject(); 
    

    const cleanNodes: UmlClassNode[] = flowObject.nodes.map((node) => ({
      id: node.id,
      type: 'umlClass' as const, 
      position: node.position,
      data: node.data as UmlClassData,
      selected: node.selected,
      width: node.width,
      height: node.height
    }));

    const cleanEdges: UmlEdge[] = flowObject.edges.map(edge => ({
      ...edge,
      data: edge.data as unknown 
    })) as unknown as UmlEdge[];

    const dataToSave: DiagramState = {
      id: state.diagramId,
      name: state.diagramName,
      nodes: cleanNodes,
      edges: cleanEdges,
 
      viewport: flowObject.viewport
    };
    
    const content = JSON.stringify(dataToSave, null, 2);
    document.body.style.cursor = "wait";

    try {
      if (window.electronAPI?.isElectron()) {
        const result = await window.electronAPI.saveFile(
          content, 
          state.currentFilePath, 
          state.diagramName
        );

        if (!result.canceled && result.filePath) {
          setFilePath(result.filePath);
          storeApi().setDirty(false);
          return true;
        }
        return false;
      } else {
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${state.diagramName}.luml`;
        link.click();
        URL.revokeObjectURL(url);
        storeApi().setDirty(false);
        return true;
      }
    } finally {
      document.body.style.cursor = "default";
    }
  }, [storeApi, toObject, setFilePath]);

  const saveDiagramAs = useCallback(async () => {
    const state = storeApi();
    const flowObject = toObject(); 

    const cleanNodes: UmlClassNode[] = flowObject.nodes.map((node) => ({
      id: node.id,
      type: 'umlClass' as const,
      position: node.position,
      data: node.data as UmlClassData,
      selected: node.selected
    }));

    const cleanEdges = flowObject.edges as unknown as UmlEdge[];

    const dataToSave = {
      id: state.diagramId,
      name: state.diagramName,
      nodes: cleanNodes,
      edges: cleanEdges,
      viewport: flowObject.viewport
    };
    
    const content = JSON.stringify(dataToSave, null, 2);

    if (window.electronAPI?.isElectron()) {
      const result = await window.electronAPI.saveFile(content, undefined, state.diagramName);

      if (!result.canceled && result.filePath) {
        setFilePath(result.filePath);
        storeApi().setDirty(false);
      }
    }
  }, [storeApi, toObject, setFilePath]);

  const revertDiagram = useCallback(async () => {
    const currentPath = storeApi().currentFilePath;
    if (currentPath && window.electronAPI?.isElectron()) {
      const result = await window.electronAPI.readFile(currentPath);
      if (result.success && result.content) {
        loadFromFileContent(result.content, currentPath);
        storeApi().setDirty(false);
      } else {
        alert("Error reloading file: " + result.error);
      }
    }
  }, [storeApi, loadFromFileContent]);

  return {
    createNewDiagram,
    openDiagramFromDisk,
    importFromWeb,
    saveDiagram,
    saveDiagramAs,
    revertDiagram,
  };
};