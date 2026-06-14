import { useState } from 'react';
import { Group, Rect, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { FragmentViewModel } from '../../adapters/view-models/node.view-model';
import { resolveFragmentColors } from '../tokens/colors';
import ResizeHandles from './ResizeHandles';

const NESTING_OFFSET = 8;
const LABEL_PAD_X = 6;
const LABEL_PAD_Y = 3;
const LABEL_FONT = 11;
const GUARD_FONT = 11;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const MIN_W = 60;
const MIN_H = 36;
const MANUAL_STROKE = '#22d3ee';

export function getFragmentShapeSize(vm: FragmentViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface FragmentShapeProps {
  viewModel: FragmentViewModel;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  draggable?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
  /** (id, width, height) — fired when a resize handle is released. */
  onResizeEnd?: (id: string, width: number, height: number) => void;
}

export default function FragmentShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  draggable = false,
  onNodeClick,
  onDblClick,
  onContextMenu,
  onDragEnd,
  dragBoundFunc,
  onResizeEnd,
}: FragmentShapeProps) {
  const colors = resolveFragmentColors();
  const nestingX = vm.nestingDepth * NESTING_OFFSET;
  const W = vm.width;
  const H = vm.height;

  // Live size while a resize handle is dragged; null = use the derived size.
  const [live, setLive] = useState<{ w: number; h: number } | null>(null);
  const w = live?.w ?? W;
  const h = live?.h ?? H;

  // IGNORE/CONSIDER carry an explicit message set, rendered UML-style as
  // `ignore {m1, m2}` right in the corner-tab label.
  const showsSet =
    (vm.fragmentKind === 'IGNORE' || vm.fragmentKind === 'CONSIDER') &&
    !!vm.messageSet?.length;
  const labelText = showsSet
    ? `${vm.fragmentKind.toLowerCase()} {${vm.messageSet!.join(', ')}}`
    : vm.fragmentKind.toLowerCase();
  // Approximate label width (Konva can't measure synchronously cheap; use char count).
  const labelW = labelText.length * 7 + LABEL_PAD_X * 2;
  const labelH = LABEL_FONT + LABEL_PAD_Y * 2;

  const borderColor = vm.isManual ? MANUAL_STROKE : colors.border;

  return (
    <Group
      id={vm.id}
      x={x + nestingX}
      y={y}
      opacity={opacity}
      visible={visible}
      listening={true}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
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
      {/* ── Outer bounding rect (no fill so messages remain interactive) ── */}
      <Rect
        width={w}
        height={h}
        stroke={borderColor}
        strokeWidth={vm.isManual ? 1.5 : 1}
        fill="transparent"
        perfectDrawEnabled={false}
      />

      {/* ── Corner tab with fragment kind label ──────────────────────────── */}
      <Rect
        width={labelW}
        height={labelH}
        fill={colors.labelBg}
        stroke={colors.border}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Text
        x={LABEL_PAD_X}
        y={LABEL_PAD_Y}
        text={labelText}
        fontSize={LABEL_FONT}
        fontFamily={FONT_SANS}
        fontStyle="bold"
        fill={colors.labelText}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Guard text of the first operand (top-right of header band) ──── */}
      {vm.operands[0]?.guard && (
        <Text
          x={labelW + 8}
          y={LABEL_PAD_Y}
          text={`[${vm.operands[0].guard}]`}
          fontSize={GUARD_FONT}
          fontFamily={FONT_SANS}
          fill={colors.guardText}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* ── Operand separators (dashed lines between operands) ──────────── */}
      {vm.operands.slice(1).map((op) => (
        <Group key={op.id}>
          <Line
            points={[0, op.yOffset, w, op.yOffset]}
            stroke={colors.separator}
            strokeWidth={1}
            dash={[5, 4]}
            listening={false}
            perfectDrawEnabled={false}
          />
          {op.guard && (
            <Text
              x={LABEL_PAD_X}
              y={op.yOffset + 4}
              text={`[${op.guard}]`}
              fontSize={GUARD_FONT}
              fontFamily={FONT_SANS}
              fill={colors.guardText}
              listening={false}
              perfectDrawEnabled={false}
            />
          )}
        </Group>
      ))}

      {/* ── Resize handles: right (width), bottom (height), corner (both) ── */}
      {onResizeEnd && (
        <ResizeHandles
          w={w}
          h={h}
          minW={MIN_W}
          minH={MIN_H}
          onResize={(nw, nh) => setLive({ w: nw, h: nh })}
          onCommit={(nw, nh) => {
            setLive(null);
            onResizeEnd(vm.id, nw, nh);
          }}
        />
      )}

      {selected && (
        <Rect
          x={-2}
          y={-2}
          width={w + 4}
          height={h + 4}
          stroke={MANUAL_STROKE}
          strokeWidth={2}
          dash={[4, 3]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
