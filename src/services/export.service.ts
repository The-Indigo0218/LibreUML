/**
 * export.service.ts — Konva-native image export (MAG-01.13 + MAG-01.14)
 *
 * Replaces html-to-image / ReactFlow DOM capture.
 * PNG/SVG are now produced via stage.toDataURL on the Konva canvas.
 * JSON export is unchanged (no canvas dependency).
 *
 * MAG-01.14: Updated to export entire diagram (all nodes) instead of viewport only.
 * Note: This service is legacy. New code should use useKonvaExport hook instead.
 */

import type Konva from 'konva';
import type { ViewNode } from '../core/domain/vfs/vfs.types';

export interface ExportImageOptions {
  fileName: string;
  format: 'png' | 'svg';
  scale: number;
  transparent: boolean;
  backgroundColor: string;
  nodes?: ViewNode[]; // Optional: if provided, calculates bounds from nodes
}

// Node dimensions (matches ClassShape MIN_W and typical height)
const NODE_WIDTH = 256;
const NODE_HEIGHT = 120;
const EXPORT_MARGIN = 50; // Padding around diagram bounds

interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate bounding box for all nodes in the diagram.
 * Returns bounds with margin padding, or null if no nodes (uses viewport).
 */
function calculateDiagramBounds(nodes: ViewNode[]): DiagramBounds | null {
  // No nodes: return null to use viewport bounds
  if (nodes.length === 0) {
    return null;
  }

  // Find min/max coordinates across all nodes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const nodeWidth = node.width ?? NODE_WIDTH;
    const nodeHeight = node.height ?? NODE_HEIGHT;

    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + nodeWidth);
    maxY = Math.max(maxY, node.y + nodeHeight);
  }

  // Add margin padding
  return {
    x: minX - EXPORT_MARGIN,
    y: minY - EXPORT_MARGIN,
    width: maxX - minX + EXPORT_MARGIN * 2,
    height: maxY - minY + EXPORT_MARGIN * 2,
  };
}

export const ExportService = {
  // --- JSON (legacy / VFS download) ---
  downloadJson: (
    flowObject: { nodes: unknown[]; edges: unknown[]; viewport?: unknown },
    id: string,
    name: string,
  ): void => {
    const exportData = { id, name, ...flowObject };
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.luml`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // --- IMAGE (PNG / SVG via Konva stage) ---
  downloadImage: async (
    stage: Konva.Stage,
    options: ExportImageOptions,
  ): Promise<void> => {
    const pixelRatio = options.scale;

    // Calculate bounds from nodes if provided (MAG-01.14)
    const bounds = options.nodes ? calculateDiagramBounds(options.nodes) : null;

    let dataUrl: string;

    if (options.format === 'png') {
      if (bounds) {
        // Export full diagram with calculated bounds
        dataUrl = stage.toDataURL({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          pixelRatio,
          mimeType: 'image/png',
        });
      } else {
        // Fallback to viewport (legacy behavior)
        dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
      }

      if (window.electronAPI?.isElectron()) {
        const result = await window.electronAPI.saveImage(dataUrl, options.fileName, 'png');
        if (result.canceled) return;
      } else {
        const link = document.createElement('a');
        link.download = `${options.fileName}.png`;
        link.href = dataUrl;
        link.click();
      }
      return;
    }

    if (options.format === 'svg') {
      // Raster PNG embedded in an SVG envelope — true vector SVG deferred to future.
      let pngDataUrl: string;
      let w: number;
      let h: number;

      if (bounds) {
        // Export full diagram with calculated bounds
        pngDataUrl = stage.toDataURL({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          pixelRatio,
          mimeType: 'image/png',
        });
        w = bounds.width * pixelRatio;
        h = bounds.height * pixelRatio;
      } else {
        // Fallback to viewport (legacy behavior)
        pngDataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
        w = stage.width() * pixelRatio;
        h = stage.height() * pixelRatio;
      }

      const svgContent = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
        options.transparent ? '' : `<rect width="${w}" height="${h}" fill="${options.backgroundColor}"/>`,
        `<image href="${pngDataUrl}" width="${w}" height="${h}"/>`,
        '</svg>',
      ].join('');

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const svgDataUrl = URL.createObjectURL(blob);

      if (window.electronAPI?.isElectron()) {
        const result = await window.electronAPI.saveImage(svgDataUrl, options.fileName, 'svg');
        if (result.canceled) { URL.revokeObjectURL(svgDataUrl); return; }
      } else {
        const link = document.createElement('a');
        link.download = `${options.fileName}.svg`;
        link.href = svgDataUrl;
        link.click();
      }
      URL.revokeObjectURL(svgDataUrl);
    }
  },
};
