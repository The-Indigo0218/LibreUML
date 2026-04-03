/**
 * useRightClickPan — Right-click drag to pan canvas
 *
 * Implements right-click pan interaction:
 * - Right-click + drag → pans the canvas (moves viewport)
 * - Cursor changes to "grab" on right-click down
 * - Cursor changes to "grabbing" while dragging
 * - Works anywhere on canvas (empty space or over nodes)
 *
 * This is the DEFAULT pan behavior (no modifiers needed).
 */

import { useCallback, useRef, useState } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

export interface UseRightClickPanOptions {
  /** Stage ref to control viewport */
  stageRef: React.RefObject<Konva.Stage | null>;
  /** Container ref to change cursor style */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether right-click pan is enabled (default: true) */
  enabled?: boolean;
}

export interface UseRightClickPanReturn {
  isRightDragging: boolean;
  stageHandlers: {
    onMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  };
}

export function useRightClickPan(options: UseRightClickPanOptions): UseRightClickPanReturn {
  const { stageRef, containerRef, enabled = true } = options;
  const [isRightDragging, setIsRightDragging] = useState(false);
  const isRightDraggingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!enabled) return;

      // Only handle right-click (button 2)
      if (e.evt.button !== 2) return;

      e.evt.preventDefault(); // Prevent context menu

      const stage = stageRef.current;
      const container = containerRef.current;
      if (!stage || !container) return;

      isRightDraggingRef.current = true;
      setIsRightDragging(true);

      // Store initial pointer position
      const pos = stage.getPointerPosition();
      if (pos) {
        lastPosRef.current = { x: pos.x, y: pos.y };
      }

      // Change cursor to "grab"
      container.style.cursor = 'grab';
    },
    [enabled, stageRef, containerRef],
  );

  const onMouseMove = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      if (!enabled || !isRightDraggingRef.current) return;

      const stage = stageRef.current;
      const container = containerRef.current;
      if (!stage || !container) return;

      const pos = stage.getPointerPosition();
      if (!pos || !lastPosRef.current) return;

      // Calculate delta in screen space
      const dx = pos.x - lastPosRef.current.x;
      const dy = pos.y - lastPosRef.current.y;

      // Update stage position (pan)
      stage.x(stage.x() + dx);
      stage.y(stage.y() + dy);

      // Update last position
      lastPosRef.current = { x: pos.x, y: pos.y };

      // Change cursor to "grabbing"
      container.style.cursor = 'grabbing';
    },
    [enabled, stageRef, containerRef],
  );

  const onMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!enabled || !isRightDraggingRef.current) return;

      // Only handle right-click release
      if (e.evt.button !== 2) return;

      const container = containerRef.current;
      if (container) {
        container.style.cursor = 'default';
      }

      isRightDraggingRef.current = false;
      setIsRightDragging(false);
      lastPosRef.current = null;
    },
    [enabled, containerRef],
  );

  return {
    isRightDragging,
    stageHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
    },
  };
}
