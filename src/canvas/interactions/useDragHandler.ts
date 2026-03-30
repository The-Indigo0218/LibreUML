/**
 * useDragHandler — manages node dragging on the Konva canvas.
 *
 * Strategy:
 *   - Primary dragged node: uses Konva's native `draggable` (zero React re-renders
 *     during move; Konva redraws the layer each animation frame automatically).
 *   - Secondary nodes (multi-drag): moved imperatively via `stage.findOne` +
 *     `node.x/y()` inside a rAF-throttled callback. The layer redraw triggered
 *     by the primary drag picks up these imperative position changes for free.
 *   - Grid snap: applied to all dragged nodes on `dragEnd` via `Math.round(v/20)*20`.
 *   - Stage pan suppression: `stage.draggable(false)` on dragStart, restored on dragEnd.
 *   - Ghost shapes: React state array of start-position snapshots (set once on dragStart,
 *     cleared on dragEnd). KonvaCanvas renders these at opacity 0.3 on the Interaction layer.
 *   - Position persistence: `positionOverrides` (React state Map) is updated ONLY on
 *     dragEnd (one re-render per drag). During drag, zero React state updates occur.
 *   - Real-time edge routing: `dragPositions` (React state Map | null) is updated via a
 *     50 ms debounce in onDragMove. This triggers ~20 fps React re-renders so edges
 *     re-route during drag without re-rendering every pointer event.
 *
 * Known limitation (MAG-01.5):
 *   Positions are visual-only. They are not written to VFSStore until MAG-01.9.
 *   `positionOverrides` resets when the component unmounts.
 *
 * Multi-drag behaviour:
 *   - If the dragged node IS in selectedIds → all selected nodes drag together.
 *   - If the dragged node is NOT in selectedIds → only that node drags (no selection change).
 */

import { useState, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { AnyNodeViewModel } from '../../adapters/react-flow/view-models/node.view-model';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Ghost shape rendered on the Interaction layer during drag (at start position). */
export interface DragGhostNode {
  id: string;
  x: number;
  y: number;
  data: AnyNodeViewModel;
}

/** Minimal node descriptor the hook needs — compatible with useVFSCanvasController output. */
export interface CanvasNode {
  id: string;
  position: { x: number; y: number };
  data: AnyNodeViewModel;
}

interface UseDragHandlerOptions {
  stageRef: RefObject<Konva.Stage | null>;
  selectedIds: Set<string>;
  nodes: CanvasNode[];
}

export interface UseDragHandlerReturn {
  /**
   * Positions overridden by drag. Empty until the first drag completes.
   * KonvaCanvas merges this with `node.position` to get the rendered position:
   *   `positionOverrides.get(id) ?? node.position`
   */
  positionOverrides: Map<string, { x: number; y: number }>;
  /**
   * Live positions of dragged nodes, updated ~20 fps via 50 ms debounce.
   * Non-null only while a drag is in progress.
   * Use for real-time edge re-routing:
   *   `dragPositions?.get(id) ?? positionOverrides.get(id) ?? node.position`
   */
  dragPositions: Map<string, { x: number; y: number }> | null;
  /** Non-empty while a drag is in progress — render these as ghost shapes. */
  ghostNodes: DragGhostNode[];
  dragHandlers: {
    onDragStart: (e: KonvaEventObject<MouseEvent>) => void;
    onDragMove: (e: KonvaEventObject<MouseEvent>) => void;
    onDragEnd: (e: KonvaEventObject<MouseEvent>) => void;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snapToGrid(v: number): number {
  return Math.round(v / GRID) * GRID;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDragHandler({
  stageRef,
  selectedIds,
  nodes,
}: UseDragHandlerOptions): UseDragHandlerReturn {
  // Updated only on dragEnd (one re-render per drag, zero during drag).
  const [positionOverrides, setPositionOverrides] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  // Updated every 50 ms during drag for real-time edge re-routing.
  // null when not dragging so downstream memos can gate on it cheaply.
  const [dragPositions, setDragPositions] = useState<
    Map<string, { x: number; y: number }> | null
  >(null);

  // Set once on dragStart, cleared on dragEnd (two re-renders per drag).
  const [ghostNodes, setGhostNodes] = useState<DragGhostNode[]>([]);

  // ── Drag state — all in refs so event handlers never go stale ────────────

  const isDragging = useRef(false);
  const primaryId = useRef<string | null>(null);
  /** IDs of every node moving this drag (primary + all other selected if applicable). */
  const draggingIds = useRef<string[]>([]);
  /** World-space position of each dragging node at the moment drag started. */
  const startPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  // rAF throttle for secondary-node imperative moves
  const rafId = useRef<number | null>(null);
  const latestDelta = useRef<{ dx: number; dy: number } | null>(null);

  // 50 ms debounce for dragPositions state update (edge re-routing)
  const edgeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── dragStart ─────────────────────────────────────────────────────────────

  const onDragStart = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Stop the event from reaching the Stage so it doesn't pan.
      e.cancelBubble = true;

      const stage = stageRef.current;
      if (!stage) return;

      const id = e.target.id();
      if (!id) return;

      // Suppress stage pan while dragging a node.
      stage.draggable(false);

      // Determine drag group: if the node is part of the selection → move all
      // selected nodes together; otherwise, just move this one node.
      const ids: string[] = selectedIds.has(id) ? [...selectedIds] : [id];
      draggingIds.current = ids;
      primaryId.current = id;
      isDragging.current = true;

      // Record start position for each dragging node (overrides take priority).
      const startMap = new Map<string, { x: number; y: number }>();
      for (const nodeId of ids) {
        const override = positionOverrides.get(nodeId);
        const original = nodes.find((n) => n.id === nodeId)?.position ?? { x: 0, y: 0 };
        startMap.set(nodeId, override ?? original);
      }
      startPositions.current = startMap;

      // Build ghost nodes (render at start positions, opacity 0.3).
      const ghosts: DragGhostNode[] = [];
      for (const node of nodes) {
        if (!ids.includes(node.id)) continue;
        const pos = startMap.get(node.id)!;
        ghosts.push({ id: node.id, x: pos.x, y: pos.y, data: node.data });
      }
      setGhostNodes(ghosts);
    },
    // selectedIds and nodes are captured at render time — correct for a drag
    // that begins during this render cycle.
    [stageRef, selectedIds, positionOverrides, nodes],
  );

  // ── dragMove ──────────────────────────────────────────────────────────────

  const onDragMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!isDragging.current || !primaryId.current) return;

      const pId = primaryId.current;
      const pStart = startPositions.current.get(pId);
      if (!pStart) return;

      // Delta of the primary node relative to its drag-start position.
      // Konva updates e.target.x/y() natively each frame — no React state needed.
      const dx = e.target.x() - pStart.x;
      const dy = e.target.y() - pStart.y;
      latestDelta.current = { dx, dy };

      // Throttle secondary-node moves to one imperative update per rAF frame.
      // The primary node's drag already triggers a layer batchDraw each frame,
      // so these imperative position changes are picked up at no extra cost.
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const delta = latestDelta.current;
        if (!delta) return;

        const stage = stageRef.current;
        if (!stage) return;

        for (const nodeId of draggingIds.current) {
          if (nodeId === primaryId.current) continue;
          const start = startPositions.current.get(nodeId);
          if (!start) continue;
          const konvaNode = stage.findOne<Konva.Node>((n: Konva.Node) => n.id() === nodeId);
          if (!konvaNode) continue;
          konvaNode.x(start.x + delta.dx);
          konvaNode.y(start.y + delta.dy);
        }
      });

      // ── Debounced edge re-routing (50 ms) ──────────────────────────────
      // Reset on every dragMove so we coalesce rapid events into a single
      // React state update that fires 50 ms after the last pointer event.
      if (edgeDebounceTimer.current !== null) clearTimeout(edgeDebounceTimer.current);
      edgeDebounceTimer.current = setTimeout(() => {
        edgeDebounceTimer.current = null;
        const delta = latestDelta.current;
        if (!delta || !isDragging.current) return;

        // Build live position map for all dragging nodes using start + delta.
        const positions = new Map<string, { x: number; y: number }>();
        for (const nodeId of draggingIds.current) {
          const start = startPositions.current.get(nodeId);
          if (!start) continue;
          positions.set(nodeId, { x: start.x + delta.dx, y: start.y + delta.dy });
        }
        setDragPositions(positions);
      }, 50);
    },
    [stageRef],
  );

  // ── dragEnd ───────────────────────────────────────────────────────────────

  const onDragEnd = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!isDragging.current) return;

      // Cancel any in-flight rAF — the final position is read directly below.
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      // Cancel pending debounced edge update (dragEnd handles the final state).
      if (edgeDebounceTimer.current !== null) {
        clearTimeout(edgeDebounceTimer.current);
        edgeDebounceTimer.current = null;
      }
      latestDelta.current = null;

      const stage = stageRef.current;
      if (!stage) return;

      // Re-enable stage pan.
      stage.draggable(true);

      // Read final positions, snap to grid, write back imperatively + to React state.
      const updates = new Map<string, { x: number; y: number }>();

      for (const nodeId of draggingIds.current) {
        let rawX: number, rawY: number;

        if (nodeId === primaryId.current) {
          rawX = e.target.x();
          rawY = e.target.y();
        } else {
          const konvaNode = stage.findOne<Konva.Node>((n: Konva.Node) => n.id() === nodeId);
          if (!konvaNode) continue;
          rawX = konvaNode.x();
          rawY = konvaNode.y();
        }

        const snapped = { x: snapToGrid(rawX), y: snapToGrid(rawY) };
        updates.set(nodeId, snapped);

        // Apply snap to Konva node so the canvas reflects the final position
        // before React re-renders with the new positionOverrides.
        if (nodeId === primaryId.current) {
          e.target.x(snapped.x);
          e.target.y(snapped.y);
        } else {
          const konvaNode = stage.findOne<Konva.Node>((n: Konva.Node) => n.id() === nodeId);
          if (konvaNode) {
            konvaNode.x(snapped.x);
            konvaNode.y(snapped.y);
          }
        }
      }

      // One React state update → one re-render to reconcile snapped positions.
      setPositionOverrides((prev) => {
        const next = new Map(prev);
        for (const [id, pos] of updates) next.set(id, pos);
        return next;
      });

      // Clear ghost shapes and live drag positions (React 18 batches both updates).
      setGhostNodes([]);
      setDragPositions(null);

      // Reset drag state.
      isDragging.current = false;
      primaryId.current = null;
      draggingIds.current = [];
      startPositions.current = new Map();
    },
    [stageRef],
  );

  return {
    positionOverrides,
    dragPositions,
    ghostNodes,
    dragHandlers: { onDragStart, onDragMove, onDragEnd },
  };
}
