import { Group, Arrow } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { GeneralOrderingViewModel } from '../../adapters/view-models/node.view-model';

const LINE_COLOR = '#64748b';
const SELECTED_COLOR = '#22d3ee';

export function getGeneralOrderingShapeSize(vm: GeneralOrderingViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface GeneralOrderingShapeProps {
  viewModel: GeneralOrderingViewModel;
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
 * UML 2.5 §17.2 GeneralOrdering — a dotted arrow forcing a temporal order
 * between two message occurrences (`before → after`). Geometry is fully derived
 * from its two anchored messages, so the shape is not draggable.
 */
export default function GeneralOrderingShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onDblClick,
  onContextMenu,
}: GeneralOrderingShapeProps) {
  const color = selected ? SELECTED_COLOR : LINE_COLOR;

  return (
    <Group
      id={vm.id}
      x={x}
      y={y}
      opacity={opacity}
      visible={visible}
      listening={true}
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
      <Arrow
        points={[vm.from.x, vm.from.y, vm.to.x, vm.to.y]}
        stroke={color}
        strokeWidth={selected ? 2 : 1.5}
        fill={color}
        dash={[5, 4]}
        pointerLength={8}
        pointerWidth={7}
        hitStrokeWidth={12}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
