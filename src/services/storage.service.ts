import { ExportService } from "./export.service";

interface DiagramJsonObject {
  nodes: unknown[];
  edges: unknown[];
  viewport: { x: number; y: number; zoom: number };
}

// PHASE 4: Remove UI type dependencies - storage works with generic React Flow objects
export const StorageService = {
  // --- SAVE DIAGRAM ---
  saveDiagram: async (
    flowObject: DiagramJsonObject,
    id: string,
    name: string,
    currentPath?: string 
  ): Promise<{ success: boolean; filePath?: string; canceled?: boolean }> => {
    
    const cleanEdges = flowObject.edges.map((edge) => edge);

    // PHASE 4: Use generic structure instead of casting to UI types
    const exportData = {
      id,
      name,
      nodes: flowObject.nodes,
      edges: cleanEdges,
      viewport: flowObject.viewport,
    };

    const jsonContent = JSON.stringify(exportData, null, 2);

    if (window.electronAPI?.isElectron()) {
      try {
        const result = await window.electronAPI.saveFile(jsonContent, currentPath, name);
        if (result.canceled) return { success: false, canceled: true };
        
        return { success: true, filePath: result.filePath };
      } catch (error) {
        console.error("Error saving via Electron:", error);
        return { success: false };
      }
    } else {
      ExportService.downloadJson(flowObject, id, name);
      return { success: true };
    }
  },

  // --- OPEN WITH DIALOG ---
  openDiagram: async (): Promise<{ data: any; filePath: string } | null> => {
    if (window.electronAPI?.isElectron()) {
      try {
        const result = await window.electronAPI.openFile();
        if (result.canceled || !result.content || !result.filePath) return null;

        const parsedData = JSON.parse(result.content);

        return { 
            data: parsedData, 
            filePath: result.filePath 
        };
      } catch (error) {
        console.error("Error opening via Electron:", error);
        alert("File is corrupt or invalid.");
        return null;
      }
    } else {
      return null; 
    }
  },

  // RELOAD FROM DISK (SILENT) ---
  reloadDiagram: async (filePath: string): Promise<any | null> => {
    if (window.electronAPI?.isElectron()) {
      try {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success && result.content) {
           return JSON.parse(result.content);
        }
      } catch (error) {
        console.error("Error reloading file:", error);
      }
    }
    return null;
  },
};