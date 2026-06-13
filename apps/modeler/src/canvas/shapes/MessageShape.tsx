import { Group, Line, Text, Arrow, Rect, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { MessageViewModel } from '../../adapters/view-models/node.view-model';
import { resolveMessageColors } from '../tokens/colors';

const LABEL_FONT = 12;
const LABEL_H = 16;
const STROKE_W = 1.5;
const ARROW_HEAD = 10;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const SELF_LOOP_W = 40;
const SELF_LOOP_H = 24;

export function getMessageShapeSize(vm: MessageViewModel): { width: number; height: number } {
  if (vm.isSelfMessage) {
    return { width: SELF_LOOP_W, height: SELF_LOOP_H + LABEL_H };
  }
  return {
    width: Math.abs(vm.length),
    height: LABEL_H + STROKE_W,
  };
}

interface MessageShapeProps {
  viewModel: MessageViewModel;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  draggable?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

export default function MessageShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  draggable,
  onNodeClick,
  onDblClick,
  onContextMenu,
  onDragEnd,
  dragBoundFunc,
}: MessageShapeProps) {
  const colors = resolveMessageColors();
  // Hybrid layout (B2): a manually-pinned message draws cyan, matching the
  // activation override affordance, so it reads as "off the auto grid".
  const strokeColor = vm.isManualY ? '#0891b2' : colors.stroke;
  // CREATE messages are drawn dashed with an open head (UML 2.5); DESTROY uses
  // the solid closed-head style — its target lifeline carries the ✕ marker.
  const dashed = vm.messageKind === 'REPLY' || vm.messageKind === 'CREATE';
  const openHead =
    vm.messageKind === 'ASYNC' || vm.messageKind === 'REPLY' || vm.messageKind === 'CREATE';
  // UML 2.5: a message-level guard renders as `[guard]` before the name (C8).
  const guardSegment = vm.guard ? `[${vm.guard}] ` : '';
  const labelText = vm.name
    ? `${vm.displayNumber}: ${guardSegment}${vm.name}`
    : `${vm.displayNumber}: ${guardSegment}`.trimEnd();

  const labelY = -LABEL_H - 2;
  const labelW = Math.max(40, Math.abs(vm.length));

  // ─── Self-message ─────────────────────────────────────────────────────────
  if (vm.isSelfMessage) {
    return (
      <Group
        id={vm.id}
        x={x}
        y={y}
        opacity={opacity}
        visible={visible}
        draggable={draggable}
        onDragEnd={onDragEnd}
        dragBoundFunc={dragBoundFunc}
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
        {/* Wide invisible hit-target along the loop band. */}
        <Rect
          x={0}
          y={labelY}
          width={SELF_LOOP_W + 8}
          height={SELF_LOOP_H + LABEL_H + 4}
          listening={true}
        />

        {/* Top edge — outbound */}
        <Line
          points={[0, 0, SELF_LOOP_W, 0]}
          stroke={strokeColor}
          strokeWidth={STROKE_W}
          dash={dashed ? [5, 4] : undefined}
          listening={false}
          perfectDrawEnabled={false}
        />
        {/* Right edge */}
        <Line
          points={[SELF_LOOP_W, 0, SELF_LOOP_W, SELF_LOOP_H]}
          stroke={strokeColor}
          strokeWidth={STROKE_W}
          dash={dashed ? [5, 4] : undefined}
          listening={false}
          perfectDrawEnabled={false}
        />
        {/* Bottom edge — inbound arrow back to lifeline */}
        <Arrow
          points={[SELF_LOOP_W, SELF_LOOP_H, 0, SELF_LOOP_H]}
          stroke={strokeColor}
          fill={openHead ? undefined : colors.fill}
          strokeWidth={STROKE_W}
          dash={dashed ? [5, 4] : undefined}
          pointerLength={ARROW_HEAD}
          pointerWidth={ARROW_HEAD - 2}
          listening={false}
          perfectDrawEnabled={false}
        />

        <Text
          x={SELF_LOOP_W + 4}
          y={SELF_LOOP_H / 2 - LABEL_FONT / 2}
          text={labelText}
          fontSize={LABEL_FONT}
          fontFamily={FONT_SANS}
          fill={colors.text}
          listening={false}
          perfectDrawEnabled={false}
        />

        {selected && (
          <Rect
            x={-4}
            y={labelY}
            width={SELF_LOOP_W + 8}
            height={SELF_LOOP_H + LABEL_H + 6}
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

  // ─── Straight horizontal message ──────────────────────────────────────────
  const len = vm.length;
  const endX = len;
  const labelX = len > 0 ? 0 : len; // left-align label over the arrow regardless of direction

  return (
    <Group
      id={vm.id}
      x={x}
      y={y}
      opacity={opacity}
      visible={visible}
      draggable={draggable}
      onDragEnd={onDragEnd}
      dragBoundFunc={dragBoundFunc}
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
      {/* Wider hit-target band so the message is easy to click. */}
      <Rect
        x={Math.min(0, endX)}
        y={labelY}
        width={labelW}
        height={LABEL_H + 12}
        listening={true}
      />

      <Arrow
        points={[0, 0, endX, 0]}
        stroke={strokeColor}
        fill={openHead ? undefined : colors.fill}
        strokeWidth={STROKE_W}
        dash={dashed ? [5, 4] : undefined}
        pointerLength={ARROW_HEAD}
        pointerWidth={ARROW_HEAD - 2}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Filled circle marking the unknown endpoint of a found/lost message. */}
      {vm.isFound && (
        <Circle x={0} y={0} radius={5} fill={colors.fill} listening={false} perfectDrawEnabled={false} />
      )}
      {vm.isLost && (
        <Circle x={endX} y={0} radius={5} fill={colors.fill} listening={false} perfectDrawEnabled={false} />
      )}

      <Text
        x={labelX}
        y={labelY}
        width={labelW}
        text={labelText}
        fontSize={LABEL_FONT}
        fontFamily={FONT_SANS}
        fill={colors.text}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {selected && (
        <Rect
          x={Math.min(0, endX) - 2}
          y={labelY - 2}
          width={Math.abs(len) + 4}
          height={LABEL_H + STROKE_W + 8}
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
