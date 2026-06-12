import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { GateViewModel } from '../../adapters/view-models/node.view-model';
import { resolveGateColors } from '../tokens/colors';

const LABEL_FONT = 10;
const LABEL_GAP = 4;
const LABEL_W = 90;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

export function getGateShapeSize(vm: GateViewModel): { width: number; height: number } {
  return { width: vm.size, height: vm.size };
}

interface GateShapeProps {
  viewModel: GateViewModel;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  draggable?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

export default function GateShape({
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
  onDragStart,
  onDragMove,
  onDragEnd,
  dragBoundFunc,
}: GateShapeProps) {
  const colors = resolveGateColors();
  const S = vm.size;
  // Label sits outside the fragment: left of a LEFT gate, right of a RIGHT gate.
  const labelX = vm.side === 'LEFT' ? -LABEL_W - LABEL_GAP : S + LABEL_GAP;
  const labelAlign = vm.side === 'LEFT' ? 'right' : 'left';

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
      dragBoundFunc={dragBoundFunc}
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
      {/* ── Gate square straddling the fragment border ────────────────────── */}
      <Rect
        width={S}
        height={S}
        fill={colors.fill}
        stroke={colors.border}
        strokeWidth={1.5}
        perfectDrawEnabled={false}
      />

      {/* ── Gate name (outside the fragment) ──────────────────────────────── */}
      {vm.name && (
        <Text
          x={labelX}
          y={(S - LABEL_FONT) / 2}
          width={LABEL_W}
          text={vm.name}
          fontSize={LABEL_FONT}
          fontFamily={FONT_SANS}
          fill={colors.text}
          align={labelAlign}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {selected && (
        <Rect
          x={-2}
          y={-2}
          width={S + 4}
          height={S + 4}
          stroke="#22d3ee"
          strokeWidth={2}
          dash={[3, 2]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
