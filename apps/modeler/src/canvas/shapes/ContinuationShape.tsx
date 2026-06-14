import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ContinuationViewModel } from '../../adapters/view-models/node.view-model';

const LABEL_FONT = 12;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FILL = '#1e2a44';
const BORDER = '#818cf8';
const TEXT = '#c7d2fe';

export function getContinuationShapeSize(vm: ContinuationViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface ContinuationShapeProps {
  viewModel: ContinuationViewModel;
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
 * UML 2.5 §17.3 Continuation — a named stadium box spanning lifelines. Same
 * slot-anchored vertical-drag behaviour as interaction uses / state invariants.
 */
export default function ContinuationShape({
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
}: ContinuationShapeProps) {
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
      {/* Stadium box (fully rounded ends) */}
      <Rect
        width={W}
        height={H}
        cornerRadius={H / 2}
        fill={FILL}
        stroke={selected ? '#22d3ee' : BORDER}
        strokeWidth={selected ? 2 : 1.5}
        perfectDrawEnabled={false}
      />
      <Text
        x={8}
        y={(H - LABEL_FONT) / 2}
        width={W - 16}
        text={vm.label}
        fontSize={LABEL_FONT}
        fontFamily={FONT_SANS}
        fontStyle="bold"
        fill={TEXT}
        align="center"
        ellipsis
        wrap="none"
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
