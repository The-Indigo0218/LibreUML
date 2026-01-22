import type { ReactFlowJsonObject } from "reactflow";
import { ExportService } from "./export.service";
import type { DiagramState, UmlClassNode, UmlEdge } from "../features/diagram/types/diagram.types";

export const StorageService = {
  // --- SAVE DIAGRAM ---
  saveDiagram: async (
    flowObject: ReactFlowJsonObject,
    id: string,
    name: string,
    currentPath?: string 
  ): Promise<{ success: boolean; filePath?: string; canceled?: boolean }> => {
    
    const cleanEdges = flowObject.edges.map((edge) => {
      const { ...semanticEdge } = edge;
      return semanticEdge;
    });

    const exportData: DiagramState = {
      id,
      name,
      nodes: flowObject.nodes as unknown as UmlClassNode[],
      edges: cleanEdges as unknown as UmlEdge[],
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
  openDiagram: async (): Promise<{ data: DiagramState; filePath: string } | null> => {
    if (window.electronAPI?.isElectron()) {
      try {
        const result = await window.electronAPI.openFile();
        if (result.canceled || !result.content || !result.filePath) return null;

        const parsedData = JSON.parse(result.content) as DiagramState;

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
  reloadDiagram: async (filePath: string): Promise<DiagramState | null> => {
    if (window.electronAPI?.isElectron()) {
      try {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success && result.content) {
           return JSON.parse(result.content) as DiagramState;
        }
      } catch (error) {
        console.error("Error reloading file:", error);
      }
    }
    return null;
  },
};