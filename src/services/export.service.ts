import { toPng, toSvg } from "html-to-image";
import {
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type ReactFlowJsonObject,
} from "reactflow";

export interface ExportImageOptions {
  fileName: string;
  format: "png" | "svg";
  scale: number;
  transparent: boolean;
  backgroundColor: string;
}

// PHASE 4: Export service works with generic React Flow objects, not UI types
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

    // PHASE 4: Use generic structure instead of casting to UI types
    const exportData = {
      id,
      name,
      nodes: cleanNodes,
      edges: cleanEdges,
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
    const nodesBounds = getNodesBounds(nodes);

    if (nodesBounds.width === 0 || nodesBounds.height === 0) return;

    const viewport = getViewportForBounds(
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
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
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

    // Expand Note node elements so html-to-image captures them without scrollbars.
    // Both the outer container (overflow-hidden) and the inner content area
    // (max-h-40 / overflow-y-auto) need to be temporarily unlocked.
    type StyleSnapshot = {
      el: HTMLElement;
      maxHeight: string;
      height: string;
      overflow: string;
    };
    const styleSnapshots: StyleSnapshot[] = [];

    viewportEl
      .querySelectorAll<HTMLElement>(".react-flow__node-umlNote")
      .forEach((noteNode) => {
        const container = noteNode.querySelector<HTMLElement>(":scope > div");
        const contentArea = noteNode.querySelector<HTMLElement>(".overflow-y-auto");

        [container, contentArea].forEach((el) => {
          if (!el) return;
          styleSnapshots.push({
            el,
            maxHeight: el.style.maxHeight,
            height: el.style.height,
            overflow: el.style.overflow,
          });
          el.style.height = "max-content";
          el.style.maxHeight = "none";
          el.style.overflow = "visible";
        });
      });

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
    } finally {
      // Restore original inline styles whether the export succeeded or failed.
      styleSnapshots.forEach(({ el, maxHeight, height, overflow }) => {
        el.style.maxHeight = maxHeight;
        el.style.height = height;
        el.style.overflow = overflow;
      });
    }
  },
};
