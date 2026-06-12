import { useMemo } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { NodeViewModel } from '../../adapters/view-models/node.view-model';
import { resolveNodeColors } from '../tokens/colors';
import { measureTextWidth } from './measureText';
import { borderDash } from './borderStyle';

const BORDER_W = 2;
const RADIUS = 2;
const H_PAD = 10;
const HEADER_V_PAD = 8;
const SEC_V_PAD = 8;
const STEREO_FONT = 10;
const BADGE_FONT = 10;
const NAME_FONT = 14;
const SEC_FONT = 12;
const STEREO_H = 14;
const BADGE_H = 14;
const NAME_H = 22;
const ROW_H = 20;
const MIN_SEC_H = 24;
const MIN_W = 256;
const MAX_W = 512;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FONT_MONO = '"Fira Code", monospace';

export interface SectionLayout {
  top: number;
  height: number;
  itemsY: number;
  itemOffsets: number[];
  itemLineHeights: number[];
}

export interface ClassLayout {
  width: number;
  height: number;
  headerH: number;
  stereotypeY: number;
  badgeY: number;
  nameY: number;
  fontStyle: string;
  separators: number[];
  sections: SectionLayout[];
  fontSans: string;
  stereoFont: number;
  badgeFont: number;
  nameFont: number;
  secFont: number;
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
  const fontSans = vm.fontFamilyOverride ?? FONT_SANS;
  const scale = (vm.fontSizeOverride ?? NAME_FONT) / NAME_FONT;
  const stereoFont = STEREO_FONT * scale;
  const badgeFont = BADGE_FONT * scale;
  const nameFont = NAME_FONT * scale;
  const secFont = SEC_FONT * scale;
  const stereoH = STEREO_H * scale;
  const badgeH = BADGE_H * scale;
  const nameH = NAME_H * scale;
  const rowH = ROW_H * scale;
  const minSecH = MIN_SEC_H * scale;

  const hasStereotype = vm.style.showStereotype && !!vm.stereotype;
  const stereoText = hasStereotype ? `<<${vm.stereotype}>>` : '';
  const nameText = vm.sublabel ? `${vm.label}${vm.sublabel}` : vm.label;

  const candidates: number[] = [
    stereoText
      ? measureTextWidth(stereoText, `${stereoFont}px ${FONT_MONO}`) + 2 * H_PAD
      : 0,
    vm.badge
      ? measureTextWidth(vm.badge, `${badgeFont}px ${fontSans}`) + 2 * H_PAD
      : 0,
    measureTextWidth(nameText, `${fontStyle} ${nameFont}px ${fontSans}`) + 2 * H_PAD + 20,
    ...vm.sections.flatMap((s) =>
      s.items.map(
        (item) => measureTextWidth(item.text, `${secFont}px ${FONT_MONO}`) + 2 * H_PAD,
      ),
    ),
  ];
  const width = Math.min(MAX_W, Math.max(MIN_W, Math.max(...candidates, 0)));
  const availW = width - 2 * H_PAD;

  let y = 0;
  y += HEADER_V_PAD;

  const stereotypeY = hasStereotype ? y : -1;
  if (hasStereotype) y += stereoH;

  const badgeY = vm.badge ? y : -1;
  if (vm.badge) y += badgeH;

  const nameY = y;
  y += nameH;
  y += HEADER_V_PAD;

  const headerH = y;
  const separators: number[] = [headerH];

  const sections: SectionLayout[] = vm.sections.map((section, i) => {
    const top = y;
    y += SEC_V_PAD;
    const itemsY = y;

    let itemOffset = 0;
    const itemOffsets: number[] = [];
    const itemLineHeights: number[] = [];

    for (const item of section.items) {
      itemOffsets.push(itemOffset);
      const textW = measureTextWidth(item.text, `${secFont}px ${FONT_MONO}`);
      const lineCount = Math.max(1, Math.ceil(textW / availW));
      const itemH = lineCount * rowH;
      itemLineHeights.push(itemH);
      itemOffset += itemH;
    }

    const totalItemsH = section.items.length > 0 ? itemOffset : minSecH;
    y += totalItemsH;
    y += SEC_V_PAD;
    if (i < vm.sections.length - 1) separators.push(y);
    return { top, height: y - top, itemsY, itemOffsets, itemLineHeights };
  });

  if (vm.sections.length === 0) y += minSecH;

  return {
    width, height: y, headerH, stereotypeY, badgeY, nameY, fontStyle, separators, sections,
    fontSans, stereoFont, badgeFont, nameFont, secFont,
  };
}

export function getClassShapeSize(vm: NodeViewModel): { width: number; height: number } {
  const { width, height } = computeLayout(vm);
  return { width, height };
}

export function computeClassLayout(vm: NodeViewModel): ClassLayout {
  return computeLayout(vm);
}

interface ClassShapeProps {
  viewModel: NodeViewModel;
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
  const headerFill = vm.colorOverride ?? colors.headerBg;
  const borderStroke = vm.colorOverride ?? colors.border;
  const borderW = vm.borderWidthOverride ?? BORDER_W;
  const borderDashArr = borderDash(vm.borderStyleOverride, borderW);
  const layout = useMemo(() => computeLayout(vm), [vm]);
  const { width: W, height: H, fontSans, stereoFont, badgeFont, nameFont, secFont } = layout;

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
      <Rect
        width={W}
        height={H}
        fill={colors.bg}
        stroke={borderStroke}
        strokeWidth={borderW}
        dash={borderDashArr}
        cornerRadius={RADIUS}
        perfectDrawEnabled={false}
      />

      <Rect
        width={W}
        height={layout.headerH}
        fill={headerFill}
        cornerRadius={[RADIUS, RADIUS, 0, 0]}
        perfectDrawEnabled={false}
      />

      {stereoText !== null && layout.stereotypeY >= 0 && (
        <Text
          x={H_PAD}
          y={layout.stereotypeY + 2}
          width={W - 2 * H_PAD}
          text={stereoText}
          fontSize={stereoFont}
          fontFamily={FONT_MONO}
          fontStyle={stereoIsItalic ? 'italic' : 'normal'}
          fill={colors.border}
          align="center"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {vm.badge !== undefined && layout.badgeY >= 0 && (
        <Text
          x={H_PAD}
          y={layout.badgeY + 2}
          width={W - 2 * H_PAD}
          text={vm.badge}
          fontSize={badgeFont}
          fontFamily={fontSans}
          fill={colors.textMuted}
          align="center"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      <Text
        x={H_PAD}
        y={layout.nameY + 3}
        width={W - 2 * H_PAD}
        text={vm.sublabel ? `${vm.label}${vm.sublabel}` : vm.label}
        fontSize={nameFont}
        fontFamily={fontSans}
        fontStyle={layout.fontStyle}
        fill={colors.text}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {layout.separators.map((sepY) => (
        <Line
          key={sepY}
          points={[0, sepY, W, sepY]}
          stroke={colors.border}
          strokeWidth={BORDER_W}
          listening={false}
        />
      ))}

      {vm.sections.flatMap((section, sIdx) =>
        section.items.map((item, iIdx) => {
          const secLayout = layout.sections[sIdx];
          const itemOffset = secLayout?.itemOffsets?.[iIdx] ?? iIdx * secFont;
          const itemH = secLayout?.itemLineHeights?.[iIdx] ?? secFont;
          return (
            <Text
              key={item.id}
              x={H_PAD}
              y={(secLayout?.itemsY ?? 0) + itemOffset + 2}
              width={W - 2 * H_PAD}
              height={itemH}
              text={item.text}
              fontSize={secFont}
              fontFamily={FONT_MONO}
              fontStyle={item.isAbstract ? 'bold italic' : 'normal'}
              textDecoration={item.isStatic ? 'underline' : ''}
              fill={colors.textMuted}
              wrap="word"
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        }),
      )}

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
