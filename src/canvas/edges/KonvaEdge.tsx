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
import { Group, Line } from 'react-konva';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';
import {
  selectAnchors,
  retractAnchor,
  orthogonalRoute,
  curvedRoute,
  straightRoute,
  selfLoopPath,
  type NodeBounds,
} from './geometry';
import { avoidObstacles } from './obstacleAvoidance';
import EdgeMarker from './EdgeMarker';

// ─── Edge style tables ────────────────────────────────────────────────────────

const DASHED_KINDS = new Set<RelationKind>([
  'REALIZATION', 'DEPENDENCY', 'USAGE', 'INCLUDE', 'EXTEND',
]);

const MARKER_RETRACT: Partial<Record<RelationKind, number>> = {
  GENERALIZATION: 16,
  REALIZATION:    16,
  AGGREGATION:    24,
  COMPOSITION:    24,
};

function getEdgeColor(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--edge-base').trim() || '#64748b'
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export type RoutingMode = 'orthogonal' | 'curved' | 'straight';

interface KonvaEdgeProps {
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
}

export default function KonvaEdge({
  kind,
  sourceBounds,
  targetBounds,
  isSelfLoop = false,
  routingMode = 'orthogonal',
  obstacles,
}: KonvaEdgeProps) {
  const stroke = getEdgeColor();
  const dashed = DASHED_KINDS.has(kind);
  const retract = MARKER_RETRACT[kind] ?? 0;

  const { markerX, markerY, markerFace, points, bezier } = useMemo(() => {
    // ── Self-loop ──────────────────────────────────────────────────────────
    if (isSelfLoop) {
      const loop = selfLoopPath(sourceBounds, retract);
      return {
        points: loop.points,
        bezier: true,
        markerX: loop.markerX,
        markerY: loop.markerY,
        markerFace: loop.markerFace,
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

    return {
      points: pts,
      bezier: isBezier,
      markerX: tgt.x,
      markerY: tgt.y,
      markerFace: tgt.face,
    };
  }, [sourceBounds, targetBounds, kind, isSelfLoop, routingMode, obstacles, retract]);

  return (
    <Group listening={false}>
      <Line
        points={points}
        bezier={bezier}
        stroke={stroke}
        strokeWidth={2}
        dash={dashed ? [6, 4] : undefined}
        lineCap="round"
        lineJoin="round"
        listening={false}
        perfectDrawEnabled={false}
      />
      <EdgeMarker
        kind={kind}
        x={markerX}
        y={markerY}
        face={markerFace}
        stroke={stroke}
      />
    </Group>
  );
}
