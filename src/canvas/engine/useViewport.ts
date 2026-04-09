/**
 * useViewport — Uncontrolled Stage viewport manager
 *
 * Architecture:
 *   Konva is the source of truth for stage x, y, scaleX, scaleY.
 *   The React `viewport` state is a READ-ONLY observer — it is updated AFTER
 *   imperative Konva changes so that React consumers (GridPattern, inline editor
 *   position effect) can re-render with the latest values.
 *
 *   The Stage is NEVER given x/y/scaleX/scaleY as controlled props.
 *   This eliminates the entire class of snap-back bugs caused by React re-renders
 *   re-applying stale viewport state on top of imperative Konva position changes.
 *
 * Consumers of `viewport`:
 *   - GridPattern: uses x, y, scale to compute visible grid bounds
 *   - KonvaCanvas inline edp0: { contentBounds: { x: number; y: number; width: number; height: number; } | null; stageWidth: number; stageHeight: number; }itor useEffect: uses viewport as a dep to reposition the editor overlay
 *   - useViewportCuller (unused): would use viewport for frustum culling
 */

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

  const constraints = useMemo((): ViewportConstraints => {
    // No content or stage not ready → use defaults
    if (!contentBounds || stageWidth === 0 || stageHeight === 0) {
      return {
        minScale: DEFAULT_MIN_SCALE,
        maxScale: MAX_SCALE,
        bounds: { x: -10000, y: -10000, width: 20000, height: 20000 },
      };
    }

    const scaleX = stageWidth / contentBounds.width;
    const scaleY = stageHeight / contentBounds.height;
    const minScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1:1

    const bounds: ViewportBounds = {
      x: contentBounds.x - BOUNDS_MARGIN,
      y: contentBounds.y - BOUNDS_MARGIN,
      width: contentBounds.width + BOUNDS_MARGIN * 2,
      height: contentBounds.height + BOUNDS_MARGIN * 2,
    };

    return { minScale, maxScale: MAX_SCALE, bounds };
  }, [contentBounds, stageWidth, stageHeight]);

  /**
   * Wheel zoom — imperatively updates the Konva stage, then syncs React state.
   * Zoom is anchored to the pointer position (world-space point under cursor stays fixed).
   */
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY < 0 ? 1 : -1;

    const newScale = Math.max(
      constraints.minScale,
      Math.min(constraints.maxScale, oldScale * Math.pow(ZOOM_FACTOR, direction)),
    );

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

    // Imperatively update Konva — this is the source of truth.
    stage.scaleX(newScale);
    stage.scaleY(newScale);
    stage.x(newX);
    stage.y(newY);
    stage.batchDraw();

    // Sync React state so GridPattern and other observers re-render.
    setViewport({ scale: newScale, x: newX, y: newY });
  }, [constraints]);

  /**
   * Sync an imperative pan position into React state.
   * Called on pan-end by useRightClickPan so the grid and inline editor
   * update to reflect the final position.  Does NOT move the Stage.
   */
  const commitPanPosition = useCallback((pos: { x: number; y: number }) => {
    setViewport((v) => ({ ...v, x: pos.x, y: pos.y }));
  }, []);

  const fitView = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.x(0);
      stage.y(0);
      stage.scaleX(1);
      stage.scaleY(1);
      stage.batchDraw();
    }
    setViewport({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const newScale = Math.min(constraints.maxScale, stage.scaleX() * ZOOM_FACTOR);
    stage.scaleX(newScale);
    stage.scaleY(newScale);
    stage.batchDraw();
    setViewport((v) => ({ ...v, scale: newScale }));
  }, [constraints.maxScale]);

  const zoomOut = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const newScale = Math.max(constraints.minScale, stage.scaleX() / ZOOM_FACTOR);
    stage.scaleX(newScale);
    stage.scaleY(newScale);
    stage.batchDraw();
    setViewport((v) => ({ ...v, scale: newScale }));
  }, [constraints.minScale]);

  // Register controls so ViewMenu / useEditorControls can trigger them
  useEffect(() => {
    register({ zoomIn, zoomOut, fitView });
  }, [register, zoomIn, zoomOut, fitView]);

  return {
    stageRef,
    viewport,
    onWheel: handleWheel,
    commitPanPosition,
    fitView,
    zoomIn,
    zoomOut,
    constraints, // Expose for debugging/testing
  };
}
