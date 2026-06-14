import { useState } from 'react';
import { Group, Rect, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { LifelineViewModel } from '../../adapters/view-models/node.view-model';
import { resolveLifelineColors } from '../tokens/colors';

const STROKE_W = 1.5;
const NAME_FONT = 13;
const STEREO_FONT = 10;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FOOT_HANDLE_H = 8; // hit-area of the timeline foot resize grabber
const MIN_TIMELINE_LEN = 20;

function stereotypeFor(kind: LifelineViewModel['participantKind']): string | null {
  switch (kind) {
    case 'ACTOR':     return '«actor»';
    case 'INTERFACE': return '«interface»';
    case 'OBJECT':    return '«object»';
    case 'CLASS':     return null;
    case 'ANONYMOUS': return null;
    default:          return null;
  }
}

const DESTROY_X = 9; // half-size of the ✕ termination marker

export function getLifelineShapeSize(vm: LifelineViewModel): { width: number; height: number } {
  return {
    width: vm.headWidth,
    height: (vm.headTopOffset ?? 0) + vm.headHeight + vm.timelineLength,
  };
}

interface LifelineShapeProps {
  viewModel: LifelineViewModel;
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
  /** (id, width, newTimelineLength) — fired when the foot handle is released (G-c). */
  onResizeEnd?: (id: string, width: number, height: number) => void;
  /** Clears the manual timeline length (foot-handle double-click). */
  onResetTimeline?: (id: string) => void;
}

export default function LifelineShape({
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
  onDragStart,
  onDragMove,
  onDragEnd,
  dragBoundFunc,
  onResizeEnd,
  onResetTimeline,
}: LifelineShapeProps) {
  const colors = resolveLifelineColors();
  const W = vm.headWidth;
  const headH = vm.headHeight;
  const top = vm.headTopOffset ?? 0;
  const lineX = W / 2;
  const timelineTop = top + headH;
  // Live length while the foot handle is dragged; null = use the derived/manual length.
  const [liveLength, setLiveLength] = useState<number | null>(null);
  const timelineLength = liveLength ?? vm.timelineLength;
  const timelineBottom = timelineTop + timelineLength;
  const stereotype = stereotypeFor(vm.participantKind);
  // The foot handle is offered for live lifelines (a destroyed one ends at its ✕).
  const showFootHandle = !!onResizeEnd && !vm.isDestroyed;

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
      {/* ── Head rectangle (participant box) ──────────────────────────────── */}
      <Rect
        y={top}
        width={W}
        height={headH}
        stroke={colors.border}
        strokeWidth={STROKE_W}
        fill={colors.headBg}
        cornerRadius={2}
        perfectDrawEnabled={false}
      />

      {/* ── Stereotype (when applicable) ──────────────────────────────────── */}
      {stereotype && (
        <Text
          x={0}
          y={top + 6}
          width={W}
          text={stereotype}
          fontSize={STEREO_FONT}
          fontFamily={FONT_SANS}
          fontStyle="italic"
          fill={colors.text}
          align="center"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* ── Participant name ──────────────────────────────────────────────── */}
      <Text
        x={0}
        y={top + (stereotype ? 20 : (headH - NAME_FONT) / 2)}
        width={W}
        text={vm.name}
        fontSize={NAME_FONT}
        fontFamily={FONT_SANS}
        fontStyle="bold"
        fill={colors.text}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Decomposition marker (C5): `ref <name>` at the head's bottom ───── */}
      {vm.decomposedRef && (
        <Text
          x={4}
          y={top + headH - 14}
          width={W - 8}
          text={`ref ${vm.decomposedRef}`}
          fontSize={STEREO_FONT}
          fontFamily={FONT_SANS}
          fontStyle="italic"
          fill="#7C83FF"
          align="right"
          ellipsis
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* ── Dashed timeline going down (cyan when manually stretched) ──────── */}
      <Line
        points={[lineX, timelineTop, lineX, timelineBottom]}
        stroke={vm.isManualTimeline ? '#22d3ee' : colors.timeline}
        strokeWidth={vm.isManualTimeline ? 1.5 : 1}
        dash={[6, 4]}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Destruction ✕ marker at the timeline end ──────────────────────── */}
      {vm.isDestroyed && (
        <>
          <Line
            points={[lineX - DESTROY_X, timelineBottom - DESTROY_X, lineX + DESTROY_X, timelineBottom + DESTROY_X]}
            stroke={colors.border}
            strokeWidth={2.5}
            listening={false}
            perfectDrawEnabled={false}
          />
          <Line
            points={[lineX - DESTROY_X, timelineBottom + DESTROY_X, lineX + DESTROY_X, timelineBottom - DESTROY_X]}
            stroke={colors.border}
            strokeWidth={2.5}
            listening={false}
            perfectDrawEnabled={false}
          />
        </>
      )}

      {/* ── Timeline foot resize handle (G-c) — drag to stretch, dbl-click resets ─ */}
      {showFootHandle && (
        <Rect
          x={lineX - 7}
          y={timelineBottom - FOOT_HANDLE_H / 2}
          width={14}
          height={FOOT_HANDLE_H}
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
            // Lock X; the foot handle only moves vertically.
            return { x: this.getAbsolutePosition().x, y: pos.y };
          }}
          onDragStart={(e) => { e.cancelBubble = true; }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const next = Math.max(MIN_TIMELINE_LEN, e.target.y() + FOOT_HANDLE_H / 2 - timelineTop);
            setLiveLength(next);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const next = Math.max(MIN_TIMELINE_LEN, e.target.y() + FOOT_HANDLE_H / 2 - timelineTop);
            setLiveLength(null);
            // Reset the transient handle position; geometry comes from the store.
            e.target.position({ x: lineX - 7, y: timelineTop + vm.timelineLength - FOOT_HANDLE_H / 2 });
            onResizeEnd?.(vm.id, W, next);
          }}
          onDblClick={(e) => {
            e.cancelBubble = true;
            onResetTimeline?.(vm.id);
          }}
        />
      )}

      {/* ── Selection outline ─────────────────────────────────────────────── */}
      {selected && (
        <Rect
          x={-2}
          y={top - 2}
          width={W + 4}
          height={headH + 4}
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
