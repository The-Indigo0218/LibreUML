import { useMemo } from 'react';
import { Group, Rect, Text, Shape } from 'react-konva';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { PackageViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { measureTextWidth } from './measureText';

const TAB_W = 80;
const TAB_H = 24;
const MIN_BODY_W = 200;
const MIN_BODY_H = 150;
const COLLAPSED_W = 100;
const COLLAPSED_H = 24;
const BORDER_W = 2;
const TEXT_PAD = 8;
const FONT_SIZE = 12;
const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, sans-serif';
const ICON_SIZE = 10;

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resolvePackageColors(customColor?: string) {
  const text = getCSSVar('--text-primary');
  const border = getCSSVar('--uml-class-border');
  const bg = customColor || getCSSVar('--surface-secondary');
  const tabBg = getCSSVar('--surface-hover');
  
  return { text, border, bg, tabBg };
}

export function getPackageShapeSize(
  vm: PackageViewModel,
  childBounds?: Array<{ x: number; y: number; width: number; height: number }>,
): { width: number; height: number } {
  if (vm.collapsed) {
    return { width: COLLAPSED_W, height: COLLAPSED_H };
  }

  if (!childBounds || childBounds.length === 0) {
    return { width: MIN_BODY_W, height: MIN_BODY_H };
  }

  const padding = 16;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of childBounds) {
    minX = Math.min(minX, child.x);
    minY = Math.min(minY, child.y);
    maxX = Math.max(maxX, child.x + child.width);
    maxY = Math.max(maxY, child.y + child.height);
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const width = Math.max(MIN_BODY_W, contentW + 2 * padding);
  const height = Math.max(MIN_BODY_H, contentH + 2 * padding + TAB_H);

  return { width, height };
}

interface PackageShapeProps {
  viewModel: PackageViewModel;
  x: number;
  y: number;
  width?: number;
  height?: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  dropHighlight?: 'valid' | 'invalid' | null;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

export default function PackageShape({
  viewModel: vm,
  x,
  y,
  width: providedWidth,
  height: providedHeight,
  selected,
  opacity,
  visible = true,
  dropHighlight,
  onNodeClick,
  onDblClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDragMove,
  onDragEnd,
}: PackageShapeProps) {
  const colors = resolvePackageColors(vm.color);

  const { width: W, height: H } = useMemo(() => {
    if (providedWidth !== undefined && providedHeight !== undefined) {
      return { width: providedWidth, height: providedHeight };
    }
    return getPackageShapeSize(vm);
  }, [vm, providedWidth, providedHeight]);

  const tabW = useMemo(() => {
    const textW = measureTextWidth(vm.name, `${FONT_SIZE}px ${FONT_FAMILY}`);
    return Math.max(TAB_W, textW + 2 * TEXT_PAD + ICON_SIZE + 4);
  }, [vm.name]);

  const dropStroke = dropHighlight === 'valid' ? '#22c55e' : dropHighlight === 'invalid' ? '#ef4444' : null;
  const dropStrokeWidth = dropHighlight ? 3 : 0;

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
        x={0}
        y={0}
        width={tabW}
        height={TAB_H}
        fill={colors.tabBg}
        stroke={colors.border}
        strokeWidth={BORDER_W}
        cornerRadius={[2, 2, 0, 0]}
        perfectDrawEnabled={false}
      />

      <Text
        x={TEXT_PAD}
        y={TAB_H / 2 - FONT_SIZE / 2}
        text={vm.name}
        fontSize={FONT_SIZE}
        fontFamily={FONT_FAMILY}
        fontStyle="bold"
        fill={colors.text}
        listening={false}
        perfectDrawEnabled={false}
      />

      <Shape
        sceneFunc={(ctx: Context, shape: KonvaShape) => {
          ctx.beginPath();
          ctx.moveTo(tabW - TEXT_PAD - ICON_SIZE, TAB_H / 2 - 4);
          if (vm.collapsed) {
            ctx.lineTo(tabW - TEXT_PAD - ICON_SIZE + 6, TAB_H / 2);
            ctx.lineTo(tabW - TEXT_PAD - ICON_SIZE, TAB_H / 2 + 4);
          } else {
            ctx.lineTo(tabW - TEXT_PAD - ICON_SIZE + 4, TAB_H / 2 + 4);
            ctx.lineTo(tabW - TEXT_PAD - ICON_SIZE + 8, TAB_H / 2 + 4);
          }
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
        fill={colors.text}
        listening={false}
        perfectDrawEnabled={false}
      />

      {!vm.collapsed && (
        <Rect
          x={0}
          y={TAB_H}
          width={W}
          height={H - TAB_H}
          fill={colors.bg}
          stroke={colors.border}
          strokeWidth={BORDER_W}
          perfectDrawEnabled={false}
        />
      )}

      {vm.collapsed && vm.childCount > 0 && (
        <Text
          x={tabW + 8}
          y={TAB_H / 2 - FONT_SIZE / 2}
          text={`(${vm.childCount})`}
          fontSize={FONT_SIZE - 2}
          fontFamily={FONT_FAMILY}
          fill={colors.text}
          opacity={0.6}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {dropStroke && (
        <Rect
          x={-dropStrokeWidth / 2}
          y={-dropStrokeWidth / 2}
          width={W + dropStrokeWidth}
          height={H + dropStrokeWidth}
          stroke={dropStroke}
          strokeWidth={dropStrokeWidth}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {selected && (
        <Rect
          x={-1}
          y={-1}
          width={W + 2}
          height={H + 2}
          stroke="#22d3ee"
          strokeWidth={2}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
