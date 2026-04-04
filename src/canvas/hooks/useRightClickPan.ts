import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

export interface UseRightClickPanOptions {
  stageRef: React.RefObject<Konva.Stage | null>;
  enabled?: boolean;
  isSpacePressedRef?: React.RefObject<boolean>;
  onPanEnd?: (pos: { x: number; y: number }) => void;
}

export interface UseRightClickPanReturn {
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
  const onPanEndRef = useRef(onPanEnd);

  useEffect(() => {
    onPanEndRef.current = onPanEnd;
  });

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
      onPanEndRef.current?.({ x: stage.x(), y: stage.y() });
    }
    isRightDraggingRef.current = false;
    lastPosRef.current = null;
  }, [stageRef, setCursor]);

  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!enabled || e.evt.button !== 2) return;
      if (isSpacePressedRef?.current) return;

      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      isRightDraggingRef.current = true;

      const pos = stage.getPointerPosition();
      if (pos) {
        lastPosRef.current = { x: pos.x, y: pos.y };
      }

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

      const dx = pos.x - lastPosRef.current.x;
      const dy = pos.y - lastPosRef.current.y;

      stage.x(stage.x() + dx);
      stage.y(stage.y() + dy);

      lastPosRef.current = { x: pos.x, y: pos.y };
      
      stage.batchDraw();
      setCursor('grabbing');
    },
    [enabled, stageRef, setCursor],
  );

  const onMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!enabled || !isRightDraggingRef.current) return;
      if (e.evt.button !== 2) return;

      e.evt.preventDefault();
      endPan();
    },
    [enabled, endPan],
  );

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