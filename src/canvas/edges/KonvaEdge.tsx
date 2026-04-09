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

function formatKindLabel(kind: RelationKind): string {
  return kind
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export type RoutingMode = 'orthogonal' | 'curved' | 'straight';

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

  const { markerX, markerY, markerFace, points, bezier, labelPositions } = useMemo(() => {
    // ── Self-loop ──────────────────────────────────────────────────────────
    if (isSelfLoop) {
      const loop = selfLoopPath(sourceBounds, retract);
      
      // Label positions for self-loop (near source node)
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
          sourceMultX: srcX,
          sourceMultY: srcY - 15,
          sourceRoleX: srcX,
          sourceRoleY: srcY + 5,
          targetMultX: tgtX,
          targetMultY: tgtY - 15,
          targetRoleX: tgtX,
          targetRoleY: tgtY + 5,
          centerX: sourceBounds.x + sourceBounds.width + 15,
          centerY: sourceBounds.y - 20,
        },
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

    // Calculate label positions
    // Source labels: near start of edge
    const srcX = pts[0];
    const srcY = pts[1];
    
    // Target labels: near end of edge (before marker)
    const tgtX = pts[pts.length - 2];
    const tgtY = pts[pts.length - 1];
    
    // Offset labels based on edge direction
    const dx = tgtX - srcX;
    const dy = tgtY - srcY;
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    
    return {
      points: pts,
      bezier: isBezier,
      markerX: tgt.x,
      markerY: tgt.y,
      markerFace: tgt.face,
      labelPositions: {
        // Source end labels
        sourceMultX: srcX + (isHorizontal ? 10 : -30),
        sourceMultY: srcY + (isHorizontal ? -15 : 10),
        sourceRoleX: srcX + (isHorizontal ? 10 : -30),
        sourceRoleY: srcY + (isHorizontal ? 5 : 30),
        // Target end labels
        targetMultX: tgtX + (isHorizontal ? -30 : 10),
        targetMultY: tgtY + (isHorizontal ? -15 : -20),
        targetRoleX: tgtX + (isHorizontal ? -30 : 10),
        targetRoleY: tgtY + (isHorizontal ? 5 : 0),
        // Center label (type name when highlighted)
        centerX: (pts[0] + pts[pts.length - 2]) / 2,
        centerY: (pts[1] + pts[pts.length - 1]) / 2 - 12,
      },
    };
  }, [sourceBounds, targetBounds, kind, isSelfLoop, routingMode, obstacles, retract]);

  return (
    <Group opacity={isDimmed ? 0.15 : 1} visible={visible}>
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

      {/* Hover badge — floating label above edge midpoint (MAG-01.24) */}
      {isHovered && (
        <Label
          x={labelPositions.centerX}
          y={labelPositions.centerY - 16}
          offsetX={formatKindLabel(kind).length * 3.5 + 6}
        >
          <Tag
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth={1}
            cornerRadius={4}
            shadowColor="rgba(0,0,0,0.2)"
            shadowBlur={6}
            shadowOffsetY={2}
          />
          <Text
            text={formatKindLabel(kind)}
            fontSize={12}
            fontStyle="bold"
            fill="#0f172a"
            padding={5}
            listening={false}
          />
        </Label>
      )}

      {/* Source multiplicity label */}
      {sourceMultiplicity && (
        <Text
          x={labelPositions.sourceMultX}
          y={labelPositions.sourceMultY}
          text={sourceMultiplicity}
          fontSize={isHighlighted ? 13 : 12}
          fontStyle={isHighlighted ? 'bold' : 'normal'}
          fill={isHighlighted ? stroke : '#888'}
          listening={false}
        />
      )}

      {/* Source role label */}
      {sourceRole && (
        <Text
          x={labelPositions.sourceRoleX}
          y={labelPositions.sourceRoleY}
          text={sourceRole}
          fontSize={isHighlighted ? 13 : 12}
          fontStyle={isHighlighted ? 'bold' : 'normal'}
          fill={isHighlighted ? stroke : '#888'}
          listening={false}
        />
      )}

      {/* Target multiplicity label */}
      {targetMultiplicity && (
        <Text
          x={labelPositions.targetMultX}
          y={labelPositions.targetMultY}
          text={targetMultiplicity}
          fontSize={isHighlighted ? 13 : 12}
          fontStyle={isHighlighted ? 'bold' : 'normal'}
          fill={isHighlighted ? stroke : '#888'}
          listening={false}
        />
      )}

      {/* Target role label */}
      {targetRole && (
        <Text
          x={labelPositions.targetRoleX}
          y={labelPositions.targetRoleY}
          text={targetRole}
          fontSize={isHighlighted ? 13 : 12}
          fontStyle={isHighlighted ? 'bold' : 'normal'}
          fill={isHighlighted ? stroke : '#888'}
          listening={false}
        />
      )}
    </Group>
  );
}
