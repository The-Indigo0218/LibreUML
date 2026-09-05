import { Group, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { CoregionViewModel } from '../../adapters/view-models/node.view-model';

const LINE_COLOR = '#94a3b8';
const SELECTED_COLOR = '#22d3ee';
const TICK = 7; // length of the bracket's bent ends

export function getCoregionShapeSize(vm: CoregionViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface CoregionShapeProps {
  viewModel: CoregionViewModel;
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
 * UML 2.5 §17.4 Coregion — square brackets `[ ]` over a vertical span of a
 * single lifeline marking an unordered region. The top bracket opens downward,
 * the bottom opens upward. Geometry is derived → not draggable.
 */
export default function CoregionShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onDblClick,
  onContextMenu,
}: CoregionShapeProps) {
  const color = selected ? SELECTED_COLOR : LINE_COLOR;
  const W = vm.width;
  const H = vm.height;
  const sw = selected ? 2.5 : 2;

  return (
    <Group
      id={vm.id}
      x={x}
      y={y}
      opacity={opacity}
      visible={visible}
      listening
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
      {/* Top bracket: horizontal bar with both ends bending DOWN. */}
      <Line
        points={[0, TICK, 0, 0, W, 0, W, TICK]}
        stroke={color}
        strokeWidth={sw}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={10}
        perfectDrawEnabled={false}
      />
      {/* Bottom bracket: horizontal bar with both ends bending UP. */}
      <Line
        points={[0, H - TICK, 0, H, W, H, W, H - TICK]}
        stroke={color}
        strokeWidth={sw}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={10}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
