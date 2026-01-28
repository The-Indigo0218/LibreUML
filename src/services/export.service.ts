import { toPng, toSvg } from "html-to-image";
import {
  getRectOfNodes,
  getTransformForBounds,
  type Node,
  type ReactFlowJsonObject,
} from "reactflow";
import type {
  DiagramState,
  UmlClassNode,
  UmlEdge,
} from "../features/diagram/types/diagram.types";

export interface ExportImageOptions {
  fileName: string;
  format: "png" | "svg";
  scale: number;
  transparent: boolean;
  backgroundColor: string;
}

export const ExportService = {
  // --- JSON (NATIVO) ---
  downloadJson: (
    flowObject: ReactFlowJsonObject,
    id: string,
    name: string,
  ): void => {
    const cleanEdges = flowObject.edges.map((edge) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { style, markerEnd, animated, zIndex, selected, ...semanticEdge } =
        edge;
      return semanticEdge;
    });

    const cleanNodes = flowObject.nodes.map((node) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { selected, dragging, ...semanticNode } = node;
      return semanticNode;
    });

    const exportData: DiagramState = {
      id,
      name,
      nodes: cleanNodes as unknown as UmlClassNode[],
      edges: cleanEdges as unknown as UmlEdge[],
      viewport: flowObject.viewport,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.luml`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // --- IMAGEN (PNG/SVG) ---
  downloadImage: async (
    viewportEl: HTMLElement,
    nodes: Node[],
    options: ExportImageOptions,
  ): Promise<void> => {
    const nodesBounds = getRectOfNodes(nodes);

    if (nodesBounds.width === 0 || nodesBounds.height === 0) return;

    const transform = getTransformForBounds(
      nodesBounds,
      nodesBounds.width,
      nodesBounds.height,
      0.5,
      2,
    );

    const backgroundStyle =
      !options.transparent && options.format === "svg"
        ? { backgroundColor: options.backgroundColor }
        : {};

    const config = {
      width: nodesBounds.width,
      height: nodesBounds.height,
      style: {
        width: `${nodesBounds.width}px`,
        height: `${nodesBounds.height}px`,
        transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
        ...backgroundStyle,
      },
      backgroundColor:
        options.format === "png" && !options.transparent
          ? options.backgroundColor
          : undefined,
      filter: (node: HTMLElement) => {
        const classList = node.classList;
        if (!classList) return true;
        return (
          !classList.contains("react-flow__minimap") &&
          !classList.contains("react-flow__controls") &&
          !classList.contains("react-flow__panel")
        );
      },
    };

    let dataUrl = "";

    try {
      if (options.format === "svg") {
        dataUrl = await toSvg(viewportEl, config);
      } else {
        dataUrl = await toPng(viewportEl, {
          ...config,
          pixelRatio: options.scale,
        });
      }

      if (window.electronAPI?.isElectron()) {
        const result = await window.electronAPI.saveImage(
          dataUrl,
          options.fileName,
          options.format,
        );

        if (result.canceled) {
          console.log("Exportación cancelada por el usuario");
        }
      } else {
        const link = document.createElement("a");
        link.download = `${options.fileName}.${options.format}`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error("Error exporting image:", error);
      throw error;
    }
  },
};
