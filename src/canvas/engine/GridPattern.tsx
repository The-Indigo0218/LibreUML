import { Shape } from 'react-konva';
import { useCallback } from 'react';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { Viewport } from './useViewport';

type GridPatternType = 'dots' | 'lines' | 'grid';

interface GridPatternProps {
  viewport: Viewport;
  stageWidth: number;
  stageHeight: number;
  type?: GridPatternType;
  /** Base grid spacing in world units */
  spacing?: number;
  /** Dot radius in screen pixels (dots mode only) */
  dotRadius?: number;
  color?: string;
}

// Minimum screen-pixel gap between grid elements — prevents thousands of draw calls at low zoom.
const MIN_DOT_PX   = 24;
const MIN_LINE_PX  = 16;

/** Returns the smallest spacing ≥ base such that spacing * scale ≥ minScreenPx. */
function adaptSpacing(base: number, scale: number, minScreenPx: number): number {
  let s = base;
  while (s * scale < minScreenPx) s *= 2;
  return s;
}

export default function GridPattern({
  stageWidth,
  stageHeight,
  type = 'dots',
  spacing = 40,
  dotRadius = 1,
  color = '#cbd5e1',
}: GridPatternProps) {
  const draw = useCallback(
    (ctx: Context, shape: KonvaShape) => {
      const stage = shape.getStage();
      if (!stage) return;

      const sc = stage.scaleX();
      const x  = stage.x();
      const y  = stage.y();

      const worldLeft   = -x / sc;
      const worldTop    = -y / sc;
      const worldRight  = (stageWidth  - x) / sc;
      const worldBottom = (stageHeight - y) / sc;

      if (type === 'dots') {
        const eff = adaptSpacing(spacing, sc, MIN_DOT_PX);
        const startX = Math.floor(worldLeft / eff) * eff;
        const startY = Math.floor(worldTop  / eff) * eff;
        const r = dotRadius / sc;

        ctx.beginPath();
        for (let wx = startX; wx <= worldRight; wx += eff) {
          for (let wy = startY; wy <= worldBottom; wy += eff) {
            ctx.moveTo(wx + r, wy);
            ctx.arc(wx, wy, r, 0, Math.PI * 2, false);
          }
        }
        ctx.fillStrokeShape(shape);
        return;
      }

      // lines / grid — native canvas for pixel-perfect 1px strokes
      const native = (ctx as any)._context as CanvasRenderingContext2D;
      native.save();
      native.strokeStyle = color;

      if (type === 'lines') {
        const eff    = adaptSpacing(spacing, sc, MIN_LINE_PX);
        const startX = Math.floor(worldLeft / eff) * eff;
        const startY = Math.floor(worldTop  / eff) * eff;

        native.globalAlpha = 0.45;
        native.lineWidth   = 1 / sc;
        native.beginPath();
        for (let wx = startX; wx <= worldRight; wx += eff) {
          native.moveTo(wx, worldTop);
          native.lineTo(wx, worldBottom);
        }
        for (let wy = startY; wy <= worldBottom; wy += eff) {
          native.moveTo(worldLeft,  wy);
          native.lineTo(worldRight, wy);
        }
        native.stroke();

      } else {
        // graph-paper: minor lines + major lines (×5)
        const minorEff    = adaptSpacing(spacing,     sc, MIN_LINE_PX);
        const majorEff    = adaptSpacing(spacing * 5, sc, MIN_LINE_PX);
        const startXMinor = Math.floor(worldLeft / minorEff) * minorEff;
        const startYMinor = Math.floor(worldTop  / minorEff) * minorEff;
        const startXMajor = Math.floor(worldLeft / majorEff) * majorEff;
        const startYMajor = Math.floor(worldTop  / majorEff) * majorEff;

        native.lineWidth = 1 / sc;

        // minor
        native.globalAlpha = 0.2;
        native.beginPath();
        for (let wx = startXMinor; wx <= worldRight; wx += minorEff) {
          native.moveTo(wx, worldTop);
          native.lineTo(wx, worldBottom);
        }
        for (let wy = startYMinor; wy <= worldBottom; wy += minorEff) {
          native.moveTo(worldLeft,  wy);
          native.lineTo(worldRight, wy);
        }
        native.stroke();

        // major
        native.globalAlpha = 0.5;
        native.beginPath();
        for (let wx = startXMajor; wx <= worldRight; wx += majorEff) {
          native.moveTo(wx, worldTop);
          native.lineTo(wx, worldBottom);
        }
        for (let wy = startYMajor; wy <= worldBottom; wy += majorEff) {
          native.moveTo(worldLeft,  wy);
          native.lineTo(worldRight, wy);
        }
        native.stroke();
      }

      native.restore();
    },
    [stageWidth, stageHeight, type, spacing, dotRadius, color],
  );

  return (
    <Shape
      sceneFunc={draw}
      fill={type === 'dots' ? color : 'transparent'}
      strokeEnabled={false}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
