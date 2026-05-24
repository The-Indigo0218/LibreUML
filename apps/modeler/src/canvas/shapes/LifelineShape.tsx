import { Group, Rect, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { LifelineViewModel } from '../../adapters/view-models/node.view-model';
import { resolveLifelineColors } from '../tokens/colors';

const STROKE_W = 1.5;
const NAME_FONT = 13;
const STEREO_FONT = 10;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

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

export function getLifelineShapeSize(vm: LifelineViewModel): { width: number; height: number } {
  return {
    width: vm.headWidth,
    height: vm.headHeight + vm.timelineLength,
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
}: LifelineShapeProps) {
  const colors = resolveLifelineColors();
  const { width: W } = getLifelineShapeSize(vm);
  const headH = vm.headHeight;
  const lineX = W / 2;
  const stereotype = stereotypeFor(vm.participantKind);

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
      {/* ── Head rectangle (participant box) ──────────────────────────────── */}
      <Rect
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
          y={6}
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
        y={stereotype ? 20 : (headH - NAME_FONT) / 2}
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

      {/* ── Dashed timeline going down ────────────────────────────────────── */}
      <Line
        points={[lineX, headH, lineX, headH + vm.timelineLength]}
        stroke={colors.timeline}
        strokeWidth={1}
        dash={[6, 4]}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Selection outline ─────────────────────────────────────────────── */}
      {selected && (
        <Rect
          x={-2}
          y={-2}
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
