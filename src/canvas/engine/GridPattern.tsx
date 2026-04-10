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
  stageWidth,
  stageHeight,
  spacing = 40,
  dotRadius = 1,
  color = '#cbd5e1',
}: GridPatternProps) {
  const draw = useCallback(
    (ctx: Context, shape: KonvaShape) => {
    
      const stage = shape.getStage();
      if (!stage) return;

      const x = stage.x();
      const y = stage.y();
      const scale = stage.scaleX();

      const worldLeft = -x / scale;
      const worldTop = -y / scale;
      const worldRight = (stageWidth - x) / scale;
      const worldBottom = (stageHeight - y) / scale;

      const startX = Math.floor(worldLeft / spacing) * spacing;
      const startY = Math.floor(worldTop / spacing) * spacing;

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
    [stageWidth, stageHeight, spacing, dotRadius],
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
