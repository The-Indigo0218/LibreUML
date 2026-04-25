/**
 * KonvaEdge — react-konva component for UML relation edges.
 *
 * Routing modes
 * ─────────────
 *   'orthogonal' (default)  Three-segment L-shaped path with obstacle avoidance.
 *   'curved'                Smooth cubic Bezier using outward control points.
 *   'straight'              Direct two-point line; no bends.
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

import { useMemo } from 'react';
import { Group, Line, Text, Label, Tag } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';
import {
  selectAnchors,
  retractAnchor,
  curvedRoute,
  straightRoute,
  selfLoopPath,
  type NodeBounds,
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
  INCLUDE:        '--edge-implementation',
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
    case 'PACKAGE_IMPORT':
      return '<<import>>';
    case 'PACKAGE_MERGE':
      return '<<merge>>';
    case 'PACKAGE_ACCESS':
      return '<<access>>';
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
   * How to route the line body. Defaults to 'orthogonal'.
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
}

export default function KonvaEdge({
  id,
  kind,
  sourceBounds,
  targetBounds,
  isSelfLoop = false,
  routingMode = 'orthogonal',
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
}: KonvaEdgeProps) {
  // When active (highlighted or hovered): use kind-specific color; else base gray
  const isActive = isHighlighted || isHovered;
  const stroke = isActive ? getEdgeColorByKind(kind) : getEdgeColor();
  const strokeWidth = isActive ? 3 : 2;
  const dashed = DASHED_KINDS.has(kind);
  const retract = MARKER_RETRACT[kind] ?? 0;
  const stereotypeLabel = getStereotypeLabel(kind);

  const showLines  = renderMode !== 'labels';
  const showLabels = renderMode !== 'lines';

  const { markerX, markerY, markerFace, points, bezier, labelPositions } = useMemo(() => {
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
    const { src, tgt } = selectAnchors(sourceBounds, targetBounds);
    const retractedTgt = retract > 0 ? retractAnchor(tgt, retract) : tgt;

    let pts: number[];
    let isBezier = false;

    switch (routingMode) {
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

    // Target labels must clear the marker depth (e.g. 24px diamond for COMPOSITION)
    const targetAlong = Math.max(LABEL_ALONG, retract + 16);

    return {
      points: pts,
      bezier: isBezier,
      markerX: tgt.x,
      markerY: tgt.y,
      markerFace: tgt.face,
      labelPositions: computeLabelPositions(pts, src.x, src.y, tgt.x, tgt.y, targetAlong, isBezier),
    };
  }, [sourceBounds, targetBounds, kind, isSelfLoop, routingMode, obstacles, retract]);

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
            onContextMenu={(e) => onContextMenu?.(e, id)}
            onMouseEnter={(e) => onMouseEnter?.(e, id)}
            onMouseLeave={(e) => onMouseLeave?.(e, id)}
          />
          <EdgeMarker
            kind={kind}
            x={markerX}
            y={markerY}
            face={markerFace}
            stroke={stroke}
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
        </>
      )}
    </Group>
  );
}
