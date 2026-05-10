/**
 * DomainEntityShape — Konva shape for Domain Model entity nodes.
 *
 * Layout:
 *   ┌─────────────────────────┐  ← amber border (3 px), rounded corners
 *   │  EntityName             │  ← header: name bold 14px, amber bg
 *   ├─────────────────────────┤
 *   │  attributeName          │  ← one row per attribute, name-only (no type)
 *   │  otherAttribute         │
 *   └─────────────────────────┘
 *
 * Intentionally simpler than ClassShape: no stereotype, no badge, no visibility
 * markers — emphasising the conceptual (OOAD analysis) level of abstraction.
 */

import { useMemo } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { DomainEntityViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { resolveDomainEntityColors } from '../tokens/colors';
import { measureTextWidth } from './measureText';

// ─── Layout constants ──────────────────────────────────────────────────────────

const BORDER_W = 3;
const RADIUS = 4;
const H_PAD = 12;
const HEADER_V_PAD = 10;
const ATTR_V_PAD = 6;
const NAME_FONT = 14;
const ATTR_FONT = 12;
const NAME_H = 22;
const ATTR_ROW_H = 20;
const MIN_ATTR_H = 20;
const MIN_W = 200;
const MAX_W = 400;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

interface DomainEntityLayout {
  width: number;
  height: number;
  headerH: number;
  nameY: number;
  separatorY: number;
  attrItemsY: number;
}

function computeLayout(vm: DomainEntityViewModel): DomainEntityLayout {
  const candidates = [
    measureTextWidth(vm.name, `bold ${NAME_FONT}px ${FONT_SANS}`) + 2 * H_PAD + 16,
    ...vm.attributes.map(
      (a) => measureTextWidth(a.name, `${ATTR_FONT}px ${FONT_SANS}`) + 2 * H_PAD,
    ),
  ];
  const width = Math.min(MAX_W, Math.max(MIN_W, Math.max(...candidates, 0)));

  let y = HEADER_V_PAD;
  const nameY = y;
  y += NAME_H + HEADER_V_PAD;
  const headerH = y;
  const separatorY = y;

  y += ATTR_V_PAD;
  const attrItemsY = y;
  const attrsH = vm.attributes.length > 0
    ? vm.attributes.length * ATTR_ROW_H
    : MIN_ATTR_H;
  y += attrsH + ATTR_V_PAD;

  return { width, height: y, headerH, nameY, separatorY, attrItemsY };
}

/** Returns pixel size that DomainEntityShape will occupy for a given view model. */
export function getDomainEntityShapeSize(vm: DomainEntityViewModel): { width: number; height: number } {
  const { width, height } = computeLayout(vm);
  return { width, height };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DomainEntityShapeProps {
  viewModel: DomainEntityViewModel;
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

export default function DomainEntityShape({
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
}: DomainEntityShapeProps) {
  const colors = resolveDomainEntityColors();
  const layout = useMemo(() => computeLayout(vm), [vm]);
  const { width: W, height: H } = layout;

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
      {/* ── Outer rect ──────────────────────────────────────────────────────── */}
      <Rect
        width={W}
        height={H}
        fill={colors.bg}
        stroke={colors.border}
        strokeWidth={BORDER_W}
        cornerRadius={RADIUS}
        perfectDrawEnabled={false}
      />

      {/* ── Header background ────────────────────────────────────────────────── */}
      <Rect
        width={W}
        height={layout.headerH}
        fill={colors.headerBg}
        cornerRadius={[RADIUS, RADIUS, 0, 0]}
        perfectDrawEnabled={false}
      />

      {/* ── Entity name ──────────────────────────────────────────────────────── */}
      <Text
        x={H_PAD}
        y={layout.nameY + 3}
        width={W - 2 * H_PAD}
        text={vm.name}
        fontSize={NAME_FONT}
        fontFamily={FONT_SANS}
        fontStyle="bold"
        fill={colors.text}
        align="center"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* ── Header / attributes separator ───────────────────────────────────── */}
      <Line
        points={[0, layout.separatorY, W, layout.separatorY]}
        stroke={colors.border}
        strokeWidth={BORDER_W}
        listening={false}
      />

      {/* ── Attribute rows ───────────────────────────────────────────────────── */}
      {vm.attributes.map((attr, i) => (
        <Text
          key={attr.id}
          x={H_PAD}
          y={layout.attrItemsY + i * ATTR_ROW_H + 2}
          width={W - 2 * H_PAD}
          text={attr.name}
          fontSize={ATTR_FONT}
          fontFamily={FONT_SANS}
          fill={colors.textMuted}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}

      {/* ── Selection outline ────────────────────────────────────────────────── */}
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
