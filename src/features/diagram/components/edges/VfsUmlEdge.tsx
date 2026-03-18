import { useState } from 'react';
import { BaseEdge, getSmoothStepPath, Position, EdgeLabelRenderer, useStore } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import { getEdgeParams } from '../../../../util/geometry';

// ─── UML 2.5 colour palette (CSS custom properties fall back to hex) ──────────

const KIND_COLOR: Record<string, string> = {
  ASSOCIATION:    'var(--edge-base, #64748b)',
  GENERALIZATION: 'var(--edge-inheritance, #10b981)',
  REALIZATION:    'var(--edge-implementation, #3b82f6)',
  AGGREGATION:    'var(--edge-aggregation, #8b5cf6)',
  COMPOSITION:    'var(--edge-composition, #ec4899)',
  DEPENDENCY:     'var(--edge-dependency, #f59e0b)',
  USAGE:          'var(--edge-dependency, #f59e0b)',
  INCLUDE:        'var(--edge-include, #06b6d4)',
  EXTEND:         'var(--edge-extend, #f97316)',
};

const DASHED_KINDS = new Set([
  'REALIZATION', 'DEPENDENCY', 'USAGE', 'INCLUDE', 'EXTEND',
]);

/**
 * How many pixels the edge path must stop short of the target point so the
 * marker sits flush without the line peeking through the arrowhead fill.
 * GENERALIZATION/REALIZATION: hollow triangle, depth = 16 px
 * AGGREGATION/COMPOSITION:    diamond,         depth = 24 px
 */
const MARKER_RETRACT: Record<string, number> = {
  GENERALIZATION: 16,
  REALIZATION:    16,
  AGGREGATION:    24,
  COMPOSITION:    24,
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * VfsUmlEdge — purpose-built UML 2.5 edge renderer for VFS (.luml) diagrams.
 *
 * Unlike CustomUmlEdge (which dispatches on a translated `data.type` string),
 * this component reads `data.kind` directly from the raw IRRelation.kind value
 * stored in ModelStore.  No vocabulary translation layer is needed.
 *
 * Features:
 *  - Proper UML 2.5 SVG markers (hollow triangle, open/filled diamond, open arrow)
 *  - Orthogonal step-routing with rounded corners (borderRadius: 16)
 *  - Border-accurate connection points via getEdgeParams
 *  - Invisible thick hit-area for easy click/hover detection
 *  - Local hover state with kind tooltip
 */
export default function VfsUmlEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);

  const sourceNode = useStore((s) => s.nodeInternals.get(source));
  const targetNode = useStore((s) => s.nodeInternals.get(target));

  // Prefer border-accurate connection points from getEdgeParams when both
  // nodes are mounted; fall back to ReactFlow's computed props.
  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY;
  let sp = sourcePosition, tp = targetPosition;

  if (sourceNode && targetNode) {
    const params = getEdgeParams(sourceNode, targetNode);
    sx = params.sx; sy = params.sy;
    tx = params.tx; ty = params.ty;
    sp = params.sourcePos; tp = params.targetPos;
  }

  if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) return null;

  const kind: string = (data?.kind as string) || 'ASSOCIATION';
  const stroke = KIND_COLOR[kind] ?? KIND_COLOR.ASSOCIATION;
  const dashed = DASHED_KINDS.has(kind);
  const canvasBase = 'var(--canvas-base, #ffffff)';

  // Marker rotation: the SVG markers are drawn pointing RIGHT (+x direction).
  // Rotate them so they point toward the target.
  const getMarkerRotation = () => {
    switch (tp) {
      case Position.Top:    return 90;
      case Position.Left:   return 0;
      case Position.Bottom: return -90;
      case Position.Right:  return 180;
      default:              return 0;
    }
  };
  const rotation = getMarkerRotation();

  // Retract the path endpoint so the edge line doesn't overdraw the marker fill.
  const retract = MARKER_RETRACT[kind] ?? 0;
  let atx = tx, aty = ty;
  if (retract > 0) {
    switch (tp) {
      case Position.Top:    aty = ty + retract; break;
      case Position.Bottom: aty = ty - retract; break;
      case Position.Left:   atx = tx + retract; break;
      case Position.Right:  atx = tx - retract; break;
    }
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sp,
    targetX: atx,
    targetY: aty,
    targetPosition: tp,
    borderRadius: 16,
  });

  // ── UML 2.5 marker SVG ────────────────────────────────────────────────────
  //
  // All markers are defined in local SVG coordinates centred at (tx, ty),
  // pointing RIGHT (toward +x). The enclosing <g> is rotated so they point
  // toward the actual target.
  //
  // Hollow triangle (GENERALIZATION / REALIZATION):
  //   Tip at (0,0), base at (-16, ±8).  Filled with canvas background.
  //
  // Open diamond (AGGREGATION):
  //   Rightmost point at (0,0), leftmost at (-24,0), top/bottom at (-12, ±6).
  //   Filled with canvas background (open).
  //
  // Filled diamond (COMPOSITION):
  //   Same shape as aggregation but filled with stroke colour (solid).
  //
  // Open arrow (DEPENDENCY / USAGE / INCLUDE / EXTEND / ASSOCIATION):
  //   Two lines from (0,0) back to (-14, ±7) — no fill.

  const renderMarker = () => {
    switch (kind) {
      case 'GENERALIZATION':
      case 'REALIZATION':
        return (
          <g transform={`translate(${tx}, ${ty}) rotate(${rotation})`}>
            <path
              d="M -16,-8 L -16,8 L 0,0 Z"
              fill={canvasBase}
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>
        );

      case 'AGGREGATION':
        return (
          <g transform={`translate(${tx}, ${ty}) rotate(${rotation})`}>
            <path
              d="M 0,0 L -12,6 L -24,0 L -12,-6 Z"
              fill={canvasBase}
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>
        );

      case 'COMPOSITION':
        return (
          <g transform={`translate(${tx}, ${ty}) rotate(${rotation})`}>
            <path
              d="M 0,0 L -12,6 L -24,0 L -12,-6 Z"
              fill={stroke}
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>
        );

      // Everything else (ASSOCIATION, DEPENDENCY, USAGE, INCLUDE, EXTEND, …)
      // gets an open arrowhead.
      default:
        return (
          <g transform={`translate(${tx}, ${ty}) rotate(${rotation})`}>
            <path
              d="M -14,-7 L 0,0 L -14,7"
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
    }
  };

  const lineStyle = {
    stroke,
    strokeWidth: hovered ? 3 : 2,
    strokeDasharray: dashed ? '6,4' : undefined,
    transition: 'stroke-width 0.15s',
  };

  return (
    <>
      {/*
       * Invisible thick overlay for reliable hover/click detection.
       * ReactFlow edge selection is handled at the wrapper level, but hover
       * tooltips need a wider hit-area than the 2 px stroke.
       */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />

      <BaseEdge id={id} path={edgePath} style={lineStyle} />

      {renderMarker()}

      <EdgeLabelRenderer>
        {hovered && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 6}px)`,
              pointerEvents: 'none',
            }}
            className="bg-surface-primary text-primary border border-primary/30 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg select-none animate-in fade-in zoom-in duration-150"
          >
            {kind.charAt(0) + kind.slice(1).toLowerCase()}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
