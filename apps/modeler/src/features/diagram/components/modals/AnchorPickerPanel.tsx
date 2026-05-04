import { useTranslation } from 'react-i18next';
import { Unlock } from 'lucide-react';
import type { LockedHandle } from '../../../../canvas/edges/geometry';

// ─── Layout constants ─────────────────────────────────────────────────────────

const SVG_W  = 460;
const SVG_H  = 170;
const NODE_W = 84;
const NODE_H = 52;
const DOT_R  = 5;
const DOT_SEL_R = 7;

const ALL_HANDLES: LockedHandle[] = ['T', 'B', 'L', 'R', 'TL', 'TR', 'BL', 'BR'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Positions two node rectangles inside the SVG such that their relative
 * direction mirrors the actual canvas direction (dx, dy).
 * Uses Chebyshev normalisation so the dominant axis fills its available space.
 */
function getNodePositions(dx: number, dy: number) {
  const norm = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const nx   = dx / norm;
  const ny   = dy / norm;
  const maxX = (SVG_W - NODE_W) / 2 - 14;
  const maxY = (SVG_H - NODE_H) / 2 - 10;
  const shiftX = Math.round(nx * maxX);
  const shiftY = Math.round(ny * maxY);
  const cx = SVG_W / 2;
  const cy = SVG_H / 2;
  return {
    src: { cx: cx - shiftX, cy: cy - shiftY },
    tgt: { cx: cx + shiftX, cy: cy + shiftY },
  };
}

function getAnchorPt(cx: number, cy: number, h: LockedHandle) {
  const hw = NODE_W / 2;
  const hh = NODE_H / 2;
  switch (h) {
    case 'T':  return { x: cx,      y: cy - hh };
    case 'B':  return { x: cx,      y: cy + hh };
    case 'L':  return { x: cx - hw, y: cy      };
    case 'R':  return { x: cx + hw, y: cy      };
    case 'TL': return { x: cx - hw, y: cy - hh };
    case 'TR': return { x: cx + hw, y: cy - hh };
    case 'BL': return { x: cx - hw, y: cy + hh };
    case 'BR': return { x: cx + hw, y: cy + hh };
  }
}

/**
 * Computes which anchors face "toward" the other node.
 * Source valid = anchors pointing toward the target.
 * Target valid = anchors pointing toward the source.
 */
function getValidAnchors(dx: number, dy: number) {
  const sv = new Set<LockedHandle>();
  const tv = new Set<LockedHandle>();

  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    ALL_HANDLES.forEach(h => { sv.add(h); tv.add(h); });
    return { srcValid: sv, tgtValid: tv };
  }

  if (dx > 0) {
    sv.add('R'); sv.add('TR'); sv.add('BR');
    tv.add('L'); tv.add('TL'); tv.add('BL');
  } else if (dx < 0) {
    sv.add('L'); sv.add('TL'); sv.add('BL');
    tv.add('R'); tv.add('TR'); tv.add('BR');
  }

  if (dy > 0) {
    sv.add('B'); sv.add('BL'); sv.add('BR');
    tv.add('T'); tv.add('TL'); tv.add('TR');
  } else if (dy < 0) {
    sv.add('T'); sv.add('TL'); sv.add('TR');
    tv.add('B'); tv.add('BL'); tv.add('BR');
  }

  return { srcValid: sv, tgtValid: tv };
}

function truncate(s: string, max = 9) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ─── Node rectangle ────────────────────────────────────────────────────────────

interface NodeRectProps {
  cx: number;
  cy: number;
  label: string;
  handles: LockedHandle[];
  selected: LockedHandle;
  validSet: Set<LockedHandle>;
  locked: boolean;
  onPick: (h: LockedHandle) => void;
}

function NodeRect({ cx, cy, label, handles, selected, validSet, locked, onPick }: NodeRectProps) {
  return (
    <g>
      <rect
        x={cx - NODE_W / 2} y={cy - NODE_H / 2}
        width={NODE_W} height={NODE_H}
        rx={5}
        fill="#0f172a"
        stroke={locked ? '#f59e0b' : '#334155'}
        strokeWidth={locked ? 1.5 : 1}
      />
      <text
        x={cx} y={cy}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fill="#64748b" fontFamily="ui-sans-serif,system-ui,sans-serif"
      >
        {truncate(label)}
      </text>

      {handles.map((h) => {
        const pt       = getAnchorPt(cx, cy, h);
        const isSel    = h === selected;
        const isValid  = validSet.has(h);
        const r        = isSel ? DOT_SEL_R : DOT_R;
        const fill     = isSel ? '#3b82f6' : isValid ? '#60a5fa' : '#1e293b';
        const opacity  = isSel ? 1 : isValid ? 0.6 : 0.25;
        const stroke   = isSel ? '#93c5fd' : isValid ? 'none' : '#334155';

        return (
          <circle
            key={h}
            cx={pt.x} cy={pt.y} r={r}
            fill={fill} opacity={opacity}
            stroke={stroke} strokeWidth={isSel ? 1.5 : 1}
            style={{ cursor: isValid ? 'pointer' : 'not-allowed', transition: 'r 0.1s' }}
            onClick={isValid ? () => onPick(h) : undefined}
          />
        );
      })}
    </g>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────

interface AnchorPickerPanelProps {
  srcHandle: LockedHandle;
  tgtHandle: LockedHandle;
  direction: { dx: number; dy: number };
  sourceName: string;
  targetName: string;
  locked: boolean;
  onChangeSrc: (h: LockedHandle) => void;
  onChangeTgt: (h: LockedHandle) => void;
  onUnlock: () => void;
}

export default function AnchorPickerPanel({
  srcHandle, tgtHandle,
  direction: { dx, dy },
  sourceName, targetName,
  locked,
  onChangeSrc, onChangeTgt, onUnlock,
}: AnchorPickerPanelProps) {
  const { t } = useTranslation();

  const { src: srcPos, tgt: tgtPos } = getNodePositions(dx, dy);
  const { srcValid, tgtValid }        = getValidAnchors(dx, dy);

  const srcPt = getAnchorPt(srcPos.cx, srcPos.cy, srcHandle);
  const tgtPt = getAnchorPt(tgtPos.cx, tgtPos.cy, tgtHandle);

  // Shorten line so arrowhead stays visible
  const lineDist = Math.hypot(tgtPt.x - srcPt.x, tgtPt.y - srcPt.y) || 1;
  const ux = (tgtPt.x - srcPt.x) / lineDist;
  const uy = (tgtPt.y - srcPt.y) / lineDist;
  const RETRACT = 9;
  const lineX2 = tgtPt.x - ux * RETRACT;
  const lineY2 = tgtPt.y - uy * RETRACT;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
          {t('vfsEdgeAction.anchorPicker.title')}
        </span>

        {locked ? (
          <button
            type="button"
            onClick={onUnlock}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            <Unlock className="w-3 h-3" />
            {t('vfsEdgeAction.anchorPicker.unlock')}
          </button>
        ) : (
          <span className="text-[10px] text-text-muted italic">
            {t('vfsEdgeAction.anchorPicker.hint')}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-surface-border overflow-hidden bg-[#080f1e]">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width={SVG_W}
          height={SVG_H}
          className="block w-full"
          style={{ maxHeight: SVG_H }}
        >
          <defs>
            <marker
              id="ap-arrow" markerWidth="7" markerHeight="5"
              refX="6" refY="2.5" orient="auto"
            >
              <polygon
                points="0 0, 7 2.5, 0 5"
                fill={locked ? '#f59e0b' : '#475569'}
              />
            </marker>
          </defs>

          {/* Connector line */}
          {lineDist > RETRACT + 2 && (
            <line
              x1={srcPt.x} y1={srcPt.y}
              x2={lineX2}  y2={lineY2}
              stroke={locked ? '#f59e0b' : '#475569'}
              strokeWidth={locked ? 1.5 : 1}
              strokeDasharray={locked ? 'none' : '5 3'}
              markerEnd="url(#ap-arrow)"
            />
          )}

          {/* Source node */}
          <NodeRect
            cx={srcPos.cx} cy={srcPos.cy}
            label={sourceName}
            handles={ALL_HANDLES}
            selected={srcHandle}
            validSet={srcValid}
            locked={locked}
            onPick={(h) => { onChangeSrc(h); }}
          />

          {/* Target node */}
          <NodeRect
            cx={tgtPos.cx} cy={tgtPos.cy}
            label={targetName}
            handles={ALL_HANDLES}
            selected={tgtHandle}
            validSet={tgtValid}
            locked={locked}
            onPick={(h) => { onChangeTgt(h); }}
          />

          {/* "SOURCE" / "TARGET" labels */}
          <text
            x={srcPos.cx} y={srcPos.cy - NODE_H / 2 - 5}
            textAnchor="middle" fontSize={7.5}
            fill="#475569" fontFamily="ui-sans-serif,system-ui,sans-serif"
            letterSpacing={0.5}
          >
            {t('vfsEdgeAction.anchorPicker.source').toUpperCase()}
          </text>
          <text
            x={tgtPos.cx} y={tgtPos.cy - NODE_H / 2 - 5}
            textAnchor="middle" fontSize={7.5}
            fill="#475569" fontFamily="ui-sans-serif,system-ui,sans-serif"
            letterSpacing={0.5}
          >
            {t('vfsEdgeAction.anchorPicker.target').toUpperCase()}
          </text>
        </svg>
      </div>

      {locked && (
        <p className="text-[10px] text-amber-400/70 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
          {t('vfsEdgeAction.anchorPicker.lockedHint')}
        </p>
      )}
    </div>
  );
}
