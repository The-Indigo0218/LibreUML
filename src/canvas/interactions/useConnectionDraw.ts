/**
 * useConnectionDraw — connection creation by dragging from node anchor points.
 *
 * Interaction flow:
 *   1. User hovers near a node → 8 anchor dots become visible for that node.
 *   2. User mousedowns near an anchor → enters "connecting" mode.
 *      - nearAnchorRef.current is set to true during hover, allowing KonvaCanvas
 *        to wrap onDragStart and call e.target.stopDrag() — preventing node drag.
 *   3. User drags → a dashed temp line follows the cursor from the source anchor.
 *   4. User hovers near another node's anchor → snap indicator shown.
 *   5. User mouseups:
 *      - Near a target anchor → validate via connectionValidator, call onConnect if valid.
 *      - On empty space or invalid → discard (toast shown for invalid stereotypes).
 *
 * Anchor system:
 *   8 points per node: 4 cardinal midpoints (T, B, L, R) + 4 corners (TL, TR, BL, BR).
 *   ANCHOR_DETECT_R  = 16 px — activates nearAnchorRef when cursor is within this radius.
 *   ANCHOR_SNAP_R    = 24 px — snaps to target anchor during drag.
 *   NODE_HOVER_PAD   = 20 px — shows anchor dots when cursor is within this padding of node bounds.
 *
 * Drag suppression:
 *   nearAnchorRef is exposed to KonvaCanvas. KonvaCanvas wraps each shape's onDragStart:
 *     if (nearAnchorRef.current) { e.target.stopDrag(); return; }
 *   This prevents native Konva drag from starting when a connection draw begins.
 *
 * Window mouseup fallback:
 *   A window-level mouseup listener clears connection state if the user releases
 *   the mouse outside the canvas (e.g., drags off-screen). Same pattern as
 *   useDragHandler's window mouseup guard (MAG-01.5 fix).
 *
 * Validation:
 *   Calls connectionValidator.ts before invoking onConnect. If invalid (e.g., class
 *   inheriting from interface), shows a toast and discards without creating the edge.
 *   onConnect (useCanvasEventHandlers) also runs its own checks (self-loop, bidir agg).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { NodeBounds } from '../edges/geometry';
import type { AnyNodeViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { isNoteViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import type { NodeViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { isPackageViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { validateConnection } from '../../util/connectionValidator';
import type { stereotype, UmlRelationType } from '../../features/diagram/types/diagram.types';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';
import { useToastStore } from '../../store/toast.store';
import { useWorkspaceStore } from '../../store/workspace.store';

/** Cursor must be within this radius (world px) of an anchor to activate connection mode. */
const ANCHOR_DETECT_R = 16;
/** Cursor must be within this radius (world px) of an anchor to snap during drag. */
const ANCHOR_SNAP_R = 24;
/** Cursor must be within this padding (world px) of a node's bounding box to show anchors. */
const NODE_HOVER_PAD = 20;

const RELATION_TO_UML: Partial<Record<RelationKind, UmlRelationType>> = {
  ASSOCIATION:    'association',
  GENERALIZATION: 'inheritance',
  REALIZATION:    'implementation',
  DEPENDENCY:     'dependency',
  AGGREGATION:    'aggregation',
  COMPOSITION:    'composition',
};

const TOOL_TO_RELATION_KIND: Record<string, RelationKind> = {
  ASSOCIATION:    'ASSOCIATION',
  INHERITANCE:    'GENERALIZATION',
  IMPLEMENTATION: 'REALIZATION',
  DEPENDENCY:     'DEPENDENCY',
  AGGREGATION:    'AGGREGATION',
  COMPOSITION:    'COMPOSITION',
  GENERALIZATION: 'GENERALIZATION',
  PACKAGE_IMPORT: 'PACKAGE_IMPORT',
  PACKAGE_MERGE:  'PACKAGE_MERGE',
  PACKAGE_ACCESS: 'PACKAGE_ACCESS',
};

function resolveStereotype(vm: AnyNodeViewModel): stereotype {
  if (isNoteViewModel(vm)) return 'note';
  if (isPackageViewModel(vm)) return 'package';
  const nvm = vm as NodeViewModel;
  const s = nvm.stereotype;
  if (s === 'abstract' || s === 'interface' || s === 'enum') return s;
  return 'class';
}

export interface AnchorDot {
  nodeId: string;
  x: number;
  y: number;
}

/** 8-point anchor system: 4 cardinal midpoints + 4 corners. */
function getAnchorDots(nodeId: string, b: NodeBounds): AnchorDot[] {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return [
    { nodeId, x: cx,            y: b.y            }, // top
    { nodeId, x: cx,            y: b.y + b.height }, // bottom
    { nodeId, x: b.x,           y: cy             }, // left
    { nodeId, x: b.x + b.width, y: cy             }, // right
    { nodeId, x: b.x,           y: b.y            }, // top-left
    { nodeId, x: b.x + b.width, y: b.y            }, // top-right
    { nodeId, x: b.x,           y: b.y + b.height }, // bottom-left
    { nodeId, x: b.x + b.width, y: b.y + b.height }, // bottom-right
  ];
}

/** Returns the nearest anchor within `radius`, optionally excluding a node. */
function findNearest(
  pos: { x: number; y: number },
  boundsMap: Map<string, NodeBounds>,
  radius: number,
  excludeNodeId?: string,
): AnchorDot | null {
  let best: (AnchorDot & { dist: number }) | null = null;
  for (const [nodeId, bounds] of boundsMap.entries()) {
    if (nodeId === excludeNodeId) continue;
    for (const dot of getAnchorDots(nodeId, bounds)) {
      const d = Math.hypot(pos.x - dot.x, pos.y - dot.y);
      if (d <= radius && (!best || d < best.dist)) {
        best = { ...dot, dist: d };
      }
    }
  }
  return best ? { nodeId: best.nodeId, x: best.x, y: best.y } : null;
}

/** Returns the node ID whose bounds (with padding) contain pos, or null. */
function findHoveredNode(
  pos: { x: number; y: number },
  boundsMap: Map<string, NodeBounds>,
): string | null {
  for (const [nodeId, bounds] of boundsMap.entries()) {
    if (
      pos.x >= bounds.x - NODE_HOVER_PAD &&
      pos.x <= bounds.x + bounds.width + NODE_HOVER_PAD &&
      pos.y >= bounds.y - NODE_HOVER_PAD &&
      pos.y <= bounds.y + bounds.height + NODE_HOVER_PAD
    ) {
      return nodeId;
    }
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TempLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Minimal node descriptor needed for validation. */
export interface ConnectionNode {
  id: string;
  data: AnyNodeViewModel;
}

export interface UseConnectionDrawOptions {
  stageRef: RefObject<Konva.Stage | null>;
  boundsMapRef: RefObject<Map<string, NodeBounds>>;
  /** Nodes array — used to look up stereotypes for UML validation. */
  nodes: ConnectionNode[];
  /** Active tab ID — used to read current connection mode from WorkspaceStore. */
  activeTabId: string | null;
  /** Called when a valid connection is completed (sourceNodeId → targetNodeId). */
  onConnect: (sourceNodeId: string, targetNodeId: string) => void;
}

export interface UseConnectionDrawReturn {
  /** True while the user is dragging a connection. */
  isConnecting: boolean;
  /** True (as ref) when cursor is near any anchor. Used by KonvaCanvas to suppress node drag. */
  nearAnchorRef: RefObject<boolean>;
  /** Ref to isConnecting — stable, no stale closure issues. */
  isConnectingRef: RefObject<boolean>;
  /** Temporary line from source anchor to cursor position. Null when not connecting. */
  tempLine: TempLine | null;
  /** Anchor dots for the currently hovered node (show 8 dots when hovering a node). */
  hoveredNodeAnchors: AnchorDot[];
  /** The anchor being snapped to as connection target. */
  snapTargetDot: AnchorDot | null;
  stageHandlers: {
    onMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConnectionDraw({
  stageRef,
  boundsMapRef,
  nodes,
  activeTabId,
  onConnect,
}: UseConnectionDrawOptions): UseConnectionDrawReturn {
  // ── React state (triggers re-renders for visual feedback) ──────────────────
  const [isConnecting, setIsConnecting] = useState(false);
  const [tempLine, setTempLine] = useState<TempLine | null>(null);
  const [hoveredNodeAnchors, setHoveredNodeAnchors] = useState<AnchorDot[]>([]);
  const [snapTargetDot, setSnapTargetDot] = useState<AnchorDot | null>(null);

  // ── Refs (event-handler safe, no stale closure issues) ────────────────────
  const isConnectingRef = useRef(false);
  /** True when cursor is near any anchor — read by KonvaCanvas to suppress drag. */
  const nearAnchorRef = useRef(false);
  /** Source anchor that the connection draw started from. */
  const sourceRef = useRef<AnchorDot | null>(null);
  /** Tracks which node is currently hovered to avoid unnecessary state thrashing. */
  const hoverNodeIdRef = useRef<string | null>(null);

  // ── Reset helper ──────────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    isConnectingRef.current = false;
    nearAnchorRef.current = false;
    sourceRef.current = null;
    hoverNodeIdRef.current = null;
    setIsConnecting(false);
    setTempLine(null);
    setSnapTargetDot(null);
    setHoveredNodeAnchors([]);
    const stage = stageRef.current;
    if (stage) stage.draggable(true);
  }, [stageRef]);

  // ── onMouseMove ────────────────────────────────────────────────────────────

  const onMouseMove = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      if (isConnectingRef.current) {
        // ── Drawing mode: update temp line + find snap target ─────────────
        const src = sourceRef.current;
        if (!src) return;

        const snap = findNearest(pos, boundsMapRef.current, ANCHOR_SNAP_R, src.nodeId);
        const endX = snap ? snap.x : pos.x;
        const endY = snap ? snap.y : pos.y;

        setTempLine({ x1: src.x, y1: src.y, x2: endX, y2: endY });
        setSnapTargetDot(snap);
      } else {
        // ── Hover mode: update nearAnchorRef + visible anchor dots ────────
        const near = findNearest(pos, boundsMapRef.current, ANCHOR_DETECT_R);
        nearAnchorRef.current = !!near;

        // Only update hovered-node anchors when the hovered node changes.
        const hoveredId = findHoveredNode(pos, boundsMapRef.current);
        if (hoveredId !== hoverNodeIdRef.current) {
          hoverNodeIdRef.current = hoveredId;
          if (hoveredId) {
            const b = boundsMapRef.current.get(hoveredId);
            setHoveredNodeAnchors(b ? getAnchorDots(hoveredId, b) : []);
          } else {
            setHoveredNodeAnchors([]);
          }
        }
      }
    },
    [stageRef, boundsMapRef],
  );

  // ── onMouseDown ────────────────────────────────────────────────────────────

  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Only start a connection if the cursor was near an anchor when pressed.
      if (!nearAnchorRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      const nearest = findNearest(pos, boundsMapRef.current, ANCHOR_DETECT_R);
      if (!nearest) {
        nearAnchorRef.current = false;
        return;
      }

      // ── Start connection draw ──────────────────────────────────────────
      sourceRef.current = nearest;
      isConnectingRef.current = true;
      setIsConnecting(true);
      setTempLine({ x1: nearest.x, y1: nearest.y, x2: nearest.x, y2: nearest.y });
      setHoveredNodeAnchors([]);
      setSnapTargetDot(null);

      // Suppress canvas pan during connection draw.
      stage.draggable(false);
      // Prevent the lasso handler from starting a lasso selection.
      e.cancelBubble = true;
    },
    [stageRef, boundsMapRef],
  );

  // ── onMouseUp ─────────────────────────────────────────────────────────────

  const onMouseUp = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      if (!isConnectingRef.current) return;

      const stage = stageRef.current;
      const src = sourceRef.current;

      if (stage && src) {
        const pos = stage.getRelativePointerPosition();
        if (pos) {
          const snap = findNearest(pos, boundsMapRef.current, ANCHOR_SNAP_R, src.nodeId);
          if (snap) {
            // ── Validate via connectionValidator.ts ───────────────────────
            const srcNode = nodes.find((n) => n.id === src.nodeId);
            const tgtNode = nodes.find((n) => n.id === snap.nodeId);

            if (srcNode && tgtNode) {
              const srcStereotype = resolveStereotype(srcNode.data);
              const tgtStereotype = resolveStereotype(tgtNode.data);

              // Determine current connection kind from WorkspaceStore.
              const wsState = useWorkspaceStore.getState();
              const rawMode = wsState.connectionModes?.[activeTabId ?? ''] as string | undefined;
              const kind: RelationKind = TOOL_TO_RELATION_KIND[rawMode ?? ''] ?? 'ASSOCIATION';
              const umlType = RELATION_TO_UML[kind] ?? 'association';

              if (!validateConnection(srcStereotype, tgtStereotype, umlType)) {
                useToastStore.getState().show(
                  '⚠️ Relación inválida según estereotipos UML',
                );
              } else {
                onConnect(src.nodeId, snap.nodeId);
              }
            } else {
              // Fallback: let onConnect handle validation if nodes not found.
              onConnect(src.nodeId, snap.nodeId);
            }
          }
        }
      }

      resetState();
    },
    [stageRef, boundsMapRef, nodes, activeTabId, onConnect, resetState],
  );

  // ── Window mouseup fallback ────────────────────────────────────────────────
  // Fires when the user releases the mouse outside the canvas (dragged off-screen).
  // Without this, the connection draw would stay active indefinitely.
  //
  // Pattern: the window listener fires for ALL mouseup events. If the stage's
  // onMouseUp already ran (user released inside canvas), isConnectingRef.current
  // is already false, so this is a no-op. If the user released outside, the stage
  // onMouseUp never fires, so this cleans up.
  //
  // This same pattern should be applied to useDragHandler for the "dragEnd outside
  // canvas" bug from MAG-01.5 (isDragging.current gets stuck when mouse leaves canvas).
  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (!isConnectingRef.current) return;
      resetState();
    };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [resetState]);

  return {
    isConnecting,
    isConnectingRef,
    nearAnchorRef,
    tempLine,
    hoveredNodeAnchors,
    snapTargetDot,
    stageHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
    },
  };
}
