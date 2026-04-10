/**
 * ClassShape — react-konva component for UML class / interface / abstract / enum nodes.
 *
 * Layout (top-to-bottom):
 *   ┌─────────────────────────┐
 *   │  <<stereotype>>         │  ← STEREO_H row (if showStereotype && stereotype)
 *   │  badge text             │  ← BADGE_H row   (if badge)
 *   │  ClassName              │  ← NAME_H  row   (always)
 *   ├─────────────────────────┤
 *   │  + attr1: Type          │  ← ROW_H per item (font-mono)
 *   │  + attr2: Type[]        │
 *   ├─────────────────────────┤
 *   │  + method1(): void      │
 *   └─────────────────────────┘
 *
 * Text measurement:
 *   Width is computed from the longest text string across all rows
 *   (via measureTextWidth, a singleton off-screen canvas) clamped to
 *   [MIN_W, MAX_W].  Height is deterministic arithmetic — each row has a
 *   fixed pixel height, so no second-pass rendering is needed.
 *
 * Interactivity:
 *   `listening={true}` on the Group — click events bubble up to the Group's
 *   onClick which calls the `onNodeClick` callback (wired in KonvaCanvas).
 *   Drag is wired in MAG-01.5.
 *
 * Selection:
 *   When `selected={true}` a cyan (#22d3ee) outline Rect is rendered on top
 *   of all other children, visually highlighting the selected node.
 */

import { useMemo } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { NodeViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { resolveNodeColors } from '../tokens/colors';
import { measureTextWidth } from './measureText';

// ─── Layout constants (pixel values) ──────────────────────────────────────────

const BORDER_W = 2;
const RADIUS = 2;
const H_PAD = 10;       // horizontal text inset on each side
const HEADER_V_PAD = 8; // header top + bottom padding (matches CSS p-2)
const SEC_V_PAD = 8;    // section top + bottom padding  (matches CSS p-2)
const STEREO_FONT = 10; // matches text-[10px] in UmlClassNode
const BADGE_FONT = 10;
const NAME_FONT = 14;   // matches text-sm (14px at default root)
const SEC_FONT = 12;    // matches text-xs (12px)
const STEREO_H = 14;    // row height for stereotype / badge line
const BADGE_H = 14;
const NAME_H = 22;      // text-sm at ~1.5× line-height ≈ 21 px, rounded up
const ROW_H = 20;       // section item: text-xs 12px × 1.625 leading ≈ 20 px
const MIN_SEC_H = 24;   // min-h-6 = 24px for empty sections
const MIN_W = 256;      // min-w-[16rem] in UmlClassNode
const MAX_W = 512;      // max-w-lg = 32rem
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FONT_MONO = '"Fira Code", monospace';

export interface SectionLayout {
  top: number;
  height: number;
  itemsY: number; // y of the first item's text baseline area
}

export interface ClassLayout {
  width: number;
  height: number;
  headerH: number;
  stereotypeY: number; // -1 when not shown
  badgeY: number;      // -1 when not shown
  nameY: number;
  fontStyle: string;
  separators: number[];
  sections: SectionLayout[];
}

function parseFontStyle(labelFormat: string): string {
  const bold = labelFormat.includes('bold');
  const italic = labelFormat.includes('italic');
  if (bold && italic) return 'bold italic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function computeLayout(vm: NodeViewModel): ClassLayout {
  const fontStyle = parseFontStyle(vm.style.labelFormat);
  const hasStereotype = vm.style.showStereotype && !!vm.stereotype;
  const stereoText = hasStereotype ? `<<${vm.stereotype}>>` : '';
  const nameText = vm.sublabel ? `${vm.label}${vm.sublabel}` : vm.label;

  // ── Width: widest text + padding, clamped ────────────────────────────────
  const candidates: number[] = [
    stereoText
      ? measureTextWidth(stereoText, `${STEREO_FONT}px ${FONT_MONO}`) + 2 * H_PAD
      : 0,
    vm.badge
      ? measureTextWidth(vm.badge, `${BADGE_FONT}px ${FONT_SANS}`) + 2 * H_PAD
      : 0,
    // +20 safety margin for bold-font underestimation and padding
    measureTextWidth(nameText, `${fontStyle} ${NAME_FONT}px ${FONT_SANS}`) + 2 * H_PAD + 20,
    ...vm.sections.flatMap((s) =>
      s.items.map(
        (item) => measureTextWidth(item.text, `${SEC_FONT}px ${FONT_MONO}`) + 2 * H_PAD,
      ),
    ),
  ];
  const width = Math.min(MAX_W, Math.max(MIN_W, Math.max(...candidates, 0)));

  // ── Height: accumulate y ─────────────────────────────────────────────────
  let y = 0;
  y += HEADER_V_PAD;

  const stereotypeY = hasStereotype ? y : -1;
  if (hasStereotype) y += STEREO_H;

  const badgeY = vm.badge ? y : -1;
  if (vm.badge) y += BADGE_H;

  const nameY = y;
  y += NAME_H;
  y += HEADER_V_PAD;

  const headerH = y;
  const separators: number[] = [headerH];

  const sections: SectionLayout[] = vm.sections.map((section, i) => {
    const top = y;
    y += SEC_V_PAD;
    const itemsY = y;
    y += section.items.length > 0 ? section.items.length * ROW_H : MIN_SEC_H;
    y += SEC_V_PAD;
    if (i < vm.sections.length - 1) separators.push(y);
    return { top, height: y - top, itemsY };
  });

  // When there are no sections, guarantee a minimum body strip below the header.
  if (vm.sections.length === 0) y += MIN_SEC_H;

  return { width, height: y, headerH, stereotypeY, badgeY, nameY, fontStyle, separators, sections };
}

/** Returns the pixel size that ClassShape will occupy for a given view model. */
export function getClassShapeSize(vm: NodeViewModel): { width: number; height: number } {
  const { width, height } = computeLayout(vm);
  return { width, height };
}

/**
 * Returns the full layout descriptor for a NodeViewModel.
 * Used by diagramToSvg for vector SVG export (MAG-01.15).
 */
export function computeClassLayout(vm: NodeViewModel): ClassLayout {
  return computeLayout(vm);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ClassShapeProps {
  viewModel: NodeViewModel;
  x: number;
  y: number;
  selected?: boolean;
  /** Render opacity — pass 0.3 for ghost shapes during drag. */
  opacity?: number;
  /** Viewport culling — set false to hide off-screen shapes (MAG-01.16). */
  visible?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

export default function ClassShape({
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
}: ClassShapeProps) {
  const colors = resolveNodeColors(vm.style.containerClass);
  const layout = useMemo(() => computeLayout(vm), [vm]);
  const { width: W, height: H } = layout;

  const stereoText = vm.style.showStereotype && vm.stereotype ? `<<${vm.stereotype}>>` : null;
  const stereoIsItalic = vm.style.labelFormat.includes('italic');

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
      {/* ── Outer rect (fills bg + draws border) ───────────────────────── */}
      <Rect
        width={W}
        height={H}
        fill={colors.bg}
        stroke={colors.border}
        strokeWidth={BORDER_W}
        cornerRadius={RADIUS}
        perfectDrawEnabled={false}
      />

      {/* ── Header background (rounded top corners only) ────────────────── */}
      <Rect
        width={W}
        height={layout.headerH}
        fill={colors.headerBg}
        cornerRadius={[RADIUS, RADIUS, 0, 0]}
        perfectDrawEnabled={false}
      />

      {/* ── Stereotype ──────────────────────────────────────────────────── */}
      {stereoText !== null && layout.stereotypeY >= 0 && (
        <Text
          x={H_PAD}
          y={layout.stereotypeY + 2}
          width={W - 2 * H_PAD}
          text={stereoText}
          fontSize={STEREO_FONT}
          fontFamily={FONT_MONO}
          fontStyle={stereoIsItalic ? 'italic' : 'normal'}
          fill={colors.border}
          align="center"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* ── Badge ───────────────────────────────────────────────────────── */}
      {vm.badge !== undefined && layout.badgeY >= 0 && (
        <Text
          x={H_PAD}
          y={layout.badgeY + 2}
          width={W - 2 * H_PAD}
          text={vm.badge}
          fontSize={BADGE_FONT}
          fontFamily={FONT_SANS}
          fill={colors.textMuted}
          align="center"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* ── Name (+ sublabel concatenated — yellow tint is a TODO) ──────── */}
      <Text
        x={H_PAD}
        y={layout.nameY + 3}
        width={W - 2 * H_PAD}
        text={vm.sublabel ? `${vm.label}${vm.sublabel}` : vm.label}
        fontSize={NAME_FONT}
        fontFamily={FONT_SANS}
        fontStyle={layout.fontStyle}
        fill={colors.text}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Separator lines ─────────────────────────────────────────────── */}
      {layout.separators.map((sepY) => (
        <Line
          key={sepY}
          points={[0, sepY, W, sepY]}
          stroke={colors.border}
          strokeWidth={BORDER_W}
          listening={false}
        />
      ))}

      {/* ── Section items ───────────────────────────────────────────────── */}
      {vm.sections.flatMap((section, sIdx) =>
        section.items.map((item, iIdx) => {
          const secLayout = layout.sections[sIdx];
          return (
            <Text
              key={item.id}
              x={H_PAD}
              y={(secLayout?.itemsY ?? 0) + iIdx * ROW_H + 2}
              width={W - 2 * H_PAD}
              text={item.text}
              fontSize={SEC_FONT}
              fontFamily={FONT_MONO}
              fontStyle={item.isAbstract ? 'italic' : 'normal'}
              textDecoration={item.isStatic ? 'underline' : ''}
              fill={colors.textMuted}
              ellipsis={true}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        }),
      )}

      {/* ── Selection outline (rendered last → on top) ──────────────────── */}
      {selected && (
        <Rect
          x={-1}
          y={-1}
          width={W + 2}
          height={H + 2}
          stroke="#22d3ee"
          strokeWidth={2}
          cornerRadius={RADIUS}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
