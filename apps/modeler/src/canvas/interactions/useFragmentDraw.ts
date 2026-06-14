/**
 * useFragmentDraw — StarUML-style "draw a box to create a fragment" gesture (G-a).
 *
 * Active only while a fragment kind is armed (see `sequenceToolStore`). On a
 * left-button drag starting over the stage background it draws a rectangle; on
 * release it reports the final rect (or `null` for a click without a meaningful
 * drag) so the caller can resolve coverage and create the fragment. It does not
 * mutate the model itself — the caller owns insertion + disarming.
 *
 * Mirrors the lasso mechanics in `useSelection`, but on plain left-drag (the
 * lasso needs Space + right-click) and gated on the armed state.
 */

import { useState, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

export interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseFragmentDrawOptions {
  stageRef: RefObject<Konva.Stage | null>;
  /** Whether a fragment kind is currently armed. */
  armed: boolean;
  /**
   * Called on mouse-up. Receives the drawn rect, or `null` when the drag was too
   * small to count as a box (a plain click → caller's fallback insert).
   */
  onComplete: (rect: DrawRect | null) => void;
}

export interface UseFragmentDrawReturn {
  drawRect: DrawRect | null;
  /** True while a box is actively being drawn — lets the canvas suppress other gestures. */
  isDrawingRef: RefObject<boolean>;
  stageHandlers: {
    onMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  };
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number): DrawRect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Minimum box size (world-space px) before a drag counts as a fragment box. */
const DRAW_THRESHOLD = 8;

export function useFragmentDraw({ stageRef, armed, onComplete }: UseFragmentDrawOptions): UseFragmentDrawReturn {
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const isDrawing = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!armed || e.evt.button !== 0) return;
      const stage = stageRef.current;
      if (!stage) return;

      // Only start on the stage background / grid / edges — not on node shapes.
      const targetLayer = e.target.getLayer();
      if (targetLayer && targetLayer.name() === 'nodes') return;

      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      isDrawing.current = true;
      start.current = { x: pos.x, y: pos.y };
    },
    [armed, stageRef],
  );

  const onMouseMove = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      if (!isDrawing.current || !start.current) return;
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      setDrawRect(normalizeRect(start.current.x, start.current.y, pos.x, pos.y));
    },
    [stageRef],
  );

  const onMouseUp = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      if (!isDrawing.current) return;
      const stage = stageRef.current;
      let result: DrawRect | null = null;

      if (stage && start.current) {
        const pos = stage.getRelativePointerPosition();
        if (pos) {
          const rect = normalizeRect(start.current.x, start.current.y, pos.x, pos.y);
          if (rect.width > DRAW_THRESHOLD || rect.height > DRAW_THRESHOLD) result = rect;
        }
      }

      isDrawing.current = false;
      start.current = null;
      setDrawRect(null);
      onComplete(result);
    },
    [stageRef, onComplete],
  );

  return {
    drawRect,
    isDrawingRef: isDrawing,
    stageHandlers: { onMouseDown, onMouseMove, onMouseUp },
  };
}
