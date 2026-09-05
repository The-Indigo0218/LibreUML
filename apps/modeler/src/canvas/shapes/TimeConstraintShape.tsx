import { Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { TimeConstraintViewModel } from '../../adapters/view-models/node.view-model';

const LABEL_FONT = 11;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const LINE_COLOR = '#0891b2';
const TEXT_COLOR = '#67e8f9';
const SELECTED_COLOR = '#22d3ee';
const TICK = 6;
const LABEL_GAP = 12;

export function getTimeConstraintShapeSize(vm: TimeConstraintViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface TimeConstraintShapeProps {
  viewModel: TimeConstraintViewModel;
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

/**
 * UML 2.5 §17.2 timing constraint. DURATION renders as a vertical bracket
 * between two occurrences with the interval label; TIME renders as a small tick
 * at one occurrence with the time label. Geometry is derived → not draggable.
 */
export default function TimeConstraintShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onDblClick,
  onContextMenu,
}: TimeConstraintShapeProps) {
  const stroke = selected ? SELECTED_COLOR : LINE_COLOR;
  const fill = selected ? SELECTED_COLOR : TEXT_COLOR;
  const label = `{${vm.expression}}`;

  const handlers = {
    onClick: (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onNodeClick?.(vm.id, e.evt.ctrlKey || e.evt.metaKey);
    },
    onDblClick: (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onDblClick?.(e);
    },
    onContextMenu: (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      e.cancelBubble = true;
      onContextMenu?.(e, vm.id);
    },
  };

  if (vm.constraintKind === 'DURATION' && vm.to) {
    const y1 = vm.from.y;
    const y2 = vm.to.y;
    const midY = (y1 + y2) / 2;
    return (
      <Group id={vm.id} x={x} y={y} opacity={opacity} visible={visible} listening {...handlers}>
        {/* Vertical bar with end caps */}
        <Line points={[0, y1, 0, y2]} stroke={stroke} strokeWidth={selected ? 2 : 1.5} hitStrokeWidth={10} perfectDrawEnabled={false} />
        <Line points={[-TICK, y1, TICK, y1]} stroke={stroke} strokeWidth={1.5} perfectDrawEnabled={false} />
        <Line points={[-TICK, y2, TICK, y2]} stroke={stroke} strokeWidth={1.5} perfectDrawEnabled={false} />
        <Text
          x={LABEL_GAP}
          y={midY - LABEL_FONT / 2}
          text={label}
          fontSize={LABEL_FONT}
          fontFamily={FONT_SANS}
          fontStyle="italic"
          fill={fill}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }

  // TIME — tick at the occurrence + label.
  return (
    <Group id={vm.id} x={x} y={y} opacity={opacity} visible={visible} listening {...handlers}>
      <Line points={[-TICK, 0, TICK, 0]} stroke={stroke} strokeWidth={selected ? 2 : 1.5} hitStrokeWidth={10} perfectDrawEnabled={false} />
      <Text
        x={LABEL_GAP}
        y={-LABEL_FONT / 2}
        text={label}
        fontSize={LABEL_FONT}
        fontFamily={FONT_SANS}
        fontStyle="italic"
        fill={fill}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
