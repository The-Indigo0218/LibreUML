import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { SystemBoundaryViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { resolveSystemBoundaryColors } from '../tokens/colors';

// ─── Layout constants ──────────────────────────────────────────────────────────

export const SB_DEFAULT_W = 420;
export const SB_DEFAULT_H = 320;
const TITLE_FONT = 13;
const TITLE_H = 22;
const TITLE_PAD_X = 10;
const TITLE_PAD_Y = 4;
const STROKE_W = 1.5;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

export function getSystemBoundaryShapeSize(vm: SystemBoundaryViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface SystemBoundaryShapeProps {
  viewModel: SystemBoundaryViewModel;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

export default function SystemBoundaryShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onDblClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDragMove,
  onDragEnd,
}: SystemBoundaryShapeProps) {
  const colors = resolveSystemBoundaryColors();
  const W = vm.width;
  const H = vm.height;

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
    >
      {/* ── Dashed boundary rectangle ─────────────────────────────────────── */}
      <Rect
        width={W}
        height={H}
        fill="transparent"
        stroke={colors.stroke}
        strokeWidth={STROKE_W}
        dash={[8, 5]}
        perfectDrawEnabled={false}
      />

      {/* ── System name label at top-left inside border ───────────────────── */}
      <Text
        x={TITLE_PAD_X}
        y={TITLE_PAD_Y}
        width={W - TITLE_PAD_X * 2}
        text={vm.name}
        fontSize={TITLE_FONT}
        fontFamily={FONT_SANS}
        fill={colors.text}
        align="left"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Thin separator below title ────────────────────────────────────── */}
      <Rect
        x={0}
        y={TITLE_PAD_Y + TITLE_H}
        width={W}
        height={1}
        fill={colors.stroke}
        opacity={0.4}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Hit target (border region only — not the interior) ────────────── */}
      {/* Top strip */}
      <Rect x={0} y={0} width={W} height={TITLE_H + TITLE_PAD_Y + 4} listening={true} />
      {/* Bottom strip */}
      <Rect x={0} y={H - 8} width={W} height={8} listening={true} />
      {/* Left strip */}
      <Rect x={0} y={0} width={8} height={H} listening={true} />
      {/* Right strip */}
      <Rect x={W - 8} y={0} width={8} height={H} listening={true} />

      {/* ── Selection outline ─────────────────────────────────────────────── */}
      {selected && (
        <Rect
          x={-2}
          y={-2}
          width={W + 4}
          height={H + 4}
          stroke="#22d3ee"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
