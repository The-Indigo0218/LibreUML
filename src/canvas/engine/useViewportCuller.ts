/**
 * useViewportCuller — hides off-screen shapes to improve render performance (MAG-01.13)
 *
 * After pan/zoom stops (100ms debounce), computes the visible world-space
 * rectangle and returns a Set of visible node IDs. Shapes outside the
 * viewport can be set to listening={false} / visible={false}.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Viewport } from './useViewport';
import type { NodeBounds } from '../edges/geometry';

const DEBOUNCE_MS = 100;
// Extra margin around the viewport so nearby nodes don't pop in abruptly
const MARGIN = 200;

export function useViewportCuller(
  viewport: Viewport,
  stageWidth: number,
  stageHeight: number,
  boundsMap: Map<string, NodeBounds>,
): Set<string> {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recalculate = useCallback(() => {
    const { x, y, scale } = viewport;

    // Convert screen bounds to world-space with margin
    const worldLeft   = (-x / scale) - MARGIN;
    const worldTop    = (-y / scale) - MARGIN;
    const worldRight  = (stageWidth  - x) / scale + MARGIN;
    const worldBottom = (stageHeight - y) / scale + MARGIN;

    const next = new Set<string>();
    for (const [id, b] of boundsMap.entries()) {
      if (
        b.x + b.width  >= worldLeft &&
        b.x            <= worldRight &&
        b.y + b.height >= worldTop &&
        b.y            <= worldBottom
      ) {
        next.add(id);
      }
    }
    setVisibleIds(next);
  }, [viewport, stageWidth, stageHeight, boundsMap]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(recalculate, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [recalculate]);

  // On first render with nodes, show all immediately (no flicker)
  useEffect(() => {
    if (boundsMap.size > 0 && visibleIds.size === 0) {
      recalculate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsMap.size]);

  return visibleIds;
}
