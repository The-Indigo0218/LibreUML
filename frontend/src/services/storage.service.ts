import type { ReactFlowJsonObject } from "reactflow";
import { ExportService } from "./export.service";
import type { DiagramState, UmlClassNode, UmlEdge } from "../features/diagram/types/diagram.types";

export const StorageService = {
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
        alert("El archivo está corrupto o no es válido.");
        return null;
      }
    } else {
      return null; 
    }
  }
};