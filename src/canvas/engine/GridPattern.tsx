import { Shape } from 'react-konva';
import { useCallback } from 'react';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { Viewport } from './useViewport';

interface GridPatternProps {
  viewport: Viewport;
  stageWidth: number;
  stageHeight: number;
  /** Grid dot spacing in world units */
  spacing?: number;
  /** Dot radius in screen pixels (constant at all zoom levels) */
  dotRadius?: number;
  /** CSS color string */
  color?: string;
}

export default function GridPattern({
  viewport,
  stageWidth,
  stageHeight,
  spacing = 24,
  dotRadius = 1.5,
  color = '#94a3b8',
}: GridPatternProps) {
  const draw = useCallback(
    (ctx: Context, shape: KonvaShape) => {
      const { x, y, scale } = viewport;

      // Visible bounds in world space
      const worldLeft = -x / scale;
      const worldTop = -y / scale;
      const worldRight = (stageWidth - x) / scale;
      const worldBottom = (stageHeight - y) / scale;

      // Snap start position to grid
      const startX = Math.floor(worldLeft / spacing) * spacing;
      const startY = Math.floor(worldTop / spacing) * spacing;

      // Dot radius in world units so it stays constant on screen
      const r = dotRadius / scale;

      ctx.beginPath();
      for (let wx = startX; wx <= worldRight; wx += spacing) {
        for (let wy = startY; wy <= worldBottom; wy += spacing) {
          ctx.moveTo(wx + r, wy);
          ctx.arc(wx, wy, r, 0, Math.PI * 2, false);
        }
      }
      ctx.fillStrokeShape(shape);
    },
    [viewport, stageWidth, stageHeight, spacing, dotRadius],
  );

  return (
    <Shape
      sceneFunc={draw}
      fill={color}
      strokeEnabled={false}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
