import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { StateInvariantViewModel } from '../../adapters/view-models/node.view-model';
import { resolveStateInvariantColors } from '../tokens/colors';

const LABEL_FONT = 11;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

export function getStateInvariantShapeSize(vm: StateInvariantViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface StateInvariantShapeProps {
  viewModel: StateInvariantViewModel;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
}

export default function StateInvariantShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onDblClick,
  onContextMenu,
}: StateInvariantShapeProps) {
  const colors = resolveStateInvariantColors();
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
      {/* ── State symbol (stadium / rounded rectangle) ──────────────────────── */}
      <Rect
        width={W}
        height={H}
        cornerRadius={H / 2}
        fill={colors.fill}
        stroke={colors.border}
        strokeWidth={1.5}
        perfectDrawEnabled={false}
      />

      {/* ── Constraint text wrapped in braces ──────────────────────────────── */}
      <Text
        x={0}
        y={(H - LABEL_FONT) / 2}
        width={W}
        text={`{${vm.constraint}}`}
        fontSize={LABEL_FONT}
        fontFamily={FONT_SANS}
        fontStyle="italic"
        fill={colors.text}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {selected && (
        <Rect
          x={-2}
          y={-2}
          width={W + 4}
          height={H + 4}
          cornerRadius={H / 2 + 2}
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
