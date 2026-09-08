import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivityPartitionViewModel } from '../../adapters/view-models/node.view-model';
import { PARTITION_HEADER_H } from '../engine/partitionLayout';
import { borderDash } from './borderStyle';

const BORDER_W = 2;
const FONT_SIZE = 12;
/** Name font shrinks to this when a trace subtitle needs the second line. */
const FONT_SIZE_WITH_TRACE = 11;
const TRACE_FONT_SIZE = 9;
const TRACE_COLOR = '#38bdf8';
const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, sans-serif';
const BUTTON_SIZE = 16;
const BUTTON_GAP = 2;

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resolveColors(customColor?: string) {
  const text = getCSSVar('--text-primary');
  const border = getCSSVar('--uml-class-border');
  const headerBg = customColor || getCSSVar('--surface-secondary');
  const bodyBg = getCSSVar('--surface-primary');
  return { text, border, headerBg, bodyBg };
}

export interface PartitionShapeProps {
  viewModel: ActivityPartitionViewModel;
  x: number;
  y: number;
  width: number;
  height: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  dropHighlight?: 'valid' | 'invalid' | null;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  /**
   * Right-edge only, reported once on release — a lane's own origin never
   * moves (its `x` is derived from the whole row), so this never needs the
   * dx/dy compensation a free container's Transformer does.
   */
  onResizeEnd?: (id: string, width: number, height: number) => void;
}

const MIN_PARTITION_WIDTH = 120;

export default function PartitionShape({
  viewModel: vm,
  x,
  y,
  width: W,
  height: H,
  selected,
  opacity,
  visible = true,
  dropHighlight,
  onDblClick,
  onContextMenu,
  onResizeEnd,
}: PartitionShapeProps) {
  const colors = resolveColors(vm.colorOverride);
  const borderDashArr = borderDash(undefined, BORDER_W);
  const dropStroke = dropHighlight === 'valid' ? '#22c55e' : dropHighlight === 'invalid' ? '#ef4444' : null;

  let buttonX = 6;
  const moveLeftX = vm.canMoveLeft ? buttonX : null;
  if (vm.canMoveLeft) buttonX += BUTTON_SIZE + BUTTON_GAP;
  const moveRightX = vm.canMoveRight ? buttonX : null;
  if (vm.canMoveRight) buttonX += BUTTON_SIZE + BUTTON_GAP;

  return (
    <Group
      id={vm.id}
      x={x}
      y={y}
      opacity={opacity}
      visible={visible}
      listening={true}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        onContextMenu?.(e, vm.id);
      }}
    >
      {/* Body — drawn first so nodes render on top of it in their own layer. */}
      <Rect
        x={0}
        y={PARTITION_HEADER_H}
        width={W}
        height={H - PARTITION_HEADER_H}
        fill={colors.bodyBg}
        stroke={colors.border}
        strokeWidth={BORDER_W}
        dash={borderDashArr}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* Header */}
      <Rect
        x={0}
        y={0}
        width={W}
        height={PARTITION_HEADER_H}
        fill={colors.headerBg}
        stroke={colors.border}
        strokeWidth={BORDER_W}
        dash={borderDashArr}
        perfectDrawEnabled={false}
        onDblClick={(e) => {
          e.cancelBubble = true;
          onDblClick?.(e);
        }}
      />

      {vm.representsName ? (
        <>
          <Text
            x={buttonX + 4}
            y={4}
            width={Math.max(0, W - buttonX - 8)}
            text={vm.name}
            fontSize={FONT_SIZE_WITH_TRACE}
            fontFamily={FONT_FAMILY}
            fontStyle="bold"
            fill={colors.text}
            align="center"
            listening={false}
            perfectDrawEnabled={false}
          />
          {/* ADR-0010: the lane's responsible class/actor. Clicking jumps to
              wherever that element is drawn — same idea as Lifeline.decomposedAs. */}
          <Text
            x={buttonX + 4}
            y={PARTITION_HEADER_H - TRACE_FONT_SIZE - 3}
            width={Math.max(0, W - buttonX - 8)}
            text={`↗ ${vm.representsName}`}
            fontSize={TRACE_FONT_SIZE}
            fontFamily={FONT_FAMILY}
            fontStyle="italic"
            fill={TRACE_COLOR}
            align="center"
            ellipsis
            wrap="none"
            onClick={(e) => {
              e.cancelBubble = true;
              vm.onNavigateToRepresents?.();
            }}
            perfectDrawEnabled={false}
          />
        </>
      ) : (
        <Text
          x={buttonX + 4}
          y={PARTITION_HEADER_H / 2 - FONT_SIZE / 2}
          width={Math.max(0, W - buttonX - 8)}
          text={vm.name}
          fontSize={FONT_SIZE}
          fontFamily={FONT_FAMILY}
          fontStyle="bold"
          fill={colors.text}
          align="center"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {moveLeftX !== null && (
        <Text
          x={moveLeftX}
          y={PARTITION_HEADER_H / 2 - FONT_SIZE / 2}
          width={BUTTON_SIZE}
          text="‹"
          fontSize={FONT_SIZE}
          fontFamily={FONT_FAMILY}
          fill={colors.text}
          align="center"
          onClick={(e) => {
            e.cancelBubble = true;
            vm.onMoveLeft?.();
          }}
          perfectDrawEnabled={false}
        />
      )}

      {moveRightX !== null && (
        <Text
          x={moveRightX}
          y={PARTITION_HEADER_H / 2 - FONT_SIZE / 2}
          width={BUTTON_SIZE}
          text="›"
          fontSize={FONT_SIZE}
          fontFamily={FONT_FAMILY}
          fill={colors.text}
          align="center"
          onClick={(e) => {
            e.cancelBubble = true;
            vm.onMoveRight?.();
          }}
          perfectDrawEnabled={false}
        />
      )}

      <Text
        x={W - BUTTON_SIZE - 6}
        y={PARTITION_HEADER_H / 2 - FONT_SIZE / 2}
        width={BUTTON_SIZE}
        text="×"
        fontSize={FONT_SIZE}
        fontFamily={FONT_FAMILY}
        fill={colors.text}
        align="center"
        onClick={(e) => {
          e.cancelBubble = true;
          vm.onDelete?.();
        }}
        perfectDrawEnabled={false}
      />

      {/* Right-edge resize handle: dragging only ever changes this lane's own
          width, never its (or a sibling's derived) x — so no dx/dy compensation
          is needed, unlike a free container's Transformer. The handle itself
          slides during the drag (native Konva feedback); the lane's own body
          only snaps to the new width on release. */}
      {onResizeEnd && (
        <Rect
          x={W - 4}
          y={PARTITION_HEADER_H}
          width={8}
          height={H - PARTITION_HEADER_H}
          fill="transparent"
          draggable
          onDragEnd={(e) => {
            const deltaX = e.target.x() - (W - 4);
            e.target.position({ x: W - 4, y: PARTITION_HEADER_H });
            const newWidth = Math.max(MIN_PARTITION_WIDTH, Math.round(W + deltaX));
            onResizeEnd(vm.id, newWidth, H);
          }}
          hitStrokeWidth={12}
        />
      )}

      {dropStroke && (
        <Rect
          x={-2}
          y={-2}
          width={W + 4}
          height={H + 4}
          stroke={dropStroke}
          strokeWidth={3}
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
