import { useRef, useLayoutEffect, useState } from 'react';
import { Group, Shape, Text, Line, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { NoteViewModel } from '../../adapters/view-models/node.view-model';
import { resolveNoteColors } from '../tokens/colors';
import { borderDash } from './borderStyle';

const NOTE_W = 224;
const NOTE_FOLD = 12;
const NOTE_H_PAD = 8;
const NOTE_V_PAD = 8;
const NOTE_TITLE_H = 32;
const NOTE_TITLE_FONT = 14;
const NOTE_SEC_FONT = 12;
const NOTE_MIN_H = 80;
const NOTE_LINE_H = 1.5;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FONT_MONO = '"Fira Code", monospace';

function estimateNoteHeight(content: string, title: string | undefined): number {
  const contentInnerW = NOTE_W - 2 * NOTE_H_PAD;
  const charsPerLine = Math.max(1, Math.floor(contentInnerW / (NOTE_SEC_FONT * 0.55)));
  const lineCount = content.split('\n').reduce((n, line) => {
    return n + Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
  }, 0);
  const contentH = lineCount * NOTE_SEC_FONT * NOTE_LINE_H;
  const titleH = title !== undefined ? NOTE_TITLE_H : 0;
  return Math.max(NOTE_MIN_H, titleH + NOTE_V_PAD + contentH + NOTE_V_PAD);
}

export function getNoteShapeSize(vm: NoteViewModel): { width: number; height: number } {
  return { width: NOTE_W, height: estimateNoteHeight(vm.content, vm.title) };
}

interface NoteShapeProps {
  viewModel: NoteViewModel;
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

export default function NoteShape({
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
}: NoteShapeProps) {
  const colors = resolveNoteColors();
  const border = vm.colorOverride ?? colors.border;
  const borderW = vm.borderWidthOverride ?? 1;
  const dash = borderDash(vm.borderStyleOverride, borderW);
  const contentRef = useRef<Konva.Text>(null);

  const [shapeH, setShapeH] = useState(() => estimateNoteHeight(vm.content, vm.title));

  useLayoutEffect(() => {
    const textNode = contentRef.current;
    if (!textNode) return;
    const titleH = vm.title !== undefined ? NOTE_TITLE_H : 0;
    const total = titleH + NOTE_V_PAD + textNode.height() + NOTE_V_PAD;
    setShapeH(Math.max(NOTE_MIN_H, total));
  }, [vm.content, vm.title]);

  const W = NOTE_W;
  const H = shapeH;
  const titleH = vm.title !== undefined ? NOTE_TITLE_H : 0;
  const contentY = titleH + NOTE_V_PAD;

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
      <Shape
        sceneFunc={(ctx: Context, shape: KonvaShape) => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(W - NOTE_FOLD, 0);
          ctx.lineTo(W, NOTE_FOLD);
          ctx.lineTo(W, H);
          ctx.lineTo(0, H);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
        fill={colors.bg}
        stroke={border}
        strokeWidth={borderW}
        dash={dash}
        perfectDrawEnabled={false}
      />

      <Shape
        sceneFunc={(ctx: Context, shape: KonvaShape) => {
          ctx.beginPath();
          ctx.moveTo(W - NOTE_FOLD, 0);
          ctx.lineTo(W, 0);
          ctx.lineTo(W, NOTE_FOLD);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
        fill={colors.surfacePrimary}
        stroke={border}
        strokeWidth={borderW}
        dash={dash}
        perfectDrawEnabled={false}
      />

      {vm.title !== undefined && (
        <>
          <Rect
            width={W - NOTE_FOLD}
            height={NOTE_TITLE_H}
            fill={colors.surfacePrimary}
            opacity={0.5}
            perfectDrawEnabled={false}
          />

          <Text
            x={NOTE_H_PAD}
            y={NOTE_V_PAD / 2 + 2}
            width={W - NOTE_H_PAD * 2 - NOTE_FOLD}
            text={vm.title}
            fontSize={NOTE_TITLE_FONT}
            fontFamily={FONT_SANS}
            fontStyle="bold"
            fill={colors.border}
            ellipsis={true}
            listening={false}
            perfectDrawEnabled={false}
          />

          <Line
            points={[0, NOTE_TITLE_H, W - NOTE_FOLD, NOTE_TITLE_H]}
            stroke={border}
            strokeWidth={1}
            dash={[4, 3]}
            listening={false}
          />
        </>
      )}

      <Text
        ref={contentRef}
        x={NOTE_H_PAD}
        y={contentY}
        width={W - 2 * NOTE_H_PAD}
        text={vm.content}
        fontSize={NOTE_SEC_FONT}
        fontFamily={FONT_MONO}
        fill={colors.textMuted}
        wrap="word"
        lineHeight={NOTE_LINE_H}
        listening={false}
        perfectDrawEnabled={false}
      />

      <Rect width={W} height={H} listening={true} />

      {selected && (
        <Shape
          sceneFunc={(ctx: Context, shape: KonvaShape) => {
            ctx.beginPath();
            ctx.moveTo(-1, -1);
            ctx.lineTo(W - NOTE_FOLD + 1, -1);
            ctx.lineTo(W + 1, NOTE_FOLD - 1);
            ctx.lineTo(W + 1, H + 1);
            ctx.lineTo(-1, H + 1);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          stroke="#22d3ee"
          strokeWidth={2}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
