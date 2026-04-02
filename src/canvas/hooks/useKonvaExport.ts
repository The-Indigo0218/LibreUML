/**
 * useKonvaExport — PNG/SVG export via Konva stage.toDataURL (MAG-01.13 + MAG-01.14)
 *
 * Replaces html-to-image / ReactFlow export path.
 * PNG: stage.toDataURL({ pixelRatio, mimeType: 'image/png' })
 * SVG: raster image embedded in SVG envelope (true vector export deferred to future)
 *
 * MAG-01.14: Fixed to export entire diagram (all nodes) instead of viewport only.
 */

import { useCallback } from 'react';
import { useStageStore } from '../store/stageStore';
import { useVFSStore } from '../../store/project-vfs.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import type { VFSFile, ViewNode } from '../../core/domain/vfs/vfs.types';

export interface KonvaExportOptions {
  fileName: string;
  format: 'png' | 'svg';
  scale: number;
  transparent: boolean;
  backgroundColor: string;
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
 * Returns bounds with margin padding, or default bounds if no nodes.
 */
function calculateDiagramBounds(nodes: ViewNode[]): DiagramBounds {
  // Empty diagram: return default bounds
  if (nodes.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    };
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

async function triggerDownload(dataUrl: string, fileName: string, ext: string) {
  if (window.electronAPI?.isElectron()) {
    const result = await window.electronAPI.saveImage(dataUrl, fileName, ext as 'png' | 'svg');
    if (result.canceled) return;
  } else {
    const link = document.createElement('a');
    link.download = `${fileName}.${ext}`;
    link.href = dataUrl;
    link.click();
  }
}

export function useKonvaExport() {
  const stage = useStageStore((s) => s.stage);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);

  const exportDiagram = useCallback(
    async (options: KonvaExportOptions): Promise<void> => {
      if (!stage) {
        console.error('[useKonvaExport] No stage registered');
        return;
      }

      // Get current diagram nodes to calculate bounds
      const project = useVFSStore.getState().project;
      if (!activeTabId || !project) {
        console.error('[useKonvaExport] No active diagram');
        return;
      }

      const fileNode = project.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') {
        console.error('[useKonvaExport] Active tab is not a file');
        return;
      }

      const content = (fileNode as VFSFile).content;
      if (!isDiagramView(content)) {
        console.error('[useKonvaExport] File content is not a diagram view');
        return;
      }

      // Calculate bounds from all nodes (visible + off-screen)
      const bounds = calculateDiagramBounds(content.nodes);
      const pixelRatio = options.scale;

      if (options.format === 'png') {
        const dataUrl = stage.toDataURL({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          pixelRatio,
          mimeType: 'image/png',
        });
        await triggerDownload(dataUrl, options.fileName, 'png');
        return;
      }

      if (options.format === 'svg') {
        // Raster PNG embedded in an SVG envelope.
        // True vector SVG via canvas2svg can be added in a future sprint.
        const pngDataUrl = stage.toDataURL({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          pixelRatio,
          mimeType: 'image/png',
        });
        const w = bounds.width * pixelRatio;
        const h = bounds.height * pixelRatio;
        const svgContent = [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
          options.transparent ? '' : `<rect width="${w}" height="${h}" fill="${options.backgroundColor}"/>`,
          `<image href="${pngDataUrl}" width="${w}" height="${h}"/>`,
          '</svg>',
        ].join('');
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const svgDataUrl = URL.createObjectURL(blob);
        await triggerDownload(svgDataUrl, options.fileName, 'svg');
        URL.revokeObjectURL(svgDataUrl);
      }
    },
    [stage, activeTabId],
  );

  return { exportDiagram, hasStage: !!stage };
}
