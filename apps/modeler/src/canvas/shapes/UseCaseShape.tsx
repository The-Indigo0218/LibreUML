import { Group, Ellipse, Text, Line, Rect, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { UseCaseViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { resolveUseCaseColors } from '../tokens/colors';
import { measureTextWidth } from './measureText';

// ─── Layout constants ──────────────────────────────────────────────────────────

const MIN_W = 140;
const MAX_W = 280;
const BASE_H = 56;
const EP_H = 16;
const EP_SEP_PAD = 6;
const EP_FONT = 11;
const NAME_FONT = 13;
const STROKE_W = 1.5;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FONT_MONO = '"Fira Code", monospace';
const H_PAD = 16;
const SPEC_DOT_R = 4;   // radius of the "has spec" indicator dot

export function getUseCaseShapeSize(vm: UseCaseViewModel): { width: number; height: number } {
  const nameW = measureTextWidth(vm.name, `${NAME_FONT}px ${FONT_SANS}`) + H_PAD * 2;
  const epW = vm.extensionPoints.length > 0
    ? Math.max(...vm.extensionPoints.map(ep =>
        measureTextWidth(ep, `${EP_FONT}px ${FONT_MONO}`) + H_PAD * 2,
      ))
    : 0;
  const width = Math.min(MAX_W, Math.max(MIN_W, nameW, epW));
  const epBlock = vm.extensionPoints.length > 0
    ? EP_SEP_PAD + 1 + EP_SEP_PAD + vm.extensionPoints.length * EP_H
    : 0;
  const height = BASE_H + epBlock;
  return { width, height };
}

interface UseCaseShapeProps {
  viewModel: UseCaseViewModel;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  onMouseEnter?: (e: KonvaEventObject<MouseEvent>, id: string) => void;
  onMouseLeave?: (e: KonvaEventObject<MouseEvent>, id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

export default function UseCaseShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onDblClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  draggable,
  onDragStart,
  onDragMove,
  onDragEnd,
}: UseCaseShapeProps) {
  const colors = resolveUseCaseColors();
  const { width: W, height: H } = getUseCaseShapeSize(vm);
  const cx = W / 2;
  const cy = H / 2;
  const rx = cx - 2;
  const ry = cy - 2;
  const hasEP = vm.extensionPoints.length > 0;
  const sepY = BASE_H - EP_SEP_PAD - 1;

  return (
    <Group
      id={vm.id}
      x={x}
      y={y}
      opacity={opacity}
      visible={visible}
      listening={true}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.cancelBubble = true;
        onNodeClick?.(vm.id, e.evt.ctrlKey || e.evt.metaKey);
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        onDblClick?.(e);
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        onContextMenu?.(e, vm.id);
      }}
      onMouseEnter={(e) => onMouseEnter?.(e, vm.id)}
      onMouseLeave={(e) => onMouseLeave?.(e, vm.id)}
    >
      {/* ── Ellipse body ────────────────────────────────────────────────────── */}
      <Ellipse
        x={cx}
        y={cy}
        radiusX={rx}
        radiusY={ry}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={STROKE_W}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* ── Use case name ───────────────────────────────────────────────────── */}
      <Text
        x={H_PAD}
        y={BASE_H / 2 - NAME_FONT / 2 - (hasEP ? 4 : 0)}
        width={W - H_PAD * 2}
        text={vm.name}
        fontSize={NAME_FONT}
        fontFamily={FONT_SANS}
        fill={colors.text}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Extension points ─────────────────────────────────────────────────── */}
      {hasEP && (
        <>
          <Line
            points={[cx - rx + 4, sepY, cx + rx - 4, sepY]}
            stroke={colors.stroke}
            strokeWidth={1}
            dash={[3, 2]}
            listening={false}
          />
          {vm.extensionPoints.map((ep, i) => (
            <Text
              key={i}
              x={H_PAD}
              y={BASE_H + EP_SEP_PAD + i * EP_H}
              width={W - H_PAD * 2}
              text={ep}
              fontSize={EP_FONT}
              fontFamily={FONT_MONO}
              fill={colors.text}
              align="center"
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}
        </>
      )}

      {/* ── "Has spec" indicator dot (top-right of ellipse) ──────────────────── */}
      {vm.hasSpec && (
        <Circle
          x={cx + rx - SPEC_DOT_R - 1}
          y={cy - ry + SPEC_DOT_R + 1}
          radius={SPEC_DOT_R}
          fill="#f59e0b"
          stroke="#ffffff"
          strokeWidth={1}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* ── Transparent hit-target ──────────────────────────────────────────── */}
      <Rect width={W} height={H} listening={true} />

      {/* ── Selection outline ───────────────────────────────────────────────── */}
      {selected && (
        <Ellipse
          x={cx}
          y={cy}
          radiusX={rx + 3}
          radiusY={ry + 3}
          stroke="#22d3ee"
          strokeWidth={2}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
