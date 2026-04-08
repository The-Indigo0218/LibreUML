/**
 * export.service.ts — Konva-native image export (MAG-01.13 + MAG-01.14 + MAG-01.15)
 *
 * Replaces html-to-image / ReactFlow DOM capture.
 * PNG: captures ALL nodes by temporarily resetting the stage transform so
 *      all content maps to screen (0,0), regardless of current pan/zoom.
 * SVG: vector SVG via diagramToSvg (MAG-01.15) when shapes/edges are provided;
 *      falls back to raster PNG-in-SVG otherwise (legacy path).
 * JSON export is unchanged (no canvas dependency).
 *
 * Note: This service is legacy. New code should use useKonvaExport hook instead.
 */

import type Konva from 'konva';
import type { ViewNode } from '../core/domain/vfs/vfs.types';
import type { ShapeDescriptor, EdgeDescriptor } from '../canvas/types/canvas.types';
import type { NodeViewModel, NoteViewModel } from '../adapters/react-flow/view-models/node.view-model';
import { getClassShapeSize } from '../canvas/shapes/ClassShape';
import { getNoteShapeSize } from '../canvas/shapes/NoteShape';
import { diagramToSvg } from '../canvas/export/diagramToSvg';

export interface ExportImageOptions {
  fileName: string;
  format: 'png' | 'svg';
  scale: number;
  transparent: boolean;
  backgroundColor: string;
  nodes?: ViewNode[];            // Legacy: ViewNode positions for bounds (fallback only)
  shapes?: ShapeDescriptor[];   // Preferred: full shape descriptors for accurate bounds + vector SVG
  edges?: EdgeDescriptor[];     // Optional: edge descriptors for vector SVG
}

const EXPORT_MARGIN = 50;

// Fallback dimensions used when shapes have no size info (legacy nodes path)
const NODE_WIDTH = 256;
const NODE_HEIGHT = 120;

interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate bounding box from ShapeDescriptor[] using accurate per-shape dimensions.
 * Returns null for an empty diagram (falls back to viewport capture).
 */
function calculateBoundsFromShapes(shapes: ShapeDescriptor[]): DiagramBounds | null {
  if (shapes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    const { width, height } =
      shape.type === 'note'
        ? getNoteShapeSize(shape.data as NoteViewModel)
        : getClassShapeSize(shape.data as NodeViewModel);

    minX = Math.min(minX, shape.x);
    minY = Math.min(minY, shape.y);
    maxX = Math.max(maxX, shape.x + width);
    maxY = Math.max(maxY, shape.y + height);
  }

  return {
    x: minX - EXPORT_MARGIN,
    y: minY - EXPORT_MARGIN,
    width: maxX - minX + EXPORT_MARGIN * 2,
    height: maxY - minY + EXPORT_MARGIN * 2,
  };
}

/**
 * Legacy bounds calculation from ViewNode[] (used when shapes are unavailable).
 */
function calculateDiagramBounds(nodes: ViewNode[]): DiagramBounds | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + (node.width ?? NODE_WIDTH));
    maxY = Math.max(maxY, node.y + (node.height ?? NODE_HEIGHT));
  }

  return {
    x: minX - EXPORT_MARGIN,
    y: minY - EXPORT_MARGIN,
    width: maxX - minX + EXPORT_MARGIN * 2,
    height: maxY - minY + EXPORT_MARGIN * 2,
  };
}

/**
 * Export the full diagram by temporarily resetting the stage transform so all
 * content is visible at scale=1, regardless of current pan/zoom position.
 *
 * Two additional steps run before the capture and are restored after:
 *  1. Culling bypass — direct children of all layers that are hidden by the
 *     viewport culler (visible=false) are force-shown so off-screen nodes
 *     appear in the export image.
 *  2. Background fill — if bgColor is provided the `.bg-rect` node's fill is
 *     temporarily changed from "transparent" to the canvas background color.
 *
 * All mutations are synchronous and restored in `finally`, so the browser
 * cannot paint the intermediate state before the viewport is restored.
 */
function exportWithTemporaryTransform(
  stage: Konva.Stage,
  bounds: DiagramBounds,
  pixelRatio: number,
  mimeType: string,
  bgColor?: string,
): string {
  const savedX = stage.x();
  const savedY = stage.y();
  const savedScaleX = stage.scaleX();
  const savedScaleY = stage.scaleY();
  const savedWidth = stage.width();
  const savedHeight = stage.height();

  // 1. Bypass viewport culling: show any hidden direct child of every layer
  const culledNodes: Konva.Node[] = [];
  for (const layer of stage.getLayers()) {
    for (const child of layer.children ?? []) {
      if (!child.visible()) {
        culledNodes.push(child);
        child.show();
      }
    }
  }

  // 2. Apply background: find the bg-rect and change its fill temporarily
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bgRect = stage.findOne('.bg-rect') as any;
  const savedBgFill: string | null = bgRect ? bgRect.fill() as string : null;
  if (bgRect && bgColor) {
    bgRect.fill(bgColor);
  }

  try {
    // Translate so the top-left diagram corner maps to screen (0, 0), scale = 1
    stage.position({ x: -bounds.x, y: -bounds.y });
    stage.scale({ x: 1, y: 1 });
    stage.width(bounds.width);
    stage.height(bounds.height);
    // Force a synchronous redraw with the new transform before capturing
    stage.draw();
    return stage.toDataURL({ pixelRatio, mimeType });
  } finally {
    // Restore background fill
    if (bgRect && savedBgFill !== null) {
      bgRect.fill(savedBgFill);
    }
    // Restore culled nodes
    for (const node of culledNodes) {
      node.hide();
    }
    // Restore stage transform
    stage.position({ x: savedX, y: savedY });
    stage.scale({ x: savedScaleX, y: savedScaleY });
    stage.width(savedWidth);
    stage.height(savedHeight);
    stage.batchDraw();
  }
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

    // Prefer shapes (accurate per-shape dimensions) over legacy nodes (estimated sizes)
    const bounds =
      options.shapes && options.shapes.length > 0
        ? calculateBoundsFromShapes(options.shapes)
        : options.nodes
        ? calculateDiagramBounds(options.nodes)
        : null;

    const bgColor = options.transparent ? undefined : options.backgroundColor;

    if (options.format === 'png') {
      const dataUrl = bounds
        ? exportWithTemporaryTransform(stage, bounds, pixelRatio, 'image/png', bgColor)
        : stage.toDataURL({ pixelRatio, mimeType: 'image/png' });

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
      let svgContent: string;

      if (options.shapes && options.edges) {
        // MAG-01.15: True vector SVG — programmatic generation from diagram data.
        svgContent = diagramToSvg(options.shapes, options.edges, {
          transparent: options.transparent,
          backgroundColor: options.backgroundColor,
        });
      } else {
        // Legacy fallback: raster PNG embedded in an SVG envelope.
        let pngDataUrl: string;
        let w: number;
        let h: number;

        if (bounds) {
          pngDataUrl = exportWithTemporaryTransform(stage, bounds, pixelRatio, 'image/png', bgColor);
          w = bounds.width * pixelRatio;
          h = bounds.height * pixelRatio;
        } else {
          pngDataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
          w = stage.width() * pixelRatio;
          h = stage.height() * pixelRatio;
        }

        svgContent = [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
          options.transparent ? '' : `<rect width="${w}" height="${h}" fill="${options.backgroundColor}"/>`,
          `<image href="${pngDataUrl}" width="${w}" height="${h}"/>`,
          '</svg>',
        ].join('');
      }

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
