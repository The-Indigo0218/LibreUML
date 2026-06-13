import { useState } from 'react';
import { Group, Rect, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivationViewModel } from '../../adapters/view-models/node.view-model';
import { resolveActivationColors } from '../tokens/colors';

const DEFAULT_WIDTH = 10;
const NESTING_OFFSET = 6;
const MIN_HEIGHT = 20;
const HANDLE_H = 6;

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
  draggable?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  /** (id, width, height) — fired when the bottom resize handle is released. */
  onResizeEnd?: (id: string, width: number, height: number) => void;
}

export default function ActivationShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  draggable = false,
  onNodeClick,
  onContextMenu,
  onDragEnd,
  dragBoundFunc,
  onDblClick,
  onResizeEnd,
}: ActivationShapeProps) {
  const colors = resolveActivationColors();
  const W = vm.width || DEFAULT_WIDTH;
  const nestingX = vm.nestingDepth * NESTING_OFFSET;

  // Live height while the bottom handle is dragged; null = use the derived height.
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  const H = liveHeight ?? vm.height;

  return (
    <Group
      id={vm.id}
      x={x + nestingX - W / 2}
      y={y}
      opacity={opacity}
      visible={visible}
      listening={true}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      onDragEnd={onDragEnd}
      onDblClick={onDblClick}
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
        stroke={vm.isManual ? '#22d3ee' : colors.border}
        strokeWidth={vm.isManual ? 1.5 : 1}
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

      {/* Bottom resize handle — pins manual height. Vertical-only. */}
      {onResizeEnd && (
        <Rect
          x={-2}
          y={H - HANDLE_H / 2}
          width={W + 4}
          height={HANDLE_H}
          fill="transparent"
          draggable
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'ns-resize';
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'default';
          }}
          dragBoundFunc={function (pos) {
            // Lock X; the handle only moves vertically.
            return { x: this.getAbsolutePosition().x, y: pos.y };
          }}
          onDragStart={(e) => { e.cancelBubble = true; }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const next = Math.max(MIN_HEIGHT, e.target.y() + HANDLE_H / 2);
            setLiveHeight(next);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const next = Math.max(MIN_HEIGHT, e.target.y() + HANDLE_H / 2);
            setLiveHeight(null);
            // Reset the handle's transient position; geometry comes from the store.
            e.target.position({ x: -2, y: vm.height - HANDLE_H / 2 });
            onResizeEnd?.(vm.id, W, next);
          }}
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
