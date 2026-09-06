import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivityPinViewModel } from '../../adapters/view-models/node.view-model';
import { measureTextWidth } from './measureText';
import { borderDash } from './borderStyle';

const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const LABEL_FONT = 11;
const FILL = '#0c2a3a';
const BORDER = '#38bdf8';
const TEXT = '#e0f2fe';
const SUBTEXT = '#7dd3fc';
const GLYPH = '#38bdf8';

/** The pin square itself — fixed, same for both kinds (UML draws no distinction here). */
const BOX = 18;
const CAPTION_GAP = 2;
const CAPTION_FONT = LABEL_FONT;
/** Past this the caption ellipsizes instead of stretching the hit box across the canvas. */
const MAX_CAPTION_W = 140;

/**
 * A pin is a fixed-size square with its caption (name / parameter trace)
 * printed below it — same reasoning as a control node's glyph, except a pin
 * does carry a label. `manualWidth`/`manualHeight` are deliberately absent
 * from the view model (unlike the action/object node): resizing a pin has no
 * UML meaning, only its caption's width varies with the text.
 */
export function getPinShapeSize(
  vm: ActivityPinViewModel,
): { width: number; height: number } {
  const fontSize = vm.fontSizeOverride ?? CAPTION_FONT;
  const fontFamily = vm.fontFamilyOverride ?? FONT_SANS;
  const caption = vm.parameterLabel ?? vm.label;
  const captionWidth = caption ? measureTextWidth(caption, `${fontSize}px ${fontFamily}`) : 0;
  const width = Math.max(BOX, Math.min(MAX_CAPTION_W, captionWidth));
  const height = BOX + (caption ? CAPTION_GAP + fontSize + 2 : 0);
  return { width, height };
}

interface PinShapeProps {
  viewModel: ActivityPinViewModel;
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
 * UML 2.5 §15.3 InputPin/OutputPin (A6.2/v1.1) — a small square marking where
 * a value enters or leaves an action. Real UML glues it to the action's
 * border; here it free-floats near its owner, same engineering effort as the
 * object node (which also does not snap to anything). The glyph in the
 * square (▶ / ◀) is the only visual difference between the two kinds — both
 * read as "a pin" at a glance, the arrow says which way the value moves.
 * `parameterLabel`, when set, replaces the free-typed name as the caption —
 * the parameter trace (ADR-0010) is the more informative of the two.
 */
export default function PinShape({
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
}: PinShapeProps) {
  const { width: W } = getPinShapeSize(vm);
  const fontSize = vm.fontSizeOverride ?? CAPTION_FONT;
  const fontFamily = vm.fontFamilyOverride ?? FONT_SANS;
  const caption = vm.parameterLabel ?? vm.label;
  const boxX = (W - BOX) / 2;

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
        x={boxX}
        width={BOX}
        height={BOX}
        cornerRadius={0}
        fill={vm.colorOverride ?? FILL}
        stroke={selected ? '#22d3ee' : BORDER}
        strokeWidth={selected ? 2.5 : (vm.borderWidthOverride ?? 1.5)}
        dash={borderDash(vm.borderStyleOverride, vm.borderWidthOverride ?? 1.5)}
        perfectDrawEnabled={false}
      />
      <Text
        x={boxX}
        width={BOX}
        y={0}
        height={BOX}
        text={vm.pinKind === 'OUTPUT_PIN' ? '▶' : '◀'}
        fontSize={10}
        fill={GLYPH}
        align="center"
        verticalAlign="middle"
        listening={false}
        perfectDrawEnabled={false}
      />
      {caption && (
        <Text
          x={0}
          y={BOX + CAPTION_GAP}
          width={W}
          text={caption}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={vm.parameterLabel ? SUBTEXT : TEXT}
          fontStyle={vm.parameterLabel ? 'italic' : 'normal'}
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
