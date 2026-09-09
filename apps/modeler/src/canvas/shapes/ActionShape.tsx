import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivityActionViewModel } from '../../adapters/view-models/node.view-model';
import { measureTextWidth } from './measureText';
import { borderDash } from './borderStyle';

const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const LABEL_FONT = 13;
const FILL = '#0c2a3a';
const BORDER = '#38bdf8';
const TEXT = '#e0f2fe';
const SUBTEXT = '#7dd3fc';

const PAD_X = 16;
const PAD_Y = 12;
const MIN_W = 120;
const MIN_H = 48;
/** Past this the label wraps instead of stretching the box across the canvas. */
const MAX_W = 240;

/**
 * An action sizes itself to its label, within bounds, unless the user has
 * dragged it to a size of their own (ADR-0002: derived geometry with a
 * persisted manual override).
 */
export function getActionShapeSize(vm: ActivityActionViewModel): { width: number; height: number } {
  if (vm.manualWidth && vm.manualHeight) {
    return { width: vm.manualWidth, height: vm.manualHeight };
  }

  const fontSize = vm.fontSizeOverride ?? LABEL_FONT;
  const fontFamily = vm.fontFamilyOverride ?? FONT_SANS;
  const labelWidth = measureTextWidth(vm.label || '', `${fontSize}px ${fontFamily}`);

  const width = Math.min(MAX_W, Math.max(MIN_W, labelWidth + PAD_X * 2));
  // Rough line count for a wrapped label: enough to keep the box from clipping.
  const usable = width - PAD_X * 2;
  const lines = usable > 0 ? Math.max(1, Math.ceil(labelWidth / usable)) : 1;
  const subtitleHeight = vm.callsOperationName ? fontSize : 0;
  const height = Math.max(MIN_H, lines * (fontSize + 4) + PAD_Y * 2 + subtitleHeight);

  return { width: vm.manualWidth ?? width, height: vm.manualHeight ?? height };
}

interface ActionShapeProps {
  viewModel: ActivityActionViewModel;
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
 * UML 2.5 §16 Action — a rounded rectangle naming a step in the flow. A call
 * action shows the operation it invokes underneath, which is the visible half
 * of the traceability that separates this from a flowchart (ADR-0010).
 */
export default function ActionShape({
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
}: ActionShapeProps) {
  const { width: W, height: H } = getActionShapeSize(vm);
  const fontSize = vm.fontSizeOverride ?? LABEL_FONT;
  const fontFamily = vm.fontFamilyOverride ?? FONT_SANS;
  const subtitle = vm.callsOperationName;

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
        width={W}
        height={H}
        cornerRadius={12}
        fill={vm.colorOverride ?? FILL}
        stroke={selected ? '#22d3ee' : BORDER}
        strokeWidth={selected ? 2.5 : (vm.borderWidthOverride ?? 1.5)}
        dash={borderDash(vm.borderStyleOverride, vm.borderWidthOverride ?? 1.5)}
        perfectDrawEnabled={false}
      />
      <Text
        x={PAD_X}
        y={subtitle ? PAD_Y : (H - fontSize) / 2}
        width={W - PAD_X * 2}
        height={subtitle ? undefined : fontSize}
        text={vm.label}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fill={TEXT}
        align="center"
        verticalAlign="middle"
        wrap="word"
        listening={false}
        perfectDrawEnabled={false}
      />
      {subtitle && (
        <Text
          x={PAD_X}
          y={H - PAD_Y - fontSize + 2}
          width={W - PAD_X * 2}
          text={subtitle}
          fontSize={fontSize - 2}
          fontFamily={fontFamily}
          fontStyle="italic"
          fill={SUBTEXT}
          align="center"
          ellipsis
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
