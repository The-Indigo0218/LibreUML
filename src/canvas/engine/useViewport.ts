import { useState, useCallback, useRef, useEffect } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useViewportControlStore } from '../store/viewportControlStore';

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const ZOOM_FACTOR = 1.1;

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export function useViewport() {
  const stageRef = useRef<Konva.Stage>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const register = useViewportControlStore((s) => s.register);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, oldScale * Math.pow(ZOOM_FACTOR, direction)),
    );

    // World-space point under cursor stays fixed
    const pointerWorldX = (pointer.x - stage.x()) / oldScale;
    const pointerWorldY = (pointer.y - stage.y()) / oldScale;

    setViewport({
      scale: newScale,
      x: pointer.x - pointerWorldX * newScale,
      y: pointer.y - pointerWorldY * newScale,
    });
  }, []);

  const handleDragMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setViewport((v) => ({ ...v, x: stage.x(), y: stage.y() }));
  }, []);

  const fitView = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    setViewport((v) => ({
      ...v,
      scale: Math.min(MAX_SCALE, v.scale * ZOOM_FACTOR),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport((v) => ({
      ...v,
      scale: Math.max(MIN_SCALE, v.scale / ZOOM_FACTOR),
    }));
  }, []);

  // Register controls so ViewMenu / useEditorControls can trigger them
  useEffect(() => {
    register({ zoomIn, zoomOut, fitView });
  }, [register, zoomIn, zoomOut, fitView]);

  return {
    stageRef,
    viewport,
    fitView,
    zoomIn,
    zoomOut,
    stageProps: {
      draggable: true,
      onWheel: handleWheel,
      onDragMove: handleDragMove,
      x: viewport.x,
      y: viewport.y,
      scaleX: viewport.scale,
      scaleY: viewport.scale,
    },
  };
}
