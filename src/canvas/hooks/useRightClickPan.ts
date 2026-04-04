/**
 * useRightClickPan — Right-click drag to pan canvas
 *
 * Implements right-click pan interaction:
 * - Right-click + drag → pans the canvas (moves viewport)
 * - Cursor changes to "grab" on right-click down, "grabbing" while dragging
 * - If Space is held, skip pan — lasso takes over (Space + right-click = lasso)
 * - Calls onPanEnd({x,y}) on release so viewport state syncs for grid/editor
 * - Window mouseup fallback handles release outside canvas
 *
 * Architecture:
 *   The Stage is uncontrolled — React never passes x/y props.
 *   We move the stage imperatively via stage.x() / stage.y().
 *   No React state updates during pan (zero re-renders from this hook).
 *   On mouseUp, onPanEnd is called to sync React viewport state for the grid.
 *
 * This is the DEFAULT pan behavior (no modifiers, except Space which overrides it).
 */

import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

export interface UseRightClickPanOptions {
  /** Stage ref to control viewport */
  stageRef: React.RefObject<Konva.Stage | null>;
  /** Whether right-click pan is enabled (default: true) */
  enabled?: boolean;
  /**
   * Ref to Space key pressed state.
   * When Space is held, right-click triggers lasso instead of pan — skip activation.
   */
  isSpacePressedRef?: React.RefObject<boolean>;
  /**
   * Called with final stage {x,y} when pan ends.
   * Syncs imperative pan position into React viewport state so the grid
   * and inline editor update to reflect the final position.
   */
  onPanEnd?: (pos: { x: number; y: number }) => void;
}

export interface UseRightClickPanReturn {
  /** Synchronous ref — safe to read inside Konva event handlers without stale-closure risk */
  isRightDraggingRef: React.RefObject<boolean>;
  stageHandlers: {
    onMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  };
}

export function useRightClickPan(options: UseRightClickPanOptions): UseRightClickPanReturn {
  const { stageRef, enabled = true, isSpacePressedRef, onPanEnd } = options;

  const isRightDraggingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Keep onPanEnd in a ref so the window listener effect doesn't need it as a dep.
  const onPanEndRef = useRef(onPanEnd);
  useEffect(() => {
    onPanEndRef.current = onPanEnd;
  });

  /** Set cursor on Konva's internal container element. */
  const setCursor = useCallback(
    (cursor: string) => {
      const stage = stageRef.current;
      if (stage) {
        stage.container().style.cursor = cursor;
      }
    },
    [stageRef],
  );

  const endPan = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      setCursor('default');
      // Sync final position into React state (for grid / inline editor).
      onPanEndRef.current?.({ x: stage.x(), y: stage.y() });
    }
    isRightDraggingRef.current = false;
    lastPosRef.current = null;
  }, [stageRef, setCursor]);

  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!enabled) return;
      if (e.evt.button !== 2) return;

      // Space + right-click → lasso mode; don't start pan
      if (isSpacePressedRef?.current) return;

      e.evt.preventDefault(); // Prevent context menu on pan-start

      const stage = stageRef.current;
      if (!stage) return;

      isRightDraggingRef.current = true;

      const pos = stage.getPointerPosition();
      if (pos) {
        lastPosRef.current = { x: pos.x, y: pos.y };
      }

      // Bug 2 fix: Set cursor to 'grabbing' immediately (user is already dragging)
      setCursor('grabbing');
    },
    [enabled, isSpacePressedRef, stageRef, setCursor],
  );

  const onMouseMove = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      if (!enabled || !isRightDraggingRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos || !lastPosRef.current) return;

      // Calculate delta in screen space and apply to stage position.
      // Konva is the source of truth — stage.x() always returns the live value
      // because the Stage is uncontrolled (no React x/y props to overwrite it).
      const dx = pos.x - lastPosRef.current.x;
      const dy = pos.y - lastPosRef.current.y;

      stage.x(stage.x() + dx);
      stage.y(stage.y() + dy);

      lastPosRef.current = { x: pos.x, y: pos.y };

      // Bug 1 fix: Force Konva to repaint all layers (including grid)
      // GridPattern now reads stage.x()/y() directly, so this triggers correct redraw
      stage.batchDraw();

      setCursor('grabbing');
    },
    [enabled, stageRef, setCursor],
  );

  const onMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!enabled || !isRightDraggingRef.current) return;
      if (e.evt.button !== 2) return;

      // Bug 4 fix: Prevent native context menu after panning
      e.evt.preventDefault();

      endPan();
    },
    [enabled, endPan],
  );

  // Window-level mouseup fallback: fires when the user releases outside the canvas.
  // Without this, releasing outside leaves isRightDraggingRef stuck at true.
  useEffect(() => {
    if (!enabled) return;

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      if (!isRightDraggingRef.current) return;
      endPan();
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [enabled, endPan]);

  return {
    isRightDraggingRef,
    stageHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
    },
  };
}
