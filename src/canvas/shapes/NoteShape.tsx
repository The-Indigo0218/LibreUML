/**
 * NoteShape — react-konva component for UML sticky-note nodes.
 *
 * Visual structure:
 *   ┌─────────────────────────/
 *   │  Title (bold)          /  ← fold corner (top-right, NOTE_FOLD px)
 *   │- - - - - - - - - - - -/
 *   │  content text          │
 *   │  wraps to multiple     │
 *   │  lines automatically   │
 *   └────────────────────────┘
 *
 * Width: fixed at NOTE_W (224 px = w-56, matches UmlNoteNode).
 *
 * Height (auto-sizing):
 *   1. An estimate is computed synchronously from character count to seed
 *      the initial render and avoid a zero-height flash.
 *   2. A `useLayoutEffect` reads the actual rendered `Konva.Text.height()`
 *      (which Konva calculates from width + font + wrap settings without
 *      needing a browser paint) and corrects `shapeH`.  The correction
 *      happens synchronously before the browser paints, so there is no
 *      visible flicker for typical note lengths.
 *
 * Folded corner:
 *   Two custom `<Shape>` paths share the diagonal crease:
 *   - Body:  M(0,0) → L(W-FOLD,0) → L(W,FOLD) → L(W,H) → L(0,H) → Z
 *   - Flap:  M(W-FOLD,0) → L(W,0) → L(W,FOLD) → Z  (filled with surfacePrimary)
 *   Both are stroked with the note border colour.
 *
 * Interactivity:
 *   `listening={true}` on the Group — a transparent hit-target Rect at the
 *   top of the z-stack ensures all clicks within the note's rectangular bounds
 *   are captured and bubble to the Group's onClick → `onNodeClick` callback.
 *
 * Selection:
 *   When `selected={true}` a cyan (#22d3ee) outline following the cut-corner
 *   path is rendered on top of all other children.
 */

import { useRef, useLayoutEffect, useState } from 'react';
import { Group, Shape, Text, Line, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { NoteViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { resolveNoteColors } from '../tokens/colors';

// ─── Layout constants ──────────────────────────────────────────────────────────

const NOTE_W = 224;          // w-56 = 14rem — matches UmlNoteNode width
const NOTE_FOLD = 12;        // size of the folded corner triangle
const NOTE_H_PAD = 8;        // horizontal text padding (matches p-2)
const NOTE_V_PAD = 8;        // vertical content padding (matches p-2)
const NOTE_TITLE_H = 32;     // title bar height: p-2 + text-sm line ≈ 8+14.5+8 → 32
const NOTE_TITLE_FONT = 14;  // text-sm
const NOTE_SEC_FONT = 12;    // text-xs
const NOTE_MIN_H = 80;       // min-h-20 = 80px, matches `min-h-20` in UmlNoteNode
const NOTE_LINE_H = 1.5;     // leading-relaxed ≈ 1.625, we use 1.5 for the estimate
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FONT_MONO = '"Fira Code", monospace';

// ─── Height estimate ───────────────────────────────────────────────────────────

/**
 * Approximate height without a Konva node — used to seed the initial render.
 * Assumes monospace characters are ~0.55 em wide on average.
 */
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

/** Returns the estimated pixel size that NoteShape will occupy for a given view model. */
export function getNoteShapeSize(vm: NoteViewModel): { width: number; height: number } {
  return { width: NOTE_W, height: estimateNoteHeight(vm.content, vm.title) };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NoteShapeProps {
  viewModel: NoteViewModel;
  x: number;
  y: number;
  selected?: boolean;
  /** Render opacity — pass 0.3 for ghost shapes during drag. */
  opacity?: number;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
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
  onNodeClick,
  onDblClick,
  draggable,
  onDragStart,
  onDragMove,
  onDragEnd,
}: NoteShapeProps) {
  const colors = resolveNoteColors();
  const contentRef = useRef<Konva.Text>(null);

  const [shapeH, setShapeH] = useState(() => estimateNoteHeight(vm.content, vm.title));

  // Precise correction after Konva has laid out the Text node.
  // useLayoutEffect fires synchronously after react-konva updates node attributes,
  // so the browser never paints the estimated height.
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
    >
      {/* ── Note body — custom path with cut corner ──────────────────────── */}
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
        stroke={colors.border}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />

      {/* ── Fold flap triangle ───────────────────────────────────────────── */}
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
        stroke={colors.border}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />

      {/* ── Title bar (when title is defined, even if empty string) ─────── */}
      {vm.title !== undefined && (
        <>
          {/* Title background */}
          <Rect
            width={W - NOTE_FOLD}
            height={NOTE_TITLE_H}
            fill={colors.surfacePrimary}
            opacity={0.5}
            perfectDrawEnabled={false}
          />

          {/* Title text */}
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

          {/* Dashed separator line */}
          <Line
            points={[0, NOTE_TITLE_H, W - NOTE_FOLD, NOTE_TITLE_H]}
            stroke={colors.border}
            strokeWidth={1}
            dash={[4, 3]}
            listening={false}
          />
        </>
      )}

      {/* ── Content text (auto-wrapped, measured for height) ────────────── */}
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

      {/* ── Hit target (transparent, full bounds, topmost) ──────────────── */}
      {/* Captures all click events and bubbles them to the Group onClick.   */}
      <Rect width={W} height={H} listening={true} />

      {/* ── Selection outline (rendered last → on top) ──────────────────── */}
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
