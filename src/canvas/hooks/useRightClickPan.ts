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
  const windowMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);

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
    if (windowMouseMoveRef.current) {
      window.removeEventListener('mousemove', windowMouseMoveRef.current);
      windowMouseMoveRef.current = null;
    }
    const stage = stageRef.current;
    if (stage) {
      setCursor('default');
      onPanEndRef.current?.({ x: stage.x(), y: stage.y() });
    }
    isRightDraggingRef.current = false;
    lastPosRef.current = null;
  }, [stageRef, setCursor]);

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      if (isRightDraggingRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      isRightDraggingRef.current = true;
      lastPosRef.current = { x: clientX, y: clientY };
      setCursor('grabbing');

      const handleWindowMouseMove = (ev: MouseEvent) => {
        if (!isRightDraggingRef.current) return;
        const s = stageRef.current;
        if (!s || !lastPosRef.current) return;

        const dx = ev.clientX - lastPosRef.current.x;
        const dy = ev.clientY - lastPosRef.current.y;

        s.x(s.x() + dx);
        s.y(s.y() + dy);
        lastPosRef.current = { x: ev.clientX, y: ev.clientY };
        s.batchDraw();
      };

      windowMouseMoveRef.current = handleWindowMouseMove;
      window.addEventListener('mousemove', handleWindowMouseMove);
    },
    [stageRef, setCursor],
  );


  useEffect(() => {
    if (!enabled) return;

    const handleWakeUp = (e: MouseEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      if (!stage.container().contains(e.target as Node)) return;
      stage.draw();
    };

    window.addEventListener('mousedown', handleWakeUp, true); // capture
    return () => window.removeEventListener('mousedown', handleWakeUp, true);
  }, [enabled, stageRef]);

  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!enabled || e.evt.button !== 0) return;
      if (isSpacePressedRef?.current) return;

      const isBackground = e.target === e.target.getStage() || e.target.name() === 'bg-rect';
      if (!isBackground) return;

      e.evt.preventDefault();
      startPan(e.evt.clientX, e.evt.clientY);
    },
    [enabled, isSpacePressedRef, startPan],
  );

  const onMouseMove = useCallback((_e: KonvaEventObject<MouseEvent>) => {}, []);

  const onMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!enabled || !isRightDraggingRef.current) return;
      if (e.evt.button !== 0) return;
      e.evt.preventDefault();
      endPan();
    },
    [enabled, endPan],
  );

  useEffect(() => {
    if (!enabled) return;

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
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
