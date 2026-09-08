/**
 * KonvaEdge — react-konva component for UML relation edges.
 *
 * Routing modes
 * ─────────────
 *   'orthogonal' (fallback) Three-segment L-shaped path with obstacle avoidance.
 *                           Applied when routingMode is undefined so pre-existing
 *                           diagrams keep their original look; new edges are
 *                           created with an explicit 'straight' mode instead.
 *   'straight'              Direct two-point line; bends only at user waypoints.
 *   'curved'                Smooth cubic Bezier using outward control points.
 *
 * Self-loops (isSelfLoop = true)
 * ──────────────────────────────
 *   Overrides routingMode. Renders a cubic Bezier that exits the right face and
 *   re-enters the top face of the node, curving through the upper-right quadrant.
 *
 * Rendering pipeline (non-self-loop)
 * ───────────────────────────────────
 *   1. selectAnchors()   — closest-pair anchor selection.
 *   2. retractAnchor()   — pull target anchor back so line body meets marker base.
 *   3. route()           — compute flat points array according to routingMode.
 *   4. <Line>            — draw path (solid or dashed).
 *   5. <EdgeMarker>×2    — endpoint glyphs. The target shows the kind's fixed
 *                          marker (triangle / diamond / directional arrow); an
 *                          association-family end otherwise reflects per-end
 *                          navigability (arrow / ✕ / nothing). See markers.ts.
 *
 * Marker retraction (px)
 * ──────────────────────
 *   GENERALIZATION / REALIZATION → 16   (hollow triangle, 16 px deep)
 *   AGGREGATION / COMPOSITION    → 24   (diamond, 24 px deep)
 *   All others                   →  0   (open chevron — tip touches the node)
 *
 * renderMode
 * ──────────
 *   'lines'  — renders Line + EdgeMarker only (used in "edges" layer, below nodes).
 *   'labels' — renders text labels + kind badge only (used in "edge-labels" layer, above nodes).
 *   'full'   — renders everything (default, backward-compatible).
 */

import { useMemo, useState, useRef } from 'react';
import { Group, Line, Text, Label, Tag, Circle, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { formatActivityFlowLabel } from './activityFlowLabel';
import type { RelationKind, NodeBorderStyle } from '../../core/domain/vfs/vfs.types';
import { borderDash } from '../shapes/borderStyle';
import {
  selectAnchors,
  resolveLockedAnchors,
  retractAnchor,
  edgeIntersection,
  directionToAngle,
  arrivalAngle,
  curvedRoute,
  straightRoute,
  polylineRoute,
  orthogonalPolylineRoute,
  resolveRoutingMode,
  anchorFromRatio,
  selfLoopPath,
  computeLabelPositions,
  LABEL_ALONG,
  ROLE_STACK,
  type NodeBounds,
  type NodeShape,
  type LockedHandle,
  type AnchorPoint,
  type AnchorFace,
  type Point,
  type LabelPositions,
} from './geometry';
import { avoidObstacles } from './obstacleAvoidance';
import EdgeMarker from './EdgeMarker';
import { resolveEndMarker, markerRetract } from './markers';

const DASHED_KINDS = new Set<RelationKind>([
  'REALIZATION', 'DEPENDENCY', 'USAGE', 'INCLUDE', 'EXTEND',
  'PACKAGE_IMPORT', 'PACKAGE_MERGE', 'PACKAGE_ACCESS', 'EXCEPTION_HANDLER',
]);

// Maps RelationKind to CSS variable name (matches v1 useVFSEdgeStyling)
const KIND_COLOR_VAR: Partial<Record<RelationKind, string>> = {
  GENERALIZATION: '--edge-inheritance',
  REALIZATION:    '--edge-implementation',
  DEPENDENCY:     '--edge-dependency',
  USAGE:          '--edge-dependency',
  ASSOCIATION:    '--edge-association',
  AGGREGATION:    '--edge-aggregation',
  COMPOSITION:    '--edge-composition',
  INCLUDE:        '--edge-dependency',
  EXTEND:         '--edge-dependency',
  PACKAGE_IMPORT: '--edge-dependency',
  PACKAGE_MERGE:  '--edge-dependency',
  PACKAGE_ACCESS: '--edge-dependency',
  EXCEPTION_HANDLER: '--edge-dependency',
};

function getEdgeColor(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--edge-base').trim() || '#64748b'
  );
}

function getEdgeColorByKind(kind: RelationKind): string {
  const varName = KIND_COLOR_VAR[kind];
  if (!varName) return getEdgeColor();
  return (
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || getEdgeColor()
  );
}

function getLabelTextColor(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8'
  );
}

function getLabelBg(): string {
  const base = getComputedStyle(document.documentElement).getPropertyValue('--canvas-base').trim();
  const isDark = /^#[0-2]/.test(base);
  return isDark ? 'rgba(10,16,36,0.84)' : 'rgba(248,250,252,0.92)';
}

function formatKindLabel(kind: RelationKind): string {
  return kind
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getStereotypeLabel(kind: RelationKind): string | null {
  switch (kind) {
    case 'INCLUDE':
      return '«include»';
    case 'EXTEND':
      return '«extend»';
    case 'PACKAGE_IMPORT':
      return '«import»';
    case 'PACKAGE_MERGE':
      return '«merge»';
    case 'PACKAGE_ACCESS':
      return '«access»';
    case 'EXCEPTION_HANDLER':
      return '«handler»';
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────

export type RoutingMode = 'orthogonal' | 'curved' | 'straight';
export type RenderMode  = 'full' | 'lines' | 'labels';

export interface KonvaEdgeProps {
  /** Unique edge ID */
  id: string;
  kind: RelationKind;
  sourceBounds: NodeBounds;
  targetBounds: NodeBounds;
  /** When true, source and target are the same node — renders a self-loop. */
  isSelfLoop?: boolean;
  /**
   * How to route the line body. Falls back to 'orthogonal' when undefined so
   * legacy edges keep their look; freshly drawn edges pass an explicit 'straight'.
   * Ignored when isSelfLoop is true (always uses bezier for self-loops).
   */
  routingMode?: RoutingMode;
  /** Per-edge color override. Wins over the kind/base color when set. */
  colorOverride?: string;
  /** Per-edge line width override. Undefined = default (2px). */
  lineWidthOverride?: number;
  /** Per-edge line style override. Undefined = kind default (solid/dashed). */
  lineStyleOverride?: NodeBorderStyle;
  /** Per-edge label font family override. Undefined = Konva default. */
  fontFamilyOverride?: string;
  /** Per-edge label font size override (px). Undefined = default (11px). */
  fontSizeOverride?: number;
  /**
   * Bounding boxes of nodes that the edge should route around.
   * Must exclude the source and target nodes themselves.
   * Only used for routingMode='orthogonal' (obstacle avoidance).
   */
  obstacles?: NodeBounds[];
  /** Label data (MAG-01.28) */
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  sourceRole?: string;
  targetRole?: string;
  /**
   * UML navigability of each association end (from IRAssociationEnd.isNavigable).
   *   true  → open arrow (navigable) · false → ✕ (not navigable) · undefined → nothing.
   * Only association-family kinds honour these; ignored elsewhere.
   */
  sourceNavigable?: boolean;
  targetNavigable?: boolean;
  /** Highlight state (MAG-01.23) — edge is highlighted (show kind color + 3px stroke) */
  isHighlighted?: boolean;
  /** Hover state (MAG-01.24) — edge is hovered (show kind color + badge tooltip) */
  isHovered?: boolean;
  /** Dim state (MAG-01.24) — edge is dimmed when another edge/node is active */
  isDimmed?: boolean;
  /** Viewport culling — set false to hide off-screen edges (MAG-01.16). */
  visible?: boolean;
  /**
   * Controls which elements are drawn.
   *  'full'   — line + marker + labels (default)
   *  'lines'  — line + marker only (used in the "edges" layer, below nodes)
   *  'labels' — labels only (used in the "edge-labels" layer, above nodes)
   */
  renderMode?: RenderMode;
  /** Context menu handler (MAG-01.12) */
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, edgeId: string) => void;
  /** Mouse enter handler for tooltip (MAG-01.12) */
  onMouseEnter?: (e: KonvaEventObject<MouseEvent>, edgeId: string) => void;
  /** Mouse leave handler for tooltip (MAG-01.12) */
  onMouseLeave?: (e: KonvaEventObject<MouseEvent>, edgeId: string) => void;
  /** Double-click handler — used for «extend» props modal */
  onDblClick?: (edgeId: string) => void;
  /** Center label — verb for domain model associations */
  label?: string;
  /** «extend» guard condition — rendered below the stereotype label */
  condition?: string;
  /** CONTROL_FLOW/OBJECT_FLOW guard, e.g. 'balance > 0' — rendered as `[guard]` (A2). */
  guard?: string;
  /** CONTROL_FLOW/OBJECT_FLOW weight, e.g. '5' or '*' — rendered as `{weight}` (A2). */
  weight?: string;
  /**
   * CONTROL_FLOW/OBJECT_FLOW only (v1.1): the interrupting edge of an
   * INTERRUPTIBLE_REGION — dashes the line and prefixes the flow label
   * with `↯`, same conformance cut as a real zigzag stroke.
   */
  isInterrupting?: boolean;
  /** Locked anchor mode — when true, use stored handles instead of closest-pair selection */
  anchorLocked?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
  /**
   * P4 — free continuous border anchor (nx, ny ∈ [0,1] relative to bounds).
   * When present, overrides the resolved endpoint for that side (priority over
   * locked handle / floating). Resolved per-endpoint → enables mixed ends.
   */
  sourceAnchor?: { nx: number; ny: number };
  targetAnchor?: { nx: number; ny: number };
  /**
   * Floating anchors. When true (and not locked / no waypoints), endpoints
   * slide along each node's border toward the opposing node instead of snapping
   * to one of the 8 fixed handles — radial/diagonal entry, recalculated as nodes
   * move. Default routing for UseCase diagrams. Ignored for self-loops.
   */
  floating?: boolean;
  /** Outline of the source node for floating intersection ('rect' default, 'ellipse' for UseCase ovals). */
  sourceShape?: NodeShape;
  /** Outline of the target node for floating intersection. */
  targetShape?: NodeShape;
  /**
   * Manual user waypoints. When non-empty, the line body is routed as a
   * polyline through these points instead of the automatic routing, letting the
   * user bend the edge. Anchors at both ends are still resolved normally.
   * Ignored for self-loops.
   */
  waypoints?: Point[];
  /** True when this edge is the selected one — shows waypoint editing handles. */
  selected?: boolean;
  /** Click handler used to select the edge. */
  onSelect?: (edgeId: string) => void;
  /** Persists a new waypoints array after a handle drag / insert / delete. */
  onWaypointsChange?: (edgeId: string, waypoints: Point[]) => void;
  /**
   * Endpoint drag (P3): fired when the user releases a source/target endpoint
   * handle. `dropWorld` is the released position; `otherEnd` is the current
   * pixel position of the non-dragged endpoint (so the canvas can re-anchor the
   * other end without recomputing geometry). The canvas decides re-link vs
   * re-anchor vs revert.
   */
  onEndpointDrop?: (
    edgeId: string,
    end: 'source' | 'target',
    dropWorld: Point,
    otherEnd: Point,
  ) => void;
}

export default function KonvaEdge({
  id,
  kind,
  sourceBounds,
  targetBounds,
  isSelfLoop = false,
  routingMode,
  colorOverride,
  lineWidthOverride,
  lineStyleOverride,
  fontFamilyOverride,
  fontSizeOverride,
  obstacles,
  sourceMultiplicity,
  targetMultiplicity,
  sourceRole,
  targetRole,
  sourceNavigable,
  targetNavigable,
  isHighlighted = false,
  isHovered = false,
  isDimmed = false,
  visible = true,
  renderMode = 'full',
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onDblClick,
  label,
  condition,
  guard,
  weight,
  isInterrupting,
  anchorLocked = false,
  sourceHandle,
  targetHandle,
  sourceAnchor,
  targetAnchor,
  floating = false,
  sourceShape = 'rect',
  targetShape = 'rect',
  waypoints,
  selected = false,
  onSelect,
  onWaypointsChange,
  onEndpointDrop,
}: KonvaEdgeProps) {
  // Local draft of waypoints during an in-progress handle drag. Null =
  // use the props value. Lets the line follow the handle live without touching
  // the store until the drag ends.
  const [draftWaypoints, setDraftWaypoints] = useState<Point[] | null>(null);
  // Index of the segment-midpoint ("ghost") handle currently being dragged to
  // insert a new bend, or null. Needed so that ghost is rendered at the live
  // dragged position (avoids react-konva snapping it back each frame).
  const [draggingGhost, setDraggingGhost] = useState<number | null>(null);
  // Orthogonal segment-slide drag. The snapshot (interior route points,
  // grabbed segment, orientation) is captured at drag start in a ref so dragMove
  // rebuilds waypoints from a stable base; segLive holds the raw pointer so the
  // dragged bar renders under the cursor without react-konva snapping it back.
  const segDragRef = useRef<{ interior: Point[]; a: number; orient: 'h' | 'v' } | null>(null);
  // Live pointer + which interior segment is active (a) — state so render reflects
  // the drag without reading the ref during render.
  const [segLive, setSegLive] = useState<{ x: number; y: number; a: number } | null>(null);
  // Endpoint drag (P3): which end + live pointer, so a dashed preview follows the
  // cursor from the opposite (fixed) endpoint until release.
  const [draftEndpoint, setDraftEndpoint] = useState<{ end: 'source' | 'target'; x: number; y: number } | null>(null);
  // Effective routing once the legacy fallback is applied (undefined → orthogonal).
  const routing = resolveRoutingMode(routingMode);
  // When active (highlighted or hovered): use kind-specific color; else base gray.
  // Per-edge style overrides win over both when present.
  const isActive = isHighlighted || isHovered;
  const stroke = colorOverride ?? (isActive ? getEdgeColorByKind(kind) : getEdgeColor());
  const strokeWidth = lineWidthOverride ?? (isActive ? 3 : 2);
  const dashed = DASHED_KINDS.has(kind) || !!isInterrupting;
  // Effective dash: an explicit line-style override wins; else the kind default.
  const dashArray = lineStyleOverride
    ? borderDash(lineStyleOverride, strokeWidth)
    : (dashed ? [6, 4] : undefined);
  const retract = markerRetract(kind);
  const stereotypeLabel = getStereotypeLabel(kind);

  // Endpoint glyphs (UML navigability). A fixed semantic marker (triangle /
  // diamond / directional arrow) wins; association-family ends otherwise reflect
  // per-end navigability (arrow / ✕ / nothing). Source markers never render on
  // self-loops (both ends share a node).
  const sourceMarker = isSelfLoop ? null : resolveEndMarker(kind, 'source', sourceNavigable);
  const targetMarker = resolveEndMarker(kind, 'target', targetNavigable);

  const showLines  = renderMode !== 'labels';
  const showLabels = renderMode !== 'lines';

  // Waypoints actually rendered: the live draft (during a drag) or the persisted props.
  const effectiveWaypoints = draftWaypoints ?? waypoints;

  const { markerX, markerY, markerFace, markerAngle, points, bezier, labelPositions, srcX, srcY, srcFace, srcMarkerAngle } = useMemo(() => {
    // ── Self-loop ──────────────────────────────────────────────────────────
    if (isSelfLoop) {
      const loop = selfLoopPath(sourceBounds, retract);

      const srcX = sourceBounds.x + sourceBounds.width + 20;
      const srcY = sourceBounds.y;
      const tgtX = sourceBounds.x + sourceBounds.width + 20;
      const tgtY = sourceBounds.y + 30;

      return {
        points: loop.points,
        bezier: true,
        markerX: loop.markerX,
        markerY: loop.markerY,
        markerFace: loop.markerFace,
        markerAngle: undefined as number | undefined,
        srcX,
        srcY,
        // Self-loops never draw a source marker; placeholder face/angle.
        srcFace: 'Right' as AnchorFace,
        srcMarkerAngle: undefined as number | undefined,
        labelPositions: {
          sourceMultX: srcX + 6,
          sourceMultY: srcY - 14,
          sourceRoleX: srcX + 6,
          sourceRoleY: srcY - 14 + ROLE_STACK,
          targetMultX: tgtX + 6,
          targetMultY: tgtY - 14,
          targetRoleX: tgtX + 6,
          targetRoleY: tgtY - 14 + ROLE_STACK,
          centerX: sourceBounds.x + sourceBounds.width + 15,
          centerY: sourceBounds.y - 20,
        } satisfies LabelPositions,
      };
    }

    // ── Normal edge ────────────────────────────────────────────────────────
    const hasWaypoints = !!effectiveWaypoints && effectiveWaypoints.length > 0;
    // Floating wins over fixed handles unless the edge is explicitly locked.
    const useFloating = floating && !(anchorLocked && sourceHandle && targetHandle);

    let src: AnchorPoint;
    let tgt: AnchorPoint;
    let retractedTgt: Point;
    let markerAngle: number | undefined;
    // Rotation for a source-end navigability marker (tip points into the source
    // node). Mirrors markerAngle; undefined → fall back to faceToMarkerAngle(src.face).
    let srcMarkerAngle: number | undefined;

    if (useFloating) {
      // Anchors slide along each border toward the opposing node (or the nearest
      // waypoint when bent). Recalculated on every move → radial entry.
      const srcCenter = { x: sourceBounds.x + sourceBounds.width / 2, y: sourceBounds.y + sourceBounds.height / 2 };
      const tgtCenter = { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height / 2 };
      const srcAim = hasWaypoints ? effectiveWaypoints![0] : tgtCenter;
      const tgtAim = hasWaypoints ? effectiveWaypoints![effectiveWaypoints!.length - 1] : srcCenter;
      src = edgeIntersection(sourceBounds, srcCenter, srcAim, sourceShape);
      tgt = edgeIntersection(targetBounds, tgtCenter, tgtAim, targetShape);
      // Arrival direction = from the last route point toward the target anchor.
      let dx = tgt.x - tgtAim.x;
      let dy = tgt.y - tgtAim.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      markerAngle = directionToAngle(dx, dy);
      // Source marker points into the source node along the first segment.
      let sdx = src.x - srcAim.x;
      let sdy = src.y - srcAim.y;
      const slen = Math.hypot(sdx, sdy) || 1;
      sdx /= slen; sdy /= slen;
      srcMarkerAngle = directionToAngle(sdx, sdy);
      retractedTgt = retract > 0 ? { x: tgt.x - dx * retract, y: tgt.y - dy * retract } : tgt;
    } else {
      ({ src, tgt } =
        anchorLocked && sourceHandle && targetHandle
          ? resolveLockedAnchors(
              sourceBounds,
              targetBounds,
              sourceHandle as LockedHandle,
              targetHandle as LockedHandle,
            )
          : selectAnchors(sourceBounds, targetBounds));
      retractedTgt = retract > 0 ? retractAnchor(tgt, retract) : tgt;
    }

    // P4 — free border anchors override the resolved endpoint(s), per side. Wins
    // over floating / locked handles. The target side recomputes its retract and
    // falls back to face-based marker rotation (anchorFromRatio assigns a face).
    if (sourceAnchor) {
      src = anchorFromRatio(sourceBounds, sourceAnchor);
    }
    if (targetAnchor) {
      tgt = anchorFromRatio(targetBounds, targetAnchor);
      retractedTgt = retract > 0 ? retractAnchor(tgt, retract) : tgt;
      markerAngle = undefined;
    }

    let pts: number[];
    let isBezier = false;

    if (hasWaypoints) {
      // Manual waypoints. In orthogonal mode they become fixed bend anchors
      // connected by right-angle elbows that recompute as nodes move; in any
      // other mode the body is a straight polyline through the points.
      pts = routing === 'orthogonal' && !useFloating
        ? orthogonalPolylineRoute(src, effectiveWaypoints!, retractedTgt, obstacles ?? [])
        : polylineRoute(src, effectiveWaypoints!, retractedTgt);
    } else if (useFloating) {
      // Floating entry is inherently radial → straight segment, never orthogonal.
      pts = straightRoute(src, retractedTgt);
    } else {
      switch (routing) {
        case 'curved':
          pts = curvedRoute(src, retractedTgt, tgt.face);
          isBezier = true;
          break;

        case 'straight':
          pts = straightRoute(src, retractedTgt);
          break;

        case 'orthogonal':
        default:
          pts = avoidObstacles(src, retractedTgt, obstacles ?? []);
          break;
      }
    }

    // Phase A (edge fixed anchor): align the arrowhead with the real last
    // segment for straight / polyline bodies, where the diagonal arrival would
    // otherwise snap to the target face's cardinal angle and look distorted.
    // Orthogonal (axis-aligned final elbow) and bezier (tangent already equals
    // the face normal) keep the face-based angle, so legacy diagrams are
    // unchanged. Floating already sets markerAngle above.
    if (!useFloating && !isBezier && routing !== 'orthogonal') {
      const lastFrom = hasWaypoints
        ? effectiveWaypoints![effectiveWaypoints!.length - 1]
        : src;
      markerAngle = arrivalAngle(lastFrom, tgt) ?? markerAngle;
      // Symmetric source-side angle: from the first route point back toward src.
      const firstTo = hasWaypoints ? effectiveWaypoints![0] : tgt;
      srcMarkerAngle = arrivalAngle(firstTo, src) ?? srcMarkerAngle;
    }

    // Target labels must clear the marker depth (e.g. 24px diamond for COMPOSITION)
    const targetAlong = Math.max(LABEL_ALONG, retract + 16);

    return {
      points: pts,
      bezier: isBezier,
      markerX: tgt.x,
      markerY: tgt.y,
      markerFace: tgt.face,
      markerAngle,
      srcX: src.x,
      srcY: src.y,
      srcFace: src.face,
      srcMarkerAngle,
      labelPositions: computeLabelPositions(pts, src.x, src.y, tgt.x, tgt.y, targetAlong, isBezier),
    };
  }, [sourceBounds, targetBounds, kind, isSelfLoop, routing, obstacles, retract, anchorLocked, sourceHandle, targetHandle, sourceAnchor, targetAnchor, floating, sourceShape, targetShape, effectiveWaypoints]);

  // ── Waypoint editing handles ───────────────────────────────────────────────
  const showHandles = showLabels && selected && !isSelfLoop && !!onWaypointsChange;
  // Endpoint handles (P3) — drag to re-link or re-anchor. Independent of
  // onWaypointsChange so they appear even for edges without waypoints.
  const showEndpoints = showLabels && selected && !isSelfLoop && !!onEndpointDrop;
  const moveWaypoints = effectiveWaypoints ?? [];
  const persistedWaypoints = waypoints ?? [];
  // Control polyline from PERSISTED waypoints — stable node identity for ghosts
  // so the dragged ghost node is not remounted mid-drag.
  const ghostControl: Point[] = [
    { x: srcX, y: srcY },
    ...persistedWaypoints,
    { x: markerX, y: markerY },
  ];
  const HANDLE_FILL = '#6366f1';
  const HANDLE_STROKE = '#ffffff';
  // Endpoint handles render as a hollow ring to distinguish them from the solid
  // indigo waypoint dots.
  const ENDPOINT_FILL = '#ffffff';

  const commitWaypoints = (next: Point[]) => {
    onWaypointsChange?.(id, next);
    setDraftWaypoints(null);
    setDraggingGhost(null);
  };

  const multStyle      = isHighlighted ? 'bold' : 'normal';
  const roleStyle      = isHighlighted ? 'bold italic' : 'italic';
  // Per-edge label font override: size scales the base 11px (offsets follow);
  // family is undefined → Konva default unless the user picks one.
  const labelScale     = (fontSizeOverride ?? 11) / 11;
  const labelSize      = 11 * labelScale;
  const labelFamily    = fontFamilyOverride;
  const kindLabel      = formatKindLabel(kind);
  const flowLabel      = formatActivityFlowLabel(guard, weight, isInterrupting);
  const labelTextColor = getLabelTextColor();
  const labelBgFill    = getLabelBg();
  const labelBorder    = 'rgba(148,163,184,0.18)';
  const labelPad       = 3;

  return (
    <Group opacity={isDimmed ? 0.15 : 1} visible={visible}>
      {/* ── Line + marker (edges layer) ─────────────────────────────────── */}
      {showLines && (
        <>
          <Line
            id={`edge-line-${id}`}
            points={points}
            bezier={bezier}
            stroke={stroke}
            strokeWidth={strokeWidth}
            dash={dashArray}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={12}
            listening={true}
            perfectDrawEnabled={false}
            onClick={(e) => { e.cancelBubble = true; onSelect?.(id); }}
            onTap={(e) => { e.cancelBubble = true; onSelect?.(id); }}
            onContextMenu={(e) => onContextMenu?.(e, id)}
            onMouseEnter={(e) => onMouseEnter?.(e, id)}
            onMouseLeave={(e) => onMouseLeave?.(e, id)}
            onDblClick={() => onDblClick?.(id)}
          />
          {targetMarker && (
            <EdgeMarker
              shape={targetMarker}
              x={markerX}
              y={markerY}
              face={markerFace}
              stroke={stroke}
              angleOverride={markerAngle}
            />
          )}
          {sourceMarker && (
            <EdgeMarker
              shape={sourceMarker}
              x={srcX}
              y={srcY}
              face={srcFace}
              stroke={stroke}
              angleOverride={srcMarkerAngle}
            />
          )}
        </>
      )}

      {/* ── Labels (edge-labels layer, rendered above nodes) ────────────── */}
      {showLabels && (
        <>
          {/* Kind badge — hover state (tooltip) */}
          {isHovered && (
            <Label
              x={labelPositions.centerX}
              y={labelPositions.centerY - 16}
              offsetX={Math.round(kindLabel.length * 3.6 + 5)}
              offsetY={10}
            >
              <Tag
                fill={labelBgFill}
                stroke={stroke}
                strokeWidth={1}
                cornerRadius={4}
                shadowColor="rgba(0,0,0,0.30)"
                shadowBlur={6}
                shadowOffsetY={2}
              />
              <Text
                text={kindLabel}
                fontSize={12}
                fontStyle="bold"
                fill={stroke}
                padding={4}
                listening={false}
              />
            </Label>
          )}

          {/* Kind badge — highlighted/selected state */}
          {isHighlighted && !isHovered && (
            <Label
              x={labelPositions.centerX}
              y={labelPositions.centerY - 16}
              offsetX={Math.round(kindLabel.length * 3.6 + 5)}
              offsetY={10}
            >
              <Tag
                fill={labelBgFill}
                stroke={stroke}
                strokeWidth={0.75}
                cornerRadius={4}
              />
              <Text
                text={kindLabel}
                fontSize={12}
                fontStyle="bold"
                fill={stroke}
                padding={4}
                listening={false}
              />
            </Label>
          )}

          {/* Source multiplicity */}
          {sourceMultiplicity && (
            <Label
              x={labelPositions.sourceMultX}
              y={labelPositions.sourceMultY}
              offsetX={Math.round(sourceMultiplicity.length * 3.2 * labelScale + labelPad)}
              offsetY={Math.round((labelSize + labelPad * 2) / 2)}
            >
              <Tag
                fill={labelBgFill}
                stroke={labelBorder}
                strokeWidth={0.5}
                cornerRadius={3}
              />
              <Text
                text={sourceMultiplicity}
                fontSize={labelSize}
                fontFamily={labelFamily}
                fontStyle={multStyle}
                fill={labelTextColor}
                padding={labelPad}
                listening={false}
              />
            </Label>
          )}

          {/* Source role */}
          {sourceRole && (
            <Label
              x={labelPositions.sourceRoleX}
              y={labelPositions.sourceRoleY}
              offsetX={Math.round(sourceRole.length * 3.2 * labelScale + labelPad)}
              offsetY={Math.round((labelSize + labelPad * 2) / 2)}
            >
              <Tag
                fill={labelBgFill}
                stroke={labelBorder}
                strokeWidth={0.5}
                cornerRadius={3}
              />
              <Text
                text={sourceRole}
                fontSize={labelSize}
                fontFamily={labelFamily}
                fontStyle={roleStyle}
                fill={labelTextColor}
                padding={labelPad}
                listening={false}
              />
            </Label>
          )}

          {/* Target multiplicity */}
          {targetMultiplicity && (
            <Label
              x={labelPositions.targetMultX}
              y={labelPositions.targetMultY}
              offsetX={Math.round(targetMultiplicity.length * 3.2 * labelScale + labelPad)}
              offsetY={Math.round((labelSize + labelPad * 2) / 2)}
            >
              <Tag
                fill={labelBgFill}
                stroke={labelBorder}
                strokeWidth={0.5}
                cornerRadius={3}
              />
              <Text
                text={targetMultiplicity}
                fontSize={labelSize}
                fontFamily={labelFamily}
                fontStyle={multStyle}
                fill={labelTextColor}
                padding={labelPad}
                listening={false}
              />
            </Label>
          )}

          {/* Target role */}
          {targetRole && (
            <Label
              x={labelPositions.targetRoleX}
              y={labelPositions.targetRoleY}
              offsetX={Math.round(targetRole.length * 3.2 * labelScale + labelPad)}
              offsetY={Math.round((labelSize + labelPad * 2) / 2)}
            >
              <Tag
                fill={labelBgFill}
                stroke={labelBorder}
                strokeWidth={0.5}
                cornerRadius={3}
              />
              <Text
                text={targetRole}
                fontSize={labelSize}
                fontFamily={labelFamily}
                fontStyle={roleStyle}
                fill={labelTextColor}
                padding={labelPad}
                listening={false}
              />
            </Label>
          )}

          {/* Stereotype label (<<import>>, <<merge>>, etc.) */}
          {stereotypeLabel && (
            <Label
              x={labelPositions.centerX}
              y={labelPositions.centerY}
              offsetX={Math.round(stereotypeLabel.length * 3.3 + labelPad)}
              offsetY={Math.round((12 + labelPad * 2) / 2)}
              onDblClick={() => onDblClick?.(id)}
            >
              <Tag
                fill={labelBgFill}
                stroke={labelBorder}
                strokeWidth={0.5}
                cornerRadius={3}
              />
              <Text
                text={stereotypeLabel}
                fontSize={12}
                fontStyle="italic"
                fill={labelTextColor}
                padding={labelPad}
                listening={false}
              />
            </Label>
          )}

          {/* Verb label — domain model associations */}
          {!stereotypeLabel && label && (
            <Label
              x={labelPositions.centerX}
              y={labelPositions.centerY}
              offsetX={Math.round(label.length * 3.3 * labelScale + labelPad)}
              offsetY={Math.round((labelSize + labelPad * 2) / 2)}
              onDblClick={() => onDblClick?.(id)}
            >
              <Tag
                fill={labelBgFill}
                stroke={labelBorder}
                strokeWidth={0.5}
                cornerRadius={3}
              />
              <Text
                text={label}
                fontSize={labelSize}
                fontFamily={labelFamily}
                fontStyle="italic"
                fill={labelTextColor}
                padding={labelPad}
                listening={false}
              />
            </Label>
          )}

          {/* «extend» condition note */}
          {kind === 'EXTEND' && condition && (
            <Label
              x={labelPositions.centerX}
              y={labelPositions.centerY + 20}
              offsetX={Math.round((condition.length + 2) * 3.2 + labelPad)}
              offsetY={Math.round((10 + labelPad * 2) / 2)}
            >
              <Tag
                fill={labelBgFill}
                stroke={labelBorder}
                strokeWidth={0.5}
                cornerRadius={3}
              />
              <Text
                text={`[${condition}]`}
                fontSize={10}
                fontStyle="italic"
                fill={labelTextColor}
                padding={labelPad}
                listening={false}
              />
            </Label>
          )}

          {/* Control/object flow guard + weight (A2, UML 2.5 §15.3) */}
          {(kind === 'CONTROL_FLOW' || kind === 'OBJECT_FLOW') && flowLabel && (
            <Label
              x={labelPositions.centerX}
              y={labelPositions.centerY + 20}
              offsetX={Math.round(flowLabel.length * 3.2 * labelScale + labelPad)}
              offsetY={Math.round((labelSize + labelPad * 2) / 2)}
            >
              <Tag
                fill={labelBgFill}
                stroke={labelBorder}
                strokeWidth={0.5}
                cornerRadius={3}
              />
              <Text
                text={flowLabel}
                fontSize={labelSize}
                fontFamily={labelFamily}
                fontStyle="italic"
                fill={labelTextColor}
                padding={labelPad}
                listening={false}
              />
            </Label>
          )}
        </>
      )}

      {/* ── Waypoint editing handles ──────────────────────────────────── */}
      {showHandles && (
        <>
          {/* Ghost handles at each segment midpoint — drag to insert a bend */}
          {ghostControl.slice(0, -1).map((a, k) => {
            const b = ghostControl[k + 1];
            const live = draggingGhost === k && draftWaypoints ? draftWaypoints[k] : null;
            const hx = live ? live.x : (a.x + b.x) / 2;
            const hy = live ? live.y : (a.y + b.y) / 2;
            return (
              <Circle
                key={`ghost-${k}`}
                x={hx}
                y={hy}
                radius={4}
                fill={HANDLE_FILL}
                opacity={draggingGhost === k ? 1 : 0.4}
                stroke={HANDLE_STROKE}
                strokeWidth={1}
                draggable
                onMouseDown={(e) => { e.cancelBubble = true; }}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  const next = persistedWaypoints.slice();
                  next.splice(k, 0, { x: e.target.x(), y: e.target.y() });
                  setDraggingGhost(k);
                  setDraftWaypoints(next);
                }}
                onDragMove={(e) => {
                  const x = e.target.x();
                  const y = e.target.y();
                  setDraftWaypoints((prev) => {
                    const base = prev ? prev.slice() : (() => {
                      const b2 = persistedWaypoints.slice();
                      b2.splice(k, 0, { x, y });
                      return b2;
                    })();
                    base[k] = { x, y };
                    return base;
                  });
                }}
                onDragEnd={(e) => {
                  const base = (draftWaypoints ?? persistedWaypoints).slice();
                  base[k] = { x: e.target.x(), y: e.target.y() };
                  commitWaypoints(base);
                }}
              />
            );
          })}

          {/* Solid handles at each existing waypoint — drag to move, dbl-click to delete */}
          {moveWaypoints.map((p, i) => (
            <Circle
              key={`wp-${i}`}
              x={p.x}
              y={p.y}
              radius={5}
              fill={HANDLE_FILL}
              stroke={HANDLE_STROKE}
              strokeWidth={1.5}
              draggable
              onMouseDown={(e) => { e.cancelBubble = true; }}
              onDragMove={(e) => {
                const x = e.target.x();
                const y = e.target.y();
                setDraftWaypoints((prev) => {
                  const base = (prev ?? moveWaypoints).slice();
                  base[i] = { x, y };
                  return base;
                });
              }}
              onDragEnd={(e) => {
                const base = (draftWaypoints ?? moveWaypoints).slice();
                base[i] = { x: e.target.x(), y: e.target.y() };
                commitWaypoints(base);
              }}
              onDblClick={(e) => {
                e.cancelBubble = true;
                commitWaypoints(persistedWaypoints.filter((_, idx) => idx !== i));
              }}
            />
          ))}

          {/* Segment-slide bars — only on orthogonal edges, on interior
              segments (both endpoints are bends, not the fixed anchors). Drag a bar
              perpendicular to slide the whole segment while keeping 90°. The drag
              promotes the rendered route's interior points to explicit waypoints. */}
          {routing === 'orthogonal' && !bezier && (() => {
            const rp: Point[] = [];
            for (let i = 0; i + 1 < points.length; i += 2) rp.push({ x: points[i], y: points[i + 1] });
            const bars: React.ReactNode[] = [];
            // Draggable segment k connects rp[k]→rp[k+1]; interior endpoints only.
            for (let k = 1; k <= rp.length - 3; k++) {
              const a = rp[k];
              const b = rp[k + 1];
              const horizontal = Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) >= 0.5;
              const vertical = Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) >= 0.5;
              if (!horizontal && !vertical) continue;
              const orient: 'h' | 'v' = horizontal ? 'h' : 'v';
              const dragging = segLive?.a === k - 1;
              const mx = dragging ? segLive!.x : (a.x + b.x) / 2;
              const my = dragging ? segLive!.y : (a.y + b.y) / 2;
              bars.push(
                <Rect
                  key={`seg-${k}`}
                  x={mx}
                  y={my}
                  width={orient === 'h' ? 18 : 6}
                  height={orient === 'h' ? 6 : 18}
                  offsetX={orient === 'h' ? 9 : 3}
                  offsetY={orient === 'h' ? 3 : 9}
                  cornerRadius={2}
                  fill={HANDLE_FILL}
                  stroke={HANDLE_STROKE}
                  strokeWidth={1}
                  draggable
                  onMouseDown={(e) => { e.cancelBubble = true; }}
                  onDragStart={(e) => {
                    e.cancelBubble = true;
                    segDragRef.current = { interior: rp.slice(1, -1), a: k - 1, orient };
                    setSegLive({ x: e.target.x(), y: e.target.y(), a: k - 1 });
                  }}
                  onDragMove={(e) => {
                    const snap = segDragRef.current;
                    if (!snap) return;
                    const px = e.target.x();
                    const py = e.target.y();
                    setSegLive({ x: px, y: py, a: snap.a });
                    const coord = snap.orient === 'h' ? py : px;
                    const next = snap.interior.map((p) => ({ ...p }));
                    if (snap.orient === 'h') { next[snap.a].y = coord; next[snap.a + 1].y = coord; }
                    else { next[snap.a].x = coord; next[snap.a + 1].x = coord; }
                    setDraftWaypoints(next);
                  }}
                  onDragEnd={(e) => {
                    const snap = segDragRef.current;
                    segDragRef.current = null;
                    setSegLive(null);
                    if (!snap) return;
                    const coord = snap.orient === 'h' ? e.target.y() : e.target.x();
                    const next = snap.interior.map((p) => ({ ...p }));
                    if (snap.orient === 'h') { next[snap.a].y = coord; next[snap.a + 1].y = coord; }
                    else { next[snap.a].x = coord; next[snap.a + 1].x = coord; }
                    commitWaypoints(next);
                  }}
                />,
              );
            }
            return <>{bars}</>;
          })()}
        </>
      )}

      {/* ── Endpoint handles (P3): drag to re-link or re-anchor ─────────────── */}
      {showEndpoints && (
        <>
          {/* Dashed preview from the fixed end to the dragged endpoint. */}
          {draftEndpoint && (
            <Line
              points={
                draftEndpoint.end === 'source'
                  ? [draftEndpoint.x, draftEndpoint.y, markerX, markerY]
                  : [srcX, srcY, draftEndpoint.x, draftEndpoint.y]
              }
              stroke="#6366f1"
              strokeWidth={2}
              dash={[8, 5]}
              lineCap="round"
              listening={false}
            />
          )}
          {([
            { end: 'source' as const, x: srcX, y: srcY, other: { x: markerX, y: markerY } },
            { end: 'target' as const, x: markerX, y: markerY, other: { x: srcX, y: srcY } },
          ]).map(({ end, x, y, other }) => {
            const live = draftEndpoint?.end === end ? draftEndpoint : null;
            return (
              <Circle
                key={`ep-${end}`}
                x={live ? live.x : x}
                y={live ? live.y : y}
                radius={6}
                fill={ENDPOINT_FILL}
                stroke={HANDLE_FILL}
                strokeWidth={2.5}
                opacity={live ? 1 : 0.9}
                draggable
                onMouseDown={(e) => { e.cancelBubble = true; }}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  setDraftEndpoint({ end, x: e.target.x(), y: e.target.y() });
                }}
                onDragMove={(e) => {
                  setDraftEndpoint({ end, x: e.target.x(), y: e.target.y() });
                }}
                onDragEnd={(e) => {
                  const dropWorld = { x: e.target.x(), y: e.target.y() };
                  setDraftEndpoint(null);
                  // Snap the Konva node back; the store update (if any) re-renders
                  // the handle at its resolved position.
                  e.target.position({ x, y });
                  onEndpointDrop?.(id, end, dropWorld, other);
                }}
              />
            );
          })}
        </>
      )}
    </Group>
  );
}
