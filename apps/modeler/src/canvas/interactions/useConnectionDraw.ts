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

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { NodeBounds } from '../edges/geometry';
import { lockedHandleAt } from '../edges/geometry';
import type { AnyNodeViewModel } from '../../adapters/view-models/node.view-model';
import {
  isNoteViewModel,
  isPackageViewModel,
  isActorViewModel,
  isUseCaseViewModel,
  isSystemBoundaryViewModel,
  isDomainEntityViewModel,
  isLifelineViewModel,
  type NodeViewModel,
} from '../../adapters/view-models/node.view-model';
import { validateConnection } from '../../util/connectionValidator';
import type { stereotype, UmlRelationType } from '../../features/diagram/types/diagram.types';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';
import { useToastStore } from '../../store/toast.store';
import { useWorkspaceStore } from '../../store/workspace.store';

/** Cursor must be within this radius (world px) of an anchor to activate connection mode. */
const ANCHOR_DETECT_R = 16;
/** Cursor must be within this radius (world px) of an anchor to snap during drag. */
const ANCHOR_SNAP_R = 24;
/**
 * Tighter radius: dropping within this distance of a connection point LOCKS the
 * endpoint to it (fixed, draw.io green). Between this and ANCHOR_SNAP_R the edge
 * still connects to the node but FLOATS (P1 default) — so the perimeter stays
 * mostly floating and the 8 points are a deliberate opt-in.
 */
const FIXED_SNAP_R = 9;
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
  INCLUDE:        'INCLUDE',
  EXTEND:         'EXTEND',
  PACKAGE_IMPORT: 'PACKAGE_IMPORT',
  PACKAGE_MERGE:  'PACKAGE_MERGE',
  PACKAGE_ACCESS: 'PACKAGE_ACCESS',
};

/** Relation types offered for class-diagram connections (picker + validity). */
const CLASS_RELATION_TYPES: UmlRelationType[] = [
  'association', 'inheritance', 'implementation', 'dependency', 'aggregation', 'composition',
];

const USE_CASE_STEREOTYPES = new Set<stereotype>(['actor', 'use_case', 'system_boundary']);
const DOMAIN_MODEL_STEREOTYPES = new Set<stereotype>(['domain_entity']);
export const SEQUENCE_STEREOTYPES = new Set<stereotype>(['lifeline']);

/**
 * Node kinds for which a self-loop (src === tgt) is a meaningful UI gesture.
 * Self-message in sequence diagrams renders as a U-loop on the lifeline.
 */
export function nodeAllowsSelfLoop(vm: AnyNodeViewModel | undefined): boolean {
  if (!vm) return false;
  return isLifelineViewModel(vm);
}

export function resolveStereotype(vm: AnyNodeViewModel): stereotype {
  if (isNoteViewModel(vm)) return 'note';
  if (isPackageViewModel(vm)) return 'package';
  if (isActorViewModel(vm)) return 'actor';
  if (isUseCaseViewModel(vm)) return 'use_case';
  if (isSystemBoundaryViewModel(vm)) return 'system_boundary';
  // TODO: route through a ShapeRouter
  if (isDomainEntityViewModel(vm)) return 'domain_entity';
  if (isLifelineViewModel(vm)) return 'lifeline';
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

/** An anchor dot plus its distance to the probe point. */
type SnappedDot = AnchorDot & { dist: number };

/** Returns the nearest anchor within `radius` (with its distance), optionally excluding a node. */
function findNearest(
  pos: { x: number; y: number },
  boundsMap: Map<string, NodeBounds>,
  radius: number,
  excludeNodeId?: string,
): SnappedDot | null {
  let best: SnappedDot | null = null;
  for (const [nodeId, bounds] of boundsMap.entries()) {
    if (nodeId === excludeNodeId) continue;
    for (const dot of getAnchorDots(nodeId, bounds)) {
      const d = Math.hypot(pos.x - dot.x, pos.y - dot.y);
      if (d <= radius && (!best || d < best.dist)) {
        best = { nodeId, x: dot.x, y: dot.y, dist: d };
      }
    }
  }
  return best;
}

/** Persisted anchoring for a completed connection. */
export interface DropAnchoring {
  sourceHandle?: string;
  targetHandle?: string;
  anchorLocked?: boolean;
}

/**
 * Decides the anchoring of a completed connection (model A / draw.io):
 *  - `fixed` (the user dropped within FIXED_SNAP_R of a target point) → lock
 *    BOTH endpoints to their nearest of the 8 handles.
 *  - otherwise → floating: no handles, edge slides along both borders (P1).
 * All-or-nothing keeps the model simple; mixed fixed/floating ends are future work.
 */
export function computeDropAnchoring(
  fixed: boolean,
  source: { bounds: NodeBounds; x: number; y: number },
  target: { bounds: NodeBounds; x: number; y: number },
): DropAnchoring {
  if (!fixed) return {};
  return {
    sourceHandle: lockedHandleAt(source.bounds, source.x, source.y),
    targetHandle: lockedHandleAt(target.bounds, target.x, target.y),
    anchorLocked: true,
  };
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
  /**
   * Called when a valid connection is completed (sourceNodeId → targetNodeId).
   * `anchoring` carries the locked handles when the user dropped on a precise
   * connection point; empty (floating) otherwise.
   */
  onConnect: (sourceNodeId: string, targetNodeId: string, anchoring?: DropAnchoring) => void;
  /**
   * Called (class diagram only) when the active connection mode is NOT valid for
   * the dropped pair but other relation types are — opens a picker at the given
   * world position so the user chooses a valid type instead of being rejected.
   */
  onPickRelation?: (
    sourceNodeId: string,
    targetNodeId: string,
    validTypes: UmlRelationType[],
    worldPos: { x: number; y: number },
  ) => void;
  /**
   * Quick Linker: called when the drag is released on empty canvas (no snap
   * target and no node under the cursor). The handler opens a node-type picker at
   * `worldPos` to create a new node already linked to `sourceNodeId`.
   */
  onDropEmpty?: (sourceNodeId: string, worldPos: { x: number; y: number }) => void;
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
  /**
   * True when the current snap is within FIXED_SNAP_R — i.e. releasing now would
   * LOCK the endpoint to this point (green). False = floating drop (blue).
   */
  snapFixed: boolean;
  /**
   * Validity of the current snap target for the active relation mode:
   * true = valid, false = invalid, null = neutral (no snap, or a delegated
   * diagram type whose validity is decided downstream).
   */
  snapValid: boolean | null;
  /**
   * Strong highlight: while connecting, validity of every candidate target
   * (nodeId → true/false/null) vs the source + active mode. Null when not
   * connecting. Consumers dim the `false` entries to make legal targets stand out.
   */
  candidateValidity: Map<string, boolean | null> | null;
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
  onPickRelation,
  onDropEmpty,
}: UseConnectionDrawOptions): UseConnectionDrawReturn {
  // ── React state (triggers re-renders for visual feedback) ──────────────────
  const [isConnecting, setIsConnecting] = useState(false);
  const [tempLine, setTempLine] = useState<TempLine | null>(null);
  const [hoveredNodeAnchors, setHoveredNodeAnchors] = useState<AnchorDot[]>([]);
  const [snapTargetDot, setSnapTargetDot] = useState<AnchorDot | null>(null);
  const [snapFixed, setSnapFixed] = useState(false);
  const [snapValid, setSnapValid] = useState<boolean | null>(null);
  /** Source node id while connecting — drives the candidate-validity highlight. */
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

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
    setSnapFixed(false);
    setSnapValid(null);
    setConnectingSourceId(null);
    setHoveredNodeAnchors([]);
    const stage = stageRef.current;
    if (stage) stage.draggable(true);
  }, [stageRef]);

  // ── Validity helpers ───────────────────────────────────────────────────────

  /** Active relation type (UmlRelationType) derived from the palette connection mode. */
  const getActiveUmlType = useCallback((): UmlRelationType => {
    const rawMode = useWorkspaceStore.getState().connectionModes?.[activeTabId ?? ''] as string | undefined;
    const kind = TOOL_TO_RELATION_KIND[rawMode ?? ''] ?? 'ASSOCIATION';
    return RELATION_TO_UML[kind] ?? 'association';
  }, [activeTabId]);

  /**
   * Validity of a (source → target) pair for the active mode.
   * Returns null (neutral) for note/package/usecase/domain/sequence pairs whose
   * creation is delegated downstream; a boolean for the class-diagram path.
   */
  const computeSnapValidity = useCallback(
    (srcNodeId: string, tgtNodeId: string): boolean | null => {
      const srcNode = nodes.find((n) => n.id === srcNodeId);
      const tgtNode = nodes.find((n) => n.id === tgtNodeId);
      if (!srcNode || !tgtNode) return null;
      const s = resolveStereotype(srcNode.data);
      const t = resolveStereotype(tgtNode.data);
      if (s === 'note' || t === 'note') return null;
      if (s === 'package' && t === 'package') return null;
      if (USE_CASE_STEREOTYPES.has(s) || USE_CASE_STEREOTYPES.has(t)) return null;
      if (DOMAIN_MODEL_STEREOTYPES.has(s) || DOMAIN_MODEL_STEREOTYPES.has(t)) return null;
      if (SEQUENCE_STEREOTYPES.has(s) || SEQUENCE_STEREOTYPES.has(t)) return null;
      return validateConnection(s, t, getActiveUmlType());
    },
    [nodes, getActiveUmlType],
  );

  /**
   * Per-node validity of every potential target against the connection source +
   * active relation mode (strong highlight). Null while not connecting. A node
   * maps to: true = legal target, false = illegal (dimmed), null = neutral
   * (delegated diagram type with no validation rules — left untouched). The source
   * node is omitted. Computed once per drag (keyed on the source), not per move.
   */
  const candidateValidity = useMemo<Map<string, boolean | null> | null>(() => {
    if (!connectingSourceId) return null;
    const map = new Map<string, boolean | null>();
    for (const n of nodes) {
      if (n.id === connectingSourceId) continue;
      map.set(n.id, computeSnapValidity(connectingSourceId, n.id));
    }
    return map;
  }, [connectingSourceId, nodes, computeSnapValidity]);

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

        const srcVM = nodes.find((n) => n.id === src.nodeId)?.data;
        const excludeNodeId = nodeAllowsSelfLoop(srcVM) ? undefined : src.nodeId;
        const snap = findNearest(pos, boundsMapRef.current, ANCHOR_SNAP_R, excludeNodeId);
        // Within the tight radius → releasing now locks the endpoint (green).
        const fixed = !!snap && snap.dist <= FIXED_SNAP_R;
        // Snap the temp line only when locking; floating drops follow the cursor
        // so the user sees they are NOT committing to a fixed point.
        const endX = fixed ? snap!.x : pos.x;
        const endY = fixed ? snap!.y : pos.y;

        setTempLine({ x1: src.x, y1: src.y, x2: endX, y2: endY });
        setSnapTargetDot(fixed ? snap : null);
        setSnapFixed(fixed);
        setSnapValid(snap ? computeSnapValidity(src.nodeId, snap.nodeId) : null);

        // Show the hovered target node's 8 connection points (draw.io Xs) so the
        // user can aim at one. Only updates when the hovered node changes.
        const tgtId = findHoveredNode(pos, boundsMapRef.current);
        const overlayId = tgtId && tgtId !== excludeNodeId ? tgtId : null;
        if (overlayId !== hoverNodeIdRef.current) {
          hoverNodeIdRef.current = overlayId;
          const b = overlayId ? boundsMapRef.current.get(overlayId) : undefined;
          setHoveredNodeAnchors(b ? getAnchorDots(overlayId!, b) : []);
        }
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
    [stageRef, boundsMapRef, nodes, computeSnapValidity],
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
      setConnectingSourceId(nearest.nodeId);
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
          const srcVM = nodes.find((n) => n.id === src.nodeId)?.data;
          const excludeNodeId = nodeAllowsSelfLoop(srcVM) ? undefined : src.nodeId;
          const snap = findNearest(pos, boundsMapRef.current, ANCHOR_SNAP_R, excludeNodeId);
          if (snap) {
            // Lock to the dropped point only within the tight radius; otherwise
            // float (P1). Resolved once and threaded through every onConnect path.
            const fixed = snap.dist <= FIXED_SNAP_R;
            const srcBounds = boundsMapRef.current.get(src.nodeId);
            const tgtBounds = boundsMapRef.current.get(snap.nodeId);
            const anchoring: DropAnchoring =
              srcBounds && tgtBounds
                ? computeDropAnchoring(
                    fixed,
                    { bounds: srcBounds, x: src.x, y: src.y },
                    { bounds: tgtBounds, x: snap.x, y: snap.y },
                  )
                : {};

            // ── Validate via connectionValidator.ts ───────────────────────
            const srcNode = nodes.find((n) => n.id === src.nodeId);
            const tgtNode = nodes.find((n) => n.id === snap.nodeId);

            if (srcNode && tgtNode) {
              const srcStereotype = resolveStereotype(srcNode.data);
              const tgtStereotype = resolveStereotype(tgtNode.data);

              // Package→package: always allowed. Kind is forced to DEPENDENCY in the handler.
              // Use case / domain / sequence diagram nodes: delegate entirely to onConnect.
              if (srcStereotype === 'package' && tgtStereotype === 'package') {
                onConnect(src.nodeId, snap.nodeId, anchoring);
              } else if (USE_CASE_STEREOTYPES.has(srcStereotype) || USE_CASE_STEREOTYPES.has(tgtStereotype)) {
                onConnect(src.nodeId, snap.nodeId, anchoring);
              } else if (DOMAIN_MODEL_STEREOTYPES.has(srcStereotype) || DOMAIN_MODEL_STEREOTYPES.has(tgtStereotype)) {
                onConnect(src.nodeId, snap.nodeId, anchoring);
              } else if (SEQUENCE_STEREOTYPES.has(srcStereotype) || SEQUENCE_STEREOTYPES.has(tgtStereotype)) {
                onConnect(src.nodeId, snap.nodeId, anchoring);
              } else {
                const wsState = useWorkspaceStore.getState();
                const rawMode = wsState.connectionModes?.[activeTabId ?? ''] as string | undefined;
                const kind: RelationKind = TOOL_TO_RELATION_KIND[rawMode ?? ''] ?? 'ASSOCIATION';
                const umlType = RELATION_TO_UML[kind] ?? 'association';

                if (validateConnection(srcStereotype, tgtStereotype, umlType)) {
                  onConnect(src.nodeId, snap.nodeId, anchoring);
                } else {
                  // Instead of rejecting, offer the valid relation types.
                  const validTypes = CLASS_RELATION_TYPES.filter((ut) =>
                    validateConnection(srcStereotype, tgtStereotype, ut),
                  );
                  if (validTypes.length > 0 && onPickRelation) {
                    onPickRelation(src.nodeId, snap.nodeId, validTypes, { x: snap.x, y: snap.y });
                  } else {
                    useToastStore.getState().show('⚠️ Relación inválida según estereotipos UML');
                  }
                }
              }
            } else {
              // Fallback: let onConnect handle validation if nodes not found.
              onConnect(src.nodeId, snap.nodeId, anchoring);
            }
          } else if (onDropEmpty && !findHoveredNode(pos, boundsMapRef.current)) {
            // Quick Linker: released on empty canvas (no snap, no node under
            // the cursor) → offer to create a new node linked to the source.
            onDropEmpty(src.nodeId, { x: pos.x, y: pos.y });
          }
        }
      }

      resetState();
    },
    [stageRef, boundsMapRef, nodes, activeTabId, onConnect, onPickRelation, onDropEmpty, resetState],
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
    snapFixed,
    snapValid,
    candidateValidity,
    stageHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
    },
  };
}
