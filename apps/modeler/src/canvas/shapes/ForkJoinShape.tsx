import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivityForkJoinViewModel } from '../../adapters/view-models/node.view-model';

const FILL = '#38bdf8';
const SELECTED = '#22d3ee';

/** Bar length along its axis; thickness across it. Fixed — nothing to resize. */
const LENGTH = 70;
const THICKNESS = 10;

export function getForkJoinShapeSize(
  vm: ActivityForkJoinViewModel,
): { width: number; height: number } {
  return vm.barOrientation === 'VERTICAL'
    ? { width: THICKNESS, height: LENGTH }
    : { width: LENGTH, height: THICKNESS };
}

interface ForkJoinShapeProps {
  viewModel: ActivityForkJoinViewModel;
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

/**
 * UML 2.5 §15.3 fork/join — a synchronization bar, drawn solid per spec (no
 * outline/fill distinction). One shape for both; direction of fan (out for
 * fork, in for join) is a validator concern (§11 A2), not a rendering one.
 * `barOrientation` (persisted on the IR node) picks the bar's axis.
 */
export default function ForkJoinShape({
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
}: ForkJoinShapeProps) {
  const { width, height } = getForkJoinShapeSize(vm);
  const fill = vm.colorOverride ?? FILL;

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
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={selected ? SELECTED : undefined}
        strokeWidth={selected ? 2.5 : 0}
        cornerRadius={1}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
