import { Group, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivityDecisionViewModel } from '../../adapters/view-models/node.view-model';

const FILLED = '#e0f2fe';
const BORDER = '#38bdf8';
const SELECTED = '#22d3ee';

/** Fixed diamond footprint. Decision/merge carry no label — the branch
 *  condition lives on the edges (`guard`), not the node — so there is
 *  nothing to size around. */
const WIDTH = 44;
const HEIGHT = 34;

export function getDecisionShapeSize(
  _vm: ActivityDecisionViewModel,
): { width: number; height: number } {
  return { width: WIDTH, height: HEIGHT };
}

interface DecisionShapeProps {
  viewModel: ActivityDecisionViewModel;
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
 * UML 2.5 §15.3 decision/merge node — a rhombus. One shape for both: the
 * glyph is identical, only the fan direction (out for decision, in for merge)
 * differs, and that is the validator's concern (§11 A2), not the shape's.
 */
export default function DecisionShape({
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
}: DecisionShapeProps) {
  const stroke = selected ? SELECTED : BORDER;
  const fill = vm.colorOverride ?? FILLED;
  const strokeWidth = selected ? 2.5 : 2;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

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
      <Line
        points={[cx, 0, WIDTH, cy, cx, HEIGHT, 0, cy]}
        closed
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
