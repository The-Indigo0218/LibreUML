import { Group, Rect, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { FragmentViewModel } from '../../adapters/view-models/node.view-model';
import { resolveFragmentColors } from '../tokens/colors';

const NESTING_OFFSET = 8;
const LABEL_PAD_X = 6;
const LABEL_PAD_Y = 3;
const LABEL_FONT = 11;
const GUARD_FONT = 11;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

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
}

export default function FragmentShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onDblClick,
  onContextMenu,
}: FragmentShapeProps) {
  const colors = resolveFragmentColors();
  const nestingX = vm.nestingDepth * NESTING_OFFSET;
  const W = vm.width;
  const H = vm.height;

  const labelText = vm.fragmentKind.toLowerCase();
  // Approximate label width (Konva can't measure synchronously cheap; use char count).
  const labelW = labelText.length * 7 + LABEL_PAD_X * 2;
  const labelH = LABEL_FONT + LABEL_PAD_Y * 2;

  return (
    <Group
      id={vm.id}
      x={x + nestingX}
      y={y}
      opacity={opacity}
      visible={visible}
      listening={true}
      draggable={false}
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
        width={W}
        height={H}
        stroke={colors.border}
        strokeWidth={1}
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
            points={[0, op.yOffset, W, op.yOffset]}
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

      {selected && (
        <Rect
          x={-2}
          y={-2}
          width={W + 4}
          height={H + 4}
          stroke="#22d3ee"
          strokeWidth={2}
          dash={[4, 3]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
