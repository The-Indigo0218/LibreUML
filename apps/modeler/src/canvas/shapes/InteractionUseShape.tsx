import { useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { InteractionUseViewModel } from '../../adapters/view-models/node.view-model';
import { resolveInteractionUseColors } from '../tokens/colors';
import ResizeHandles from './ResizeHandles';

const LABEL_PAD_X = 6;
const LABEL_PAD_Y = 3;
const LABEL_FONT = 11;
const NAME_FONT = 12;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const MANUAL_STROKE = '#22d3ee';

export function getInteractionUseShapeSize(vm: InteractionUseViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface InteractionUseShapeProps {
  viewModel: InteractionUseViewModel;
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
  /** (id, width, height) — fired when a resize handle is released (G-d). */
  onResizeEnd?: (id: string, width: number, height: number) => void;
}

export default function InteractionUseShape({
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
  onResizeEnd,
}: InteractionUseShapeProps) {
  const colors = resolveInteractionUseColors();
  const [live, setLive] = useState<{ w: number; h: number } | null>(null);
  const W = live?.w ?? vm.width;
  const H = live?.h ?? vm.height;
  const borderColor = vm.isManual ? MANUAL_STROKE : colors.border;

  const labelText = 'ref';
  const labelW = labelText.length * 7 + LABEL_PAD_X * 2;
  const labelH = LABEL_FONT + LABEL_PAD_Y * 2;

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
      {/* ── Outer box ─────────────────────────────────────────────────────── */}
      <Rect
        width={W}
        height={H}
        stroke={borderColor}
        strokeWidth={vm.isManual ? 1.5 : 1}
        fill={colors.fill}
        perfectDrawEnabled={false}
      />

      {/* ── Corner "ref" tab ──────────────────────────────────────────────── */}
      <Rect
        width={labelW}
        height={labelH}
        fill={colors.labelBg}
        stroke={colors.border}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Text
        x={LABEL_PAD_X}
        y={LABEL_PAD_Y}
        text={labelText}
        fontSize={LABEL_FONT}
        fontFamily={FONT_SANS}
        fontStyle="bold"
        fill={colors.labelText}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Referenced interaction name (centred) ─────────────────────────── */}
      <Text
        x={0}
        y={(H - NAME_FONT) / 2 + labelH / 4}
        width={W}
        text={vm.label}
        fontSize={NAME_FONT}
        fontFamily={FONT_SANS}
        fontStyle="bold"
        fill={colors.refText}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Resize handles (G-d) ──────────────────────────────────────────── */}
      {onResizeEnd && (
        <ResizeHandles
          w={W}
          h={H}
          minW={40}
          minH={24}
          onResize={(nw, nh) => setLive({ w: nw, h: nh })}
          onCommit={(nw, nh) => {
            setLive(null);
            onResizeEnd(vm.id, nw, nh);
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
          strokeWidth={2}
          dash={[4, 3]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
