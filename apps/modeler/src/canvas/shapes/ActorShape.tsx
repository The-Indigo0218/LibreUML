import { Group, Circle, Line, Text, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActorViewModel } from '../../adapters/view-models/node.view-model';
import { resolveActorColors } from '../tokens/colors';
import { measureTextWidth } from './measureText';

// ─── Layout constants ──────────────────────────────────────────────────────────

const HEAD_R = 12;
const HEAD_CY = HEAD_R + 2;
const BODY_TOP = HEAD_CY + HEAD_R;
const BODY_BOT = BODY_TOP + 32;
const ARM_Y = BODY_TOP + 16;
const ARM_HALF = 18;
const LEG_DX = 16;
const LEG_DY = 18;
const NAME_GAP = 8;
const NAME_FONT = 13;
const NAME_H = 18;
const STROKE_W = 1.5;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const H_PAD = 8;

export function getActorShapeSize(vm: ActorViewModel): { width: number; height: number } {
  const minW = ARM_HALF * 2 + HEAD_R * 2;
  const textW = measureTextWidth(vm.name, `${NAME_FONT}px ${FONT_SANS}`) + H_PAD * 2;
  const width = Math.max(minW, textW);
  const height = BODY_BOT + LEG_DY + NAME_GAP + NAME_H + 4;
  return { width, height };
}

interface ActorShapeProps {
  viewModel: ActorViewModel;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

export default function ActorShape({
  viewModel: vm,
  x,
  y,
  selected,
  opacity,
  visible = true,
  onNodeClick,
  onDblClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDragMove,
  onDragEnd,
}: ActorShapeProps) {
  const colors = resolveActorColors();
  const stroke = vm.colorOverride ?? colors.stroke;
  const { width: W, height: H } = getActorShapeSize(vm);
  const cx = W / 2;

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
      {/* ── Transparent hit-target covering the whole bounding box ────────── */}
      <Rect width={W} height={H} listening={true} />

      {/* ── Head ────────────────────────────────────────────────────────────── */}
      <Circle
        x={cx}
        y={HEAD_CY}
        radius={HEAD_R}
        stroke={stroke}
        strokeWidth={STROKE_W}
        fill={colors.fill}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <Line
        points={[cx, BODY_TOP, cx, BODY_BOT]}
        stroke={stroke}
        strokeWidth={STROKE_W}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Arms ────────────────────────────────────────────────────────────── */}
      <Line
        points={[cx - ARM_HALF, ARM_Y, cx + ARM_HALF, ARM_Y]}
        stroke={stroke}
        strokeWidth={STROKE_W}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Left leg ────────────────────────────────────────────────────────── */}
      <Line
        points={[cx, BODY_BOT, cx - LEG_DX, BODY_BOT + LEG_DY]}
        stroke={stroke}
        strokeWidth={STROKE_W}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Right leg ───────────────────────────────────────────────────────── */}
      <Line
        points={[cx, BODY_BOT, cx + LEG_DX, BODY_BOT + LEG_DY]}
        stroke={stroke}
        strokeWidth={STROKE_W}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Stereotype label «system»/«timer» ────────────────────────────── */}
      {vm.actorType && vm.actorType !== 'human' && (
        <Text
          x={0}
          y={BODY_BOT + LEG_DY + NAME_GAP - NAME_FONT - 2}
          width={W}
          text={vm.actorType === 'system' ? '«system»' : '«timer»'}
          fontSize={10}
          fontFamily={FONT_SANS}
          fontStyle="italic"
          fill={colors.text}
          align="center"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* ── Name ────────────────────────────────────────────────────────────── */}
      <Text
        x={0}
        y={BODY_BOT + LEG_DY + NAME_GAP}
        width={W}
        text={vm.name}
        fontSize={NAME_FONT}
        fontFamily={FONT_SANS}
        fontStyle={vm.isAbstract ? 'italic' : 'normal'}
        fill={colors.text}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Selection outline ───────────────────────────────────────────────── */}
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
