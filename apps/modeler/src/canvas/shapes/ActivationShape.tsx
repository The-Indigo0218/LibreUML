import { Group, Rect, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivationViewModel } from '../../adapters/view-models/node.view-model';
import { resolveActivationColors } from '../tokens/colors';

const DEFAULT_WIDTH = 10;
const NESTING_OFFSET = 6;

export function getActivationShapeSize(vm: ActivationViewModel): { width: number; height: number } {
  return {
    width: vm.width || DEFAULT_WIDTH,
    height: vm.height,
  };
}

interface ActivationShapeProps {
  viewModel: ActivationViewModel;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
}

/**
 * Execution Specification (activation bar). Geometry is fully system-managed —
 * the bar is anchored to its lifeline (X auto, fixed width) and its height is
 * the derived execution span, so it is neither draggable nor resizable. It is
 * still selectable for inspection / deletion via context menu.
 */
export default function ActivationShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onContextMenu,
}: ActivationShapeProps) {
  const colors = resolveActivationColors();
  const W = vm.width || DEFAULT_WIDTH;
  const nestingX = vm.nestingDepth * NESTING_OFFSET;
  const H = vm.height;

  return (
    <Group
      id={vm.id}
      x={x + nestingX - W / 2}
      y={y}
      opacity={opacity}
      visible={visible}
      listening={true}
      onClick={(e) => {
        e.cancelBubble = true;
        onNodeClick?.(vm.id, e.evt.ctrlKey || e.evt.metaKey);
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        onContextMenu?.(e, vm.id);
      }}
    >
      <Rect
        width={W}
        height={H}
        fill={colors.fill}
        stroke={colors.border}
        strokeWidth={1}
        listening={true}
        perfectDrawEnabled={false}
      />

      {/* Dashed bottom edge for open activations (no REPLY yet). */}
      {vm.isOpen && (
        <Line
          points={[0, H, W, H]}
          stroke={colors.border}
          strokeWidth={1.5}
          dash={[3, 3]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {selected && (
        <Rect
          x={-2}
          y={-2}
          width={W + 4}
          height={H + 4}
          stroke="#22d3ee"
          strokeWidth={1.5}
          dash={[3, 3]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
