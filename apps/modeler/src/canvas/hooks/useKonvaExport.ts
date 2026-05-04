/**
 * useKonvaExport — PNG/SVG export (MAG-01.13 + MAG-01.14 + MAG-01.15)
 *
 * PNG: captures ALL nodes by temporarily resetting the stage transform so
 *      all content maps to screen (0,0), regardless of current pan/zoom.
 * SVG: true vector SVG via diagramToSvg (MAG-01.15)
 */

import { useCallback } from 'react';
import { useStageStore } from '../store/stageStore';
import { useKonvaCanvasController } from './useKonvaCanvasController';
import { diagramToSvg } from '../export/diagramToSvg';
import type { ShapeDescriptor } from '../types/canvas.types';
import type { NodeViewModel, NoteViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { getClassShapeSize } from '../shapes/ClassShape';
import { getNoteShapeSize } from '../shapes/NoteShape';
import type Konva from 'konva';

export interface KonvaExportOptions {
  fileName: string;
  format: 'png' | 'svg';
  scale: number;
  transparent: boolean;
  backgroundColor: string;
}

const EXPORT_MARGIN = 50;

interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

  // Bypass viewport culling: force-show hidden direct children of all layers
  const culledNodes: Konva.Node[] = [];
  for (const layer of stage.getLayers()) {
    for (const child of layer.children ?? []) {
      if (!child.visible()) {
        culledNodes.push(child);
        child.show();
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bgRect = stage.findOne('.bg-rect') as any;
  const savedBgFill: string | null = bgRect ? bgRect.fill() as string : null;
  if (bgRect && bgColor) bgRect.fill(bgColor);

  try {
    stage.position({ x: -bounds.x, y: -bounds.y });
    stage.scale({ x: 1, y: 1 });
    stage.width(bounds.width);
    stage.height(bounds.height);
    stage.draw();
    return stage.toDataURL({ pixelRatio, mimeType });
  } finally {
    if (bgRect && savedBgFill !== null) bgRect.fill(savedBgFill);
    for (const node of culledNodes) node.hide();
    stage.position({ x: savedX, y: savedY });
    stage.scale({ x: savedScaleX, y: savedScaleY });
    stage.width(savedWidth);
    stage.height(savedHeight);
    stage.batchDraw();
  }
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
  const { shapes, edges } = useKonvaCanvasController();

  const exportDiagram = useCallback(
    async (options: KonvaExportOptions): Promise<void> => {
      if (!stage) {
        console.error('[useKonvaExport] No stage registered');
        return;
      }

      const bounds = calculateBoundsFromShapes(shapes);
      const pixelRatio = options.scale;

      if (options.format === 'png') {
        const bgColor = options.transparent ? undefined : options.backgroundColor;
      const dataUrl = bounds
          ? exportWithTemporaryTransform(stage, bounds, pixelRatio, 'image/png', bgColor)
          : stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
        await triggerDownload(dataUrl, options.fileName, 'png');
        return;
      }

      if (options.format === 'svg') {
        // MAG-01.15: True vector SVG via programmatic generation.
        const svgContent = diagramToSvg(shapes, edges, {
          transparent: options.transparent,
          backgroundColor: options.backgroundColor,
        });
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const svgDataUrl = URL.createObjectURL(blob);
        await triggerDownload(svgDataUrl, options.fileName, 'svg');
        URL.revokeObjectURL(svgDataUrl);
      }
    },
    [stage, shapes, edges],
  );

  return { exportDiagram, hasStage: !!stage };
}
