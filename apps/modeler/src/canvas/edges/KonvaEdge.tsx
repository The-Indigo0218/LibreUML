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
 *   5. <EdgeMarker>      — draw arrowhead / diamond at original target anchor.
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

import { useMemo, useState } from 'react';
import { Group, Line, Text, Label, Tag, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';
import {
  selectAnchors,
  resolveLockedAnchors,
  retractAnchor,
  edgeIntersection,
  directionToAngle,
  curvedRoute,
  straightRoute,
  polylineRoute,
  orthogonalPolylineRoute,
  resolveRoutingMode,
  selfLoopPath,
  type NodeBounds,
  type NodeShape,
  type LockedHandle,
  type AnchorPoint,
  type Point,
} from './geometry';
import { avoidObstacles } from './obstacleAvoidance';
import EdgeMarker from './EdgeMarker';

const DASHED_KINDS = new Set<RelationKind>([
  'REALIZATION', 'DEPENDENCY', 'USAGE', 'INCLUDE', 'EXTEND',
  'PACKAGE_IMPORT', 'PACKAGE_MERGE', 'PACKAGE_ACCESS',
]);

const MARKER_RETRACT: Partial<Record<RelationKind, number>> = {
  GENERALIZATION: 16,
  REALIZATION:    16,
  AGGREGATION:    24,
  COMPOSITION:    24,
};

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
    default:
      return null;
  }
}

// ─── Label position helpers ────────────────────────────────────────────────────

const LABEL_ALONG = 16; // px along edge from anchor — ensures pill clears node boundary
const LABEL_PERP  = 10; // px perpendicular from the edge line
const ROLE_STACK  = 28; // px along edge direction from multiplicity to role

/**
 * Returns the geometric midpoint of a flat Konva polyline.
 * For bezier arrays (8-element control-point form) falls back to segment midpoint.
 */
function pathMidpoint(pts: number[], isBezier: boolean): { x: number; y: number } {
  const n = pts.length;
  if (n < 4) return { x: pts[0] ?? 0, y: pts[1] ?? 0 };

  if (isBezier) {
    return { x: (pts[0] + pts[n - 2]) / 2, y: (pts[1] + pts[n - 1]) / 2 };
  }
  if (n === 4) return { x: (pts[0] + pts[2]) / 2, y: (pts[1] + pts[3]) / 2 };

  let total = 0;
  const lens: number[] = [];
  for (let i = 0; i < n - 2; i += 2) {
    const len = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
    lens.push(len);
    total += len;
  }
  let acc = 0;
  const half = total / 2;
  for (let i = 0; i < lens.length; i++) {
    const next = acc + lens[i];
    if (next >= half) {
      const t = lens[i] > 0 ? (half - acc) / lens[i] : 0;
      return {
        x: pts[i * 2]     + t * (pts[i * 2 + 2] - pts[i * 2]),
        y: pts[i * 2 + 1] + t * (pts[i * 2 + 3] - pts[i * 2 + 1]),
      };
    }
    acc = next;
  }
  return { x: pts[n - 2], y: pts[n - 1] };
}

interface LabelPositions {
  sourceMultX: number;
  sourceMultY: number;
  sourceRoleX: number;
  sourceRoleY: number;
  targetMultX: number;
  targetMultY: number;
  targetRoleX: number;
  targetRoleY: number;
  centerX: number;
  centerY: number;
}

/**
 * Computes label anchor positions using the actual first/last edge segment
 * direction vectors so labels are always pushed outside the node boundary.
 *
 * srcX/srcY     — source anchor (ON node boundary)
 * tgtX/tgtY     — target marker position (ON node boundary)
 * pts           — flat points array from the routing function
 * targetAlong   — override for the along-edge offset at the target end;
 *                 should be max(LABEL_ALONG, markerDepth + 10) to clear the marker
 * isBezier      — true for cubic bezier arrays (control-point form)
 */
function computeLabelPositions(
  pts: number[],
  srcX: number,
  srcY: number,
  tgtX: number,
  tgtY: number,
  targetAlong: number,
  isBezier: boolean,
): LabelPositions {
  const n = pts.length;
  const hasMid = n > 4;

  // Direction at source: from anchor toward first segment (or toward target for 2-pt lines)
  const sDirX = (hasMid ? pts[2] : pts[n - 2]) - srcX;
  const sDirY = (hasMid ? pts[3] : pts[n - 1]) - srcY;
  const sLen  = Math.sqrt(sDirX * sDirX + sDirY * sDirY) || 1;
  const sNX   = sDirX / sLen;
  const sNY   = sDirY / sLen;
  // CW 90° rotation = right side of travel direction
  const sPerpX =  sNY;
  const sPerpY = -sNX;

  // Direction at target: backward from marker along last segment
  const tDirX = (hasMid ? pts[n - 4] : pts[0]) - tgtX;
  const tDirY = (hasMid ? pts[n - 3] : pts[1]) - tgtY;
  const tLen  = Math.sqrt(tDirX * tDirX + tDirY * tDirY) || 1;
  const tNX   = tDirX / tLen;
  const tNY   = tDirY / tLen;
  // CCW of backward = CW of forward = right side of travel at target end
  const tPerpX = -tNY;
  const tPerpY =  tNX;

  // Multiplicity anchor positions
  const srcMultX = srcX + sNX * LABEL_ALONG + sPerpX * LABEL_PERP;
  const srcMultY = srcY + sNY * LABEL_ALONG + sPerpY * LABEL_PERP;
  const tgtMultX = tgtX + tNX * targetAlong + tPerpX * LABEL_PERP;
  const tgtMultY = tgtY + tNY * targetAlong + tPerpY * LABEL_PERP;

  const mid = pathMidpoint(pts, isBezier);

  return {
    sourceMultX: srcMultX,
    sourceMultY: srcMultY,
    // Role stacks along the edge direction (away from the node) so it never
    // overlaps the class box when the edge exits from the top face going upward.
    sourceRoleX: srcMultX + sNX * ROLE_STACK,
    sourceRoleY: srcMultY + sNY * ROLE_STACK,
    targetMultX: tgtMultX,
    targetMultY: tgtMultY,
    targetRoleX: tgtMultX + tNX * ROLE_STACK,
    targetRoleY: tgtMultY + tNY * ROLE_STACK,
    // Geometric midpoint of the actual path for kind badge / stereotype label
    centerX: mid.x,
    centerY: mid.y - 14,
  };
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
  /** Locked anchor mode — when true, use stored handles instead of closest-pair selection */
  anchorLocked?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
  /**
   * Floating anchors (R4). When true (and not locked / no waypoints), endpoints
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
   * Manual user waypoints (R3). When non-empty, the line body is routed as a
   * polyline through these points instead of the automatic routing, letting the
   * user bend the edge. Anchors at both ends are still resolved normally.
   * Ignored for self-loops.
   */
  waypoints?: Point[];
  /** True when this edge is the selected one — shows waypoint editing handles (R3b). */
  selected?: boolean;
  /** Click handler used to select the edge (R3b). */
  onSelect?: (edgeId: string) => void;
  /** Persists a new waypoints array after a handle drag / insert / delete (R3b). */
  onWaypointsChange?: (edgeId: string, waypoints: Point[]) => void;
}

export default function KonvaEdge({
  id,
  kind,
  sourceBounds,
  targetBounds,
  isSelfLoop = false,
  routingMode,
  obstacles,
  sourceMultiplicity,
  targetMultiplicity,
  sourceRole,
  targetRole,
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
  anchorLocked = false,
  sourceHandle,
  targetHandle,
  floating = false,
  sourceShape = 'rect',
  targetShape = 'rect',
  waypoints,
  selected = false,
  onSelect,
  onWaypointsChange,
}: KonvaEdgeProps) {
  // Local draft of waypoints during an in-progress handle drag (R3b). Null =
  // use the props value. Lets the line follow the handle live without touching
  // the store until the drag ends.
  const [draftWaypoints, setDraftWaypoints] = useState<Point[] | null>(null);
  // Index of the segment-midpoint ("ghost") handle currently being dragged to
  // insert a new bend, or null. Needed so that ghost is rendered at the live
  // dragged position (avoids react-konva snapping it back each frame).
  const [draggingGhost, setDraggingGhost] = useState<number | null>(null);
  // When active (highlighted or hovered): use kind-specific color; else base gray
  const isActive = isHighlighted || isHovered;
  const stroke = isActive ? getEdgeColorByKind(kind) : getEdgeColor();
  const strokeWidth = isActive ? 3 : 2;
  const dashed = DASHED_KINDS.has(kind);
  const retract = MARKER_RETRACT[kind] ?? 0;
  const stereotypeLabel = getStereotypeLabel(kind);

  const showLines  = renderMode !== 'labels';
  const showLabels = renderMode !== 'lines';

  // Waypoints actually rendered: the live draft (during a drag) or the persisted props.
  const effectiveWaypoints = draftWaypoints ?? waypoints;

  const { markerX, markerY, markerFace, markerAngle, points, bezier, labelPositions, srcX, srcY } = useMemo(() => {
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
    // Undefined → orthogonal (legacy fallback); new edges carry an explicit mode.
    const routing = resolveRoutingMode(routingMode);
    // Floating wins over fixed handles unless the edge is explicitly locked.
    const useFloating = floating && !(anchorLocked && sourceHandle && targetHandle);

    let src: AnchorPoint;
    let tgt: AnchorPoint;
    let retractedTgt: Point;
    let markerAngle: number | undefined;

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

    let pts: number[];
    let isBezier = false;

    if (hasWaypoints) {
      // Manual waypoints (R3). In orthogonal mode they become fixed bend anchors
      // connected by right-angle elbows that recompute as nodes move (R6); in any
      // other mode the body is a straight polyline through the points.
      pts = routing === 'orthogonal' && !useFloating
        ? orthogonalPolylineRoute(src, effectiveWaypoints!, retractedTgt)
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
      labelPositions: computeLabelPositions(pts, src.x, src.y, tgt.x, tgt.y, targetAlong, isBezier),
    };
  }, [sourceBounds, targetBounds, kind, isSelfLoop, routingMode, obstacles, retract, anchorLocked, sourceHandle, targetHandle, floating, sourceShape, targetShape, effectiveWaypoints]);

  // ── Waypoint editing handles (R3b) ────────────────────────────────────────
  const showHandles = showLabels && selected && !isSelfLoop && !!onWaypointsChange;
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

  const commitWaypoints = (next: Point[]) => {
    onWaypointsChange?.(id, next);
    setDraftWaypoints(null);
    setDraggingGhost(null);
  };

  const multStyle      = isHighlighted ? 'bold' : 'normal';
  const roleStyle      = isHighlighted ? 'bold italic' : 'italic';
  const labelSize      = 11;
  const kindLabel      = formatKindLabel(kind);
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
            points={points}
            bezier={bezier}
            stroke={stroke}
            strokeWidth={strokeWidth}
            dash={dashed ? [6, 4] : undefined}
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
          <EdgeMarker
            kind={kind}
            x={markerX}
            y={markerY}
            face={markerFace}
            stroke={stroke}
            angleOverride={markerAngle}
          />
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
              offsetX={Math.round(sourceMultiplicity.length * 3.2 + labelPad)}
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
              offsetX={Math.round(sourceRole.length * 3.2 + labelPad)}
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
              offsetX={Math.round(targetMultiplicity.length * 3.2 + labelPad)}
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
              offsetX={Math.round(targetRole.length * 3.2 + labelPad)}
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
              offsetX={Math.round(label.length * 3.3 + labelPad)}
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
        </>
      )}

      {/* ── Waypoint editing handles (R3b) ──────────────────────────────── */}
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
        </>
      )}
    </Group>
  );
}
