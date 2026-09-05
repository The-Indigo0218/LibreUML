import { useRef, useLayoutEffect, useState } from 'react';
import { Group, Shape, Text, Line, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { NoteViewModel } from '../../adapters/view-models/node.view-model';
import { resolveNoteColors } from '../tokens/colors';
import { borderDash } from './borderStyle';
import ResizeHandles from './ResizeHandles';

const NOTE_W = 224;
const MANUAL_STROKE = '#22d3ee';
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

export function noteScale(vm: NoteViewModel): number {
  return (vm.fontSizeOverride ?? NOTE_TITLE_FONT) / NOTE_TITLE_FONT;
}

export function noteFontFamily(vm: NoteViewModel): string {
  return vm.fontFamilyOverride ?? FONT_SANS;
}

function estimateNoteHeight(content: string, title: string | undefined, secFont: number, titleBarH: number, width: number = NOTE_W): number {
  const contentInnerW = width - 2 * NOTE_H_PAD;
  const charsPerLine = Math.max(1, Math.floor(contentInnerW / (secFont * 0.55)));
  const lineCount = content.split('\n').reduce((n, line) => {
    return n + Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
  }, 0);
  const contentH = lineCount * secFont * NOTE_LINE_H;
  const titleH = title !== undefined ? titleBarH : 0;
  return Math.max(NOTE_MIN_H, titleH + NOTE_V_PAD + contentH + NOTE_V_PAD);
}

export function getNoteShapeSize(vm: NoteViewModel): { width: number; height: number } {
  const scale = noteScale(vm);
  const width = vm.manualWidth ?? NOTE_W;
  const height = vm.manualHeight ?? estimateNoteHeight(vm.content, vm.title, NOTE_SEC_FONT * scale, NOTE_TITLE_H * scale, width);
  return { width, height };
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
  /** (id, width, height) — fired when a resize handle is released (G-d). */
  onResizeEnd?: (id: string, width: number, height: number) => void;
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
  onResizeEnd,
}: NoteShapeProps) {
  const colors = resolveNoteColors();
  const isManual = vm.manualWidth !== undefined || vm.manualHeight !== undefined;
  const border = vm.colorOverride ?? (isManual ? MANUAL_STROKE : colors.border);
  const borderW = vm.borderWidthOverride ?? (isManual ? 1.5 : 1);
  const dash = borderDash(vm.borderStyleOverride, borderW);
  const fontSans = vm.fontFamilyOverride ?? FONT_SANS;
  const scale = noteScale(vm);
  const titleFont = NOTE_TITLE_FONT * scale;
  const secFont = NOTE_SEC_FONT * scale;
  const titleBarH = NOTE_TITLE_H * scale;
  const contentRef = useRef<Konva.Text>(null);

  // Live size while a resize handle is dragged; null = derived/manual size.
  const [live, setLive] = useState<{ w: number; h: number } | null>(null);
  const baseW = vm.manualWidth ?? NOTE_W;
  const [shapeH, setShapeH] = useState(() => vm.manualHeight ?? estimateNoteHeight(vm.content, vm.title, secFont, titleBarH, baseW));

  useLayoutEffect(() => {
    if (vm.manualHeight !== undefined) { setShapeH(vm.manualHeight); return; }
    const textNode = contentRef.current;
    if (!textNode) return;
    const titleH = vm.title !== undefined ? titleBarH : 0;
    const total = titleH + NOTE_V_PAD + textNode.height() + NOTE_V_PAD;
    setShapeH(Math.max(NOTE_MIN_H, total));
  }, [vm.content, vm.title, titleBarH, vm.manualHeight]);

  const W = live?.w ?? baseW;
  const H = live?.h ?? shapeH;
  const titleH = vm.title !== undefined ? titleBarH : 0;
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
            height={titleBarH}
            fill={colors.surfacePrimary}
            opacity={0.5}
            perfectDrawEnabled={false}
          />

          <Text
            x={NOTE_H_PAD}
            y={NOTE_V_PAD / 2 + 2}
            width={W - NOTE_H_PAD * 2 - NOTE_FOLD}
            text={vm.title}
            fontSize={titleFont}
            fontFamily={fontSans}
            fontStyle="bold"
            fill={colors.border}
            ellipsis={true}
            listening={false}
            perfectDrawEnabled={false}
          />

          <Line
            points={[0, titleBarH, W - NOTE_FOLD, titleBarH]}
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
        fontSize={secFont}
        fontFamily={FONT_MONO}
        fill={colors.textMuted}
        wrap="word"
        lineHeight={NOTE_LINE_H}
        listening={false}
        perfectDrawEnabled={false}
      />

      <Rect width={W} height={H} listening={true} />

      {/* ── Resize handles (G-d) ──────────────────────────────────────────── */}
      {onResizeEnd && (
        <ResizeHandles
          w={W}
          h={H}
          minW={120}
          minH={60}
          onResize={(nw, nh) => setLive({ w: nw, h: nh })}
          onCommit={(nw, nh) => {
            setLive(null);
            onResizeEnd(vm.id, nw, nh);
          }}
        />
      )}

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
