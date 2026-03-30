/**
 * KonvaEdge — react-konva component for UML relation edges.
 *
 * Rendering pipeline per edge:
 *   1. selectAnchors()   — pick the closest pair of cardinal anchor points.
 *   2. retractAnchor()   — pull target anchor back so line body meets marker base.
 *   3. orthogonalRoute() — compute flat points array for a right-angle path.
 *   4. <Line>            — draw the path (solid or dashed by kind).
 *   5. <EdgeMarker>      — draw the arrowhead / diamond at the target anchor.
 *
 * Line styles:
 *   Solid:  ASSOCIATION, AGGREGATION, COMPOSITION, GENERALIZATION, TRANSITION, …
 *   Dashed: REALIZATION, DEPENDENCY, USAGE, INCLUDE, EXTEND
 *
 * Interactivity: `listening={false}` — hit-testing wired in MAG-01.5.
 */

import { useMemo } from 'react';
import { Group, Line } from 'react-konva';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';
import { selectAnchors, retractAnchor, orthogonalRoute, type NodeBounds } from './geometry';
import EdgeMarker from './EdgeMarker';

// ─── Edge style data ──────────────────────────────────────────────────────────

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

interface KonvaEdgeProps {
  kind: RelationKind;
  sourceBounds: NodeBounds;
  targetBounds: NodeBounds;
}

export default function KonvaEdge({ kind, sourceBounds, targetBounds }: KonvaEdgeProps) {
  const stroke = getEdgeColor();
  const dashed = DASHED_KINDS.has(kind);

  const { tgt, points } = useMemo(() => {
    const { src, tgt } = selectAnchors(sourceBounds, targetBounds);
    const retract = MARKER_RETRACT[kind] ?? 0;
    const retractedTgt = retract > 0 ? retractAnchor(tgt, retract) : tgt;
    const pts = orthogonalRoute(src, retractedTgt);
    return { tgt, points: pts };
  }, [sourceBounds, targetBounds, kind]);

  return (
    <Group listening={false}>
      <Line
        points={points}
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
        x={tgt.x}
        y={tgt.y}
        face={tgt.face}
        stroke={stroke}
      />
    </Group>
  );
}
