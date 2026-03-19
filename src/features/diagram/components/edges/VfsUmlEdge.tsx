import { useState } from 'react';
import { BaseEdge, getSmoothStepPath, Position, EdgeLabelRenderer, useStore } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import { getEdgeParams } from '../../../../util/geometry';
import { useUiStore } from '../../../../store/uiStore';

const DASHED_KINDS = new Set([
  'REALIZATION', 'DEPENDENCY', 'USAGE', 'INCLUDE', 'EXTEND',
]);

const MARKER_RETRACT: Record<string, number> = {
  GENERALIZATION: 16,
  REALIZATION:    16,
  AGGREGATION:    24,
  COMPOSITION:    24,
};

const KIND_LABEL: Partial<Record<string, string>> = {
  GENERALIZATION: 'es un',
  REALIZATION:    'implements',
  COMPOSITION:    'se compone de',
  AGGREGATION:    'tiene un',
};

const LABEL_CLASS =
  'nodrag nopan text-[11px] font-mono font-medium text-slate-500 dark:text-slate-300 bg-canvas-base px-1 rounded select-none transition-colors';

function getLabelStyle(
  x: number,
  y: number,
  pos: Position,
  offset: number,
): React.CSSProperties {
  switch (pos) {
    case Position.Top:
      return { position: 'absolute', transform: `translate(5px, -100%) translate(${x}px, ${y - offset}px)` };
    case Position.Bottom:
      return { position: 'absolute', transform: `translate(5px, 0%) translate(${x}px, ${y + offset}px)` };
    case Position.Left:
      return { position: 'absolute', transform: `translate(-100%, -100%) translate(${x - offset}px, ${y - 3}px)` };
    case Position.Right:
      return { position: 'absolute', transform: `translate(0%, -100%) translate(${x + offset}px, ${y - 3}px)` };
    default:
      return { position: 'absolute', transform: `translate(${x}px, ${y}px)` };
  }
}

export default function VfsUmlEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Top,
  targetPosition = Position.Bottom,
  style,
  data,
}: EdgeProps) {
  const [localHovered, setLocalHovered] = useState(false);

  const sourceNode = useStore((s) => s.nodeInternals.get(source));
  const targetNode = useStore((s) => s.nodeInternals.get(target));

  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY;
  let sp = sourcePosition, tp = targetPosition;

  const anchorLocked: boolean = (data?.anchorLocked as boolean | undefined) ?? false;
  const isSelfLoop = source === target;

  if (isSelfLoop && sourceNode) {
    const px = sourceNode.positionAbsolute?.x ?? 0;
    const py = sourceNode.positionAbsolute?.y ?? 0;
    const nw = sourceNode.width ?? 150;
    const nh = sourceNode.height ?? 80;
    sx = px + nw;
    sy = py + nh / 3;
    sp = Position.Right;
    tx = px + (nw * 2) / 3;
    ty = py;
    tp = Position.Top;
  } else if (!anchorLocked && sourceNode && targetNode) {
    const params = getEdgeParams(sourceNode, targetNode);
    sx = params.sx; sy = params.sy;
    tx = params.tx; ty = params.ty;
    sp = params.sourcePos; tp = params.targetPos;
  }

  if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) return null;

  const kind: string = (data?.kind as string) || 'ASSOCIATION';

  const isHighlighted: boolean = (data?.isHovered as boolean | undefined) ?? localHovered;
  const showTooltip = localHovered || isHighlighted;

  const stroke: string = (style?.stroke as string | undefined) ?? 'var(--edge-base, #64748b)';
  const edgeOpacity: number = (style?.opacity as number | undefined) ?? 1;
  const strokeWidth: number = isHighlighted ? 3 : 2;
  const canvasBase = 'var(--canvas-base, #0b0f1a)';
  const dashed = DASHED_KINDS.has(kind);

  const retract = MARKER_RETRACT[kind] ?? 0;
  let atx = tx, aty = ty;
  if (retract > 0) {
    switch (tp) {
      case Position.Top:    aty = ty - retract; break;
      case Position.Bottom: aty = ty + retract; break;
      case Position.Left:   atx = tx - retract; break;
      case Position.Right:  atx = tx + retract; break;
    }
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sx, sourceY: sy, sourcePosition: sp,
    targetX: atx, targetY: aty, targetPosition: tp,
    borderRadius: 20,
  });

  const getMarkerRotation = (): number => {
    switch (tp) {
      case Position.Top:    return 90;
      case Position.Left:   return 0;
      case Position.Bottom: return -90;
      case Position.Right:  return 180;
      default:              return 0;
    }
  };
  const rotation = getMarkerRotation();

  const renderMarker = () => {
    const t = `translate(${tx}, ${ty}) rotate(${rotation})`;
    switch (kind) {
      case 'GENERALIZATION':
      case 'REALIZATION':
        return (
          <g transform={t} style={{ opacity: edgeOpacity }}>
            <path d="M -16,-8 L -16,8 L 0,0 Z" fill={canvasBase} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
          </g>
        );
      case 'AGGREGATION':
        return (
          <g transform={t} style={{ opacity: edgeOpacity }}>
            <path d="M 0,0 L -12,6 L -24,0 L -12,-6 Z" fill={canvasBase} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
          </g>
        );
      case 'COMPOSITION':
        return (
          <g transform={t} style={{ opacity: edgeOpacity }}>
            <path d="M 0,0 L -12,6 L -24,0 L -12,-6 Z" fill={stroke} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
          </g>
        );
      default:
        return (
          <g transform={t} style={{ opacity: edgeOpacity }}>
            <path d="M -14,-7 L 0,0 L -14,7" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
    }
  };

  const lineStyle: React.CSSProperties = {
    stroke,
    strokeWidth,
    strokeDasharray: dashed ? '6,4' : undefined,
    opacity: edgeOpacity,
    transition: 'stroke 0.2s ease, stroke-width 0.15s ease, opacity 0.2s ease',
  };

  const defaultLabel = KIND_LABEL[kind];
  const hasBigMarker = ['GENERALIZATION', 'REALIZATION', 'AGGREGATION', 'COMPOSITION'].includes(kind);

  const sourceMultiplicity = data?.sourceMultiplicity as string | undefined;
  const targetMultiplicity = data?.targetMultiplicity as string | undefined;
  const sourceRole = data?.sourceRole as string | undefined;
  const targetRole = data?.targetRole as string | undefined;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={lineStyle} />

      {renderMarker()}

      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setLocalHovered(true)}
        onMouseLeave={() => setLocalHovered(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          useUiStore.getState().openVfsEdgeAction(id);
        }}
        style={{ cursor: 'pointer' }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 5}px)`,
            pointerEvents: 'none',
            zIndex: 1000,
            opacity: edgeOpacity,
          }}
          className="nodrag nopan flex flex-col items-center gap-1"
        >
          {showTooltip && (
            <div className="bg-surface-primary text-text-primary border border-surface-border text-[10px] font-bold px-2 py-0.5 rounded shadow-lg select-none animate-in fade-in zoom-in duration-150 mb-1">
              {kind.charAt(0) + kind.slice(1).toLowerCase()}
            </div>
          )}
          {defaultLabel && (
            <div className={LABEL_CLASS}>{defaultLabel}</div>
          )}
        </div>

        {(sourceMultiplicity || sourceRole) && (
          <div
            style={{ ...getLabelStyle(sx, sy, sp, 10), pointerEvents: 'none', zIndex: 10, opacity: edgeOpacity, display: 'flex', flexDirection: 'column', gap: '1px' }}
          >
            {sourceRole && <span className={LABEL_CLASS}>{sourceRole}</span>}
            {sourceMultiplicity && <span className={LABEL_CLASS}>{sourceMultiplicity}</span>}
          </div>
        )}

        {(targetMultiplicity || targetRole) && (
          <div
            style={{ ...getLabelStyle(tx, ty, tp, hasBigMarker ? 28 : 12), pointerEvents: 'none', zIndex: 10, opacity: edgeOpacity, display: 'flex', flexDirection: 'column', gap: '1px' }}
          >
            {targetRole && <span className={LABEL_CLASS}>{targetRole}</span>}
            {targetMultiplicity && <span className={LABEL_CLASS}>{targetMultiplicity}</span>}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
