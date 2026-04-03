import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useViewportControlStore } from '../store/viewportControlStore';

const MAX_SCALE = 5;
const ZOOM_FACTOR = 1.1;
const BOUNDS_MARGIN = 200; // Padding around content bounds
const DEFAULT_MIN_SCALE = 0.1; // Fallback when no content

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportConstraints {
  minScale: number;
  maxScale: number;
  bounds: ViewportBounds;
}

export interface UseViewportOptions {
  /** Content bounds for constraining viewport (optional) */
  contentBounds?: ViewportBounds | null;
  /** Stage dimensions for calculating min scale */
  stageWidth?: number;
  stageHeight?: number;
}

export function useViewport(options: UseViewportOptions = {}) {
  const { contentBounds, stageWidth = 0, stageHeight = 0 } = options;
  const stageRef = useRef<Konva.Stage>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const register = useViewportControlStore((s) => s.register);

  // Calculate dynamic constraints based on content bounds (MAG-01.21)
  const constraints = useMemo((): ViewportConstraints => {
    // No content or stage not ready → use defaults
    if (!contentBounds || stageWidth === 0 || stageHeight === 0) {
      return {
        minScale: DEFAULT_MIN_SCALE,
        maxScale: MAX_SCALE,
        bounds: { x: -10000, y: -10000, width: 20000, height: 20000 },
      };
    }

    // Calculate MIN_SCALE to fit all content in viewport
    const scaleX = stageWidth / contentBounds.width;
    const scaleY = stageHeight / contentBounds.height;
    const minScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1:1

    // Expand bounds with margin
    const bounds: ViewportBounds = {
      x: contentBounds.x - BOUNDS_MARGIN,
      y: contentBounds.y - BOUNDS_MARGIN,
      width: contentBounds.width + BOUNDS_MARGIN * 2,
      height: contentBounds.height + BOUNDS_MARGIN * 2,
    };

    return { minScale, maxScale: MAX_SCALE, bounds };
  }, [contentBounds, stageWidth, stageHeight]);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY < 0 ? 1 : -1;
    
    // Clamp zoom to dynamic constraints (MAG-01.21)
    const newScale = Math.max(
      constraints.minScale,
      Math.min(constraints.maxScale, oldScale * Math.pow(ZOOM_FACTOR, direction)),
    );

    // World-space point under cursor stays fixed
    const pointerWorldX = (pointer.x - stage.x()) / oldScale;
    const pointerWorldY = (pointer.y - stage.y()) / oldScale;

    let newX = pointer.x - pointerWorldX * newScale;
    let newY = pointer.y - pointerWorldY * newScale;

    // Constrain pan to bounds (MAG-01.21)
    const { bounds } = constraints;
    const maxX = 0;
    const maxY = 0;
    const minX = -(bounds.width * newScale - stage.width());
    const minY = -(bounds.height * newScale - stage.height());

    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));

    setViewport({
      scale: newScale,
      x: newX,
      y: newY,
    });
  }, [constraints]);

  const handleDragMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setViewport((v) => ({ ...v, x: stage.x(), y: stage.y() }));
  }, []);

  const handleDragEnd = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Constrain pan to bounds after drag (MAG-01.21)
    const { bounds } = constraints;
    const scale = stage.scaleX();
    const maxX = 0;
    const maxY = 0;
    const minX = -(bounds.width * scale - stage.width());
    const minY = -(bounds.height * scale - stage.height());

    let newX = stage.x();
    let newY = stage.y();

    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));

    // Only update if position changed (avoid unnecessary re-render)
    if (newX !== stage.x() || newY !== stage.y()) {
      setViewport((v) => ({ ...v, x: newX, y: newY }));
    }
  }, [constraints]);

  const fitView = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    setViewport((v) => ({
      ...v,
      scale: Math.min(constraints.maxScale, v.scale * ZOOM_FACTOR),
    }));
  }, [constraints.maxScale]);

  const zoomOut = useCallback(() => {
    setViewport((v) => ({
      ...v,
      scale: Math.max(constraints.minScale, v.scale / ZOOM_FACTOR),
    }));
  }, [constraints.minScale]);

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
    constraints, // Expose for debugging/testing
    stageProps: {
      draggable: true,
      onWheel: handleWheel,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      x: viewport.x,
      y: viewport.y,
      scaleX: viewport.scale,
      scaleY: viewport.scale,
    },
  };
}
