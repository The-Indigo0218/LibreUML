// src/services/storage.service.ts
import { toPng } from "html-to-image";
import { type Node, type ReactFlowJsonObject, getRectOfNodes, getTransformForBounds } from "reactflow";
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import type { DiagramState, UmlClassNode, UmlEdge } from "../../../types/diagram.types";

const isTauri = () => {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
};

export const StorageService = {
  saveDiagram: async (
    flowObject: ReactFlowJsonObject,
    id: string,
    name: string
  ): Promise<void> => {
    const cleanEdges = flowObject.edges.map((edge) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { style, markerEnd, animated, zIndex, selected, ...semanticEdge } = edge;
      return semanticEdge;
    });

    const exportData: DiagramState = {
      id,
      name,
      nodes: flowObject.nodes as unknown as UmlClassNode[],
      edges: cleanEdges as unknown as UmlEdge[],
      viewport: flowObject.viewport,
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    if (isTauri()) {
      try {
        const filePath = await save({
          defaultPath: `${name}.luml`,
          filters: [{ name: 'LibreUML Diagram', extensions: ['luml', 'json'] }]
        });

        if (filePath) {
          await writeTextFile(filePath, jsonString);
        }
      } catch (err) {
        console.error("Error guardando archivo nativo:", err);
        throw err;
      }
    } else {
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name}.luml`;
      link.click();
      URL.revokeObjectURL(url);
    }
  },

  openDiagram: async (): Promise<string | null> => {
    if (isTauri()) {
      try {
        const filePath = await open({
          multiple: false,
          filters: [{ name: 'LibreUML Diagram', extensions: ['luml', 'json'] }]
        });

        if (filePath && typeof filePath === 'string') { 
           return await readTextFile(filePath);
        }
      } catch (err) {
        console.error("Error leyendo archivo nativo:", err);
      }
      return null;
    } else {
      return null; 
    }
  },

  downloadPng: async (
    viewportEl: HTMLElement,
    nodes: Node[],
    fileName: string
  ): Promise<void> => {
    const nodesBounds = getRectOfNodes(nodes);
    const transform = getTransformForBounds(
      nodesBounds,
      nodesBounds.width,
      nodesBounds.height,
      0.5,
      2
    );

    const dataUrl = await toPng(viewportEl, {
      backgroundColor: "#0B0F1A",
      width: nodesBounds.width,
      height: nodesBounds.height,
      style: {
        width: `${nodesBounds.width}px`,
        height: `${nodesBounds.height}px`,
        transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
      },
    });


    const link = document.createElement("a");
    link.download = `${fileName}.png`;
    link.href = dataUrl;
    link.click();
  }
};