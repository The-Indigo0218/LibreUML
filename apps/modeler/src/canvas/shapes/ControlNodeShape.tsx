import { Group, Circle, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivityControlNodeViewModel } from '../../adapters/view-models/node.view-model';

const FILLED = '#e0f2fe';
const BORDER = '#38bdf8';
const SELECTED = '#22d3ee';

/** Outer diameter. Control nodes are a fixed size — there is nothing to resize. */
const SIZE = 28;
/** Filled disc inside the ring of an activity-final node. */
const INNER_RATIO = 0.55;

export function getControlNodeShapeSize(
  _vm: ActivityControlNodeViewModel,
): { width: number; height: number } {
  return { width: SIZE, height: SIZE };
}

interface ControlNodeShapeProps {
  viewModel: ActivityControlNodeViewModel;
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
 * UML 2.5 §15.3 control nodes — initial (filled disc), activity final (filled
 * disc inside a ring) and flow final (circled X). They carry no label: the
 * glyph is the meaning, which is why the view model has no `label`.
 */
export default function ControlNodeShape({
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
}: ControlNodeShapeProps) {
  const r = SIZE / 2;
  const stroke = selected ? SELECTED : BORDER;
  const fill = vm.colorOverride ?? FILLED;
  const strokeWidth = selected ? 2.5 : 2;

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
      {vm.controlKind === 'INITIAL' && (
        <Circle
          x={r}
          y={r}
          radius={r - 2}
          fill={fill}
          stroke={selected ? SELECTED : undefined}
          strokeWidth={selected ? strokeWidth : 0}
          perfectDrawEnabled={false}
        />
      )}

      {vm.controlKind === 'ACTIVITY_FINAL' && (
        <>
          <Circle
            x={r}
            y={r}
            radius={r - 2}
            stroke={stroke}
            strokeWidth={strokeWidth}
            perfectDrawEnabled={false}
          />
          <Circle
            x={r}
            y={r}
            radius={(r - 2) * INNER_RATIO}
            fill={fill}
            perfectDrawEnabled={false}
          />
        </>
      )}

      {vm.controlKind === 'FLOW_FINAL' && (
        <>
          <Circle
            x={r}
            y={r}
            radius={r - 2}
            stroke={stroke}
            strokeWidth={strokeWidth}
            perfectDrawEnabled={false}
          />
          <Line
            points={[r * 0.6, r * 0.6, r * 1.4, r * 1.4]}
            stroke={stroke}
            strokeWidth={strokeWidth}
            perfectDrawEnabled={false}
          />
          <Line
            points={[r * 1.4, r * 0.6, r * 0.6, r * 1.4]}
            stroke={stroke}
            strokeWidth={strokeWidth}
            perfectDrawEnabled={false}
          />
        </>
      )}
    </Group>
  );
}
