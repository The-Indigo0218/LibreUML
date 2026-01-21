/* eslint-disable @typescript-eslint/no-unused-vars */
import { toPng } from "html-to-image";
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

export const ExportService = {
  downloadJson: (
    flowObject: ReactFlowJsonObject,
    id: string,
    name: string
  ): void => {
    const cleanEdges = flowObject.edges.map((edge) => {
      const {
        style,
        markerEnd,
        animated,
        zIndex,
        selected,
        ...semanticEdge
      } = edge;

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
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.luml`;
    link.click();
    URL.revokeObjectURL(url);
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
  },
};
