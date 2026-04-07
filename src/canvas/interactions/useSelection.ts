/**
 * useSelection — manages node selection for the Konva canvas.
 *
 * Handles:
 *   - Single-click node: select one node (deselects others)
 *   - Ctrl/Meta+click node: toggle that node in/out of selection
 *   - Click on empty stage: clear selection
 *   - Space + right-click drag: draw selection rect → select all intersecting nodes
 *   - Escape key: clear selection
 *
 * Lasso activation:
 *   Lasso ONLY activates on Space + right-click drag (like Windows Desktop).
 *   Right-click alone pans the canvas (handled by useRightClickPan).
 *
 * Lasso ↔ pan conflict:
 *   When lasso starts, we call `stage.draggable(false)` imperatively to suppress
 *   panning. We restore it in `onStageMouseUp`.
 *
 * Click-after-lasso guard:
 *   Konva fires a `click` event after `mouseup` even when no drag happened.
 *   If a lasso was committed (meaningful area), `lassoCommitted` ref prevents
 *   the subsequent `onStageClick` from clearing the just-set selection.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useSelectionStore } from '../../store/selection.store';
import type { NodeBounds } from '../edges/geometry';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LassoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseSelectionOptions {
  stageRef: RefObject<Konva.Stage | null>;
  /**
   * Ref to the current bounds map (read at event time, not at render time).
   * Using a ref here instead of a direct Map lets callers update the bounds
   * after calling useSelection without creating a circular hook dependency.
   */
  boundsMapRef: RefObject<Map<string, NodeBounds>>;
  /**
   * Whether Space key is currently pressed (for Space + right-click lasso).
   */
  isSpacePressed: boolean;
}

export interface UseSelectionReturn {
  selectedIds: Set<string>;
  lassoRect: LassoRect | null;
  onNodeClick: (id: string, ctrl: boolean) => void;
  /** Replaces the entire selection with the given IDs. Used by Ctrl+A. */
  selectAll: (ids: string[]) => void;
  stageHandlers: {
    onMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
    onClick: (e: KonvaEventObject<MouseEvent>) => void;
  };
}

/** Normalize two drag corners into a positive-size rect. */
function normalizeRect(x1: number, y1: number, x2: number, y2: number): LassoRect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** AABB intersection — returns true if the two rects overlap. */
function rectsIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Minimum lasso size (world-space px) before the drag is treated as a lasso. */
const LASSO_THRESHOLD = 4;

export function useSelection({ stageRef, boundsMapRef, isSpacePressed }: UseSelectionOptions): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lassoRect, setLassoRect] = useState<LassoRect | null>(null);

  const { setSelectedNodes, clear } = useSelectionStore();

  // Lasso drag state in refs — immune to stale closures across event handlers.
  const isLassoing = useRef(false);
  const lassoStart = useRef<{ x: number; y: number } | null>(null);
  // Prevents onStageClick from clearing selection right after a lasso commit.
  const lassoCommitted = useRef(false);

  // ── Sync selectedIds → SelectionStore ──────────────────────────────────
  useEffect(() => {
    setSelectedNodes([...selectedIds]);
  }, [selectedIds, setSelectedNodes]);

  // ── Escape key ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        clear();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clear]);

  // ── Node click (single / Ctrl+click) ───────────────────────────────────
  const onNodeClick = useCallback((id: string, ctrl: boolean) => {
    setSelectedIds((prev) => {
      if (ctrl) {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      return new Set([id]);
    });
  }, []);

  // ── Select all (Ctrl+A) ─────────────────────────────────────────────────
  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  // ── Stage: lasso start (Space + right-click only) ──────────────────────
  const onStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      // Only start lasso on Space + right-click (button 2)
      if (!isSpacePressed || e.evt.button !== 2) return;

      // Only start lasso when clicking the stage background, grid, or edges —
      // not on node shapes (which live on the "nodes" layer).
      const targetLayer = e.target.getLayer();
      if (targetLayer && targetLayer.name() === 'nodes') return;

      e.evt.preventDefault(); // Prevent context menu

      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      isLassoing.current = true;
      lassoCommitted.current = false;
      lassoStart.current = { x: pos.x, y: pos.y };
    },
    [stageRef, isSpacePressed],
  );

  // ── Stage: lasso update ─────────────────────────────────────────────────
  const onStageMouseMove = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      if (!isLassoing.current || !lassoStart.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      setLassoRect(normalizeRect(lassoStart.current.x, lassoStart.current.y, pos.x, pos.y));
    },
    [stageRef],
  );

  // ── Stage: lasso commit ─────────────────────────────────────────────────
  const onStageMouseUp = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      if (!isLassoing.current) return;

      const stage = stageRef.current;

      if (stage && lassoStart.current) {
        const pos = stage.getRelativePointerPosition();
        if (pos) {
          const rect = normalizeRect(lassoStart.current.x, lassoStart.current.y, pos.x, pos.y);

          if (rect.width > LASSO_THRESHOLD || rect.height > LASSO_THRESHOLD) {
            const enclosed: string[] = [];
            // Read boundsMapRef.current at event time — always up-to-date
            // regardless of when this callback was created.
            for (const [id, bounds] of boundsMapRef.current.entries()) {
              if (
                rectsIntersect(
                  rect.x, rect.y, rect.width, rect.height,
                  bounds.x, bounds.y, bounds.width, bounds.height,
                )
              ) {
                enclosed.push(id);
              }
            }
            setSelectedIds(new Set(enclosed));
            lassoCommitted.current = true;
          }
        }

      }

      isLassoing.current = false;
      lassoStart.current = null;
      setLassoRect(null);
    },
    [stageRef, boundsMapRef],
  );

  // ── Stage: click on empty area → clear selection ────────────────────────
  const onStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Swallow the click event that follows a committed lasso drag.
      if (lassoCommitted.current) {
        lassoCommitted.current = false;
        return;
      }
      const stage = stageRef.current;
      if (e.target === (stage as unknown)) {
        setSelectedIds(new Set());
        clear();
      }
    },
    [stageRef, clear],
  );

  return {
    selectedIds,
    lassoRect,
    onNodeClick,
    selectAll,
    stageHandlers: {
      onMouseDown: onStageMouseDown,
      onMouseMove: onStageMouseMove,
      onMouseUp: onStageMouseUp,
      onClick: onStageClick,
    },
  };
}
