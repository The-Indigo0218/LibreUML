import { useRef, useEffect } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ActivityStructuredViewModel } from '../../adapters/view-models/node.view-model';
import { resolveSystemBoundaryColors } from '../tokens/colors';

/**
 * A structured activity node (loop / conditional / sequence / interruptible
 * region, v1.1) — a free-floating resizable container, same Transformer
 * mechanic as `SystemBoundaryShape` (this app's other free container). The
 * four kinds differ only in the header glyph and whether a test/guard
 * subtitle shows — one shape, not four, same reasoning as `ForkJoinShape`
 * covering both FORK/JOIN.
 */

export const SN_DEFAULT_W = 320;
export const SN_DEFAULT_H = 220;
export const SN_MIN_W = 160;
export const SN_MIN_H = 100;
const TITLE_FONT = 13;
const SUBTITLE_FONT = 11;
const TITLE_H = 20;
const SUBTITLE_H = 16;
const TITLE_PAD_X = 10;
const TITLE_PAD_Y = 4;
const STROKE_W = 1.5;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

const KIND_GLYPH: Record<ActivityStructuredViewModel['structuredKind'], string> = {
  LOOP_NODE: '↻',
  CONDITIONAL_NODE: '⑂',
  SEQUENCE_NODE: '→',
  INTERRUPTIBLE_REGION: '↯',
};

export function getStructuredNodeShapeSize(
  vm: ActivityStructuredViewModel,
): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface StructuredNodeShapeProps {
  viewModel: ActivityStructuredViewModel;
  x: number;
  y: number;
  selected?: boolean;
  isDropTarget?: boolean;
  opacity?: number;
  visible?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  /** Final size on release, plus the origin shift caused by left/top anchors. */
  onResizeEnd?: (id: string, width: number, height: number, dx?: number, dy?: number) => void;
}

export default function StructuredNodeShape({
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
  isDropTarget = false,
}: StructuredNodeShapeProps) {
  const colors = resolveSystemBoundaryColors();
  const W = vm.width;
  const H = vm.height;
  const hasSubtitle = !!vm.testExpression?.trim();
  const headerH = TITLE_PAD_Y + TITLE_H + (hasSubtitle ? SUBTITLE_H : 0);

  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const showTransformer = selected && !!onResizeEnd;

  useEffect(() => {
    if (!showTransformer) return;
    const tr = trRef.current;
    const group = groupRef.current;
    if (!tr || !group) return;
    tr.nodes([group]);
    tr.getLayer()?.batchDraw();
    return () => { tr.nodes([]); };
  }, [showTransformer]);

  // Re-sync anchor positions when the node's own size changes (e.g. after
  // onResizeEnd commits a new width/height) — the Transformer only tracks the
  // Group node's own transform, not its children's dimensions.
  useEffect(() => {
    if (!showTransformer) return;
    trRef.current?.forceUpdate();
    trRef.current?.getLayer()?.batchDraw();
  }, [showTransformer, W, H]);

  const headerText = `${KIND_GLYPH[vm.structuredKind]} ${vm.name}`;

  return (
    <>
      <Group
        ref={groupRef}
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
        {/* ── Dashed boundary rectangle ───────────────────────────────────── */}
        <Rect
          width={W}
          height={H}
          fill={isDropTarget ? 'rgba(34,211,238,0.06)' : 'transparent'}
          stroke={isDropTarget ? '#22d3ee' : (vm.colorOverride ?? colors.stroke)}
          strokeWidth={isDropTarget ? 2 : (vm.borderWidthOverride ?? STROKE_W)}
          dash={isDropTarget ? undefined : [8, 5]}
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── Header: kind glyph + name ────────────────────────────────────── */}
        <Text
          x={TITLE_PAD_X}
          y={TITLE_PAD_Y}
          width={W - TITLE_PAD_X * 2}
          text={headerText}
          fontSize={vm.fontSizeOverride ?? TITLE_FONT}
          fontFamily={vm.fontFamilyOverride ?? FONT_SANS}
          fill={colors.text}
          align="left"
          ellipsis
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── Test/guard subtitle (LOOP_NODE/CONDITIONAL_NODE only) ─────────── */}
        {hasSubtitle && (
          <Text
            x={TITLE_PAD_X}
            y={TITLE_PAD_Y + TITLE_H}
            width={W - TITLE_PAD_X * 2}
            text={vm.testExpression}
            fontSize={SUBTITLE_FONT}
            fontFamily={FONT_SANS}
            fontStyle="italic"
            fill={colors.text}
            opacity={0.75}
            align="left"
            ellipsis
            wrap="none"
            listening={false}
            perfectDrawEnabled={false}
          />
        )}

        {/* ── Separator below header ──────────────────────────────────────── */}
        <Rect
          x={0}
          y={headerH}
          width={W}
          height={1}
          fill={colors.stroke}
          opacity={0.4}
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── Hit targets (border strips + header area) ──────────────────────── */}
        <Rect x={0} y={0} width={W} height={headerH + 4} listening={true} />
        <Rect x={0} y={H - 8} width={W} height={8} listening={true} />
        <Rect x={0} y={0} width={8} height={H} listening={true} />
        <Rect x={W - 8} y={0} width={8} height={H} listening={true} />

        {/* ── Selection outline (only when no transformer) ─────────────────── */}
        {selected && !showTransformer && (
          <Rect
            x={-2} y={-2}
            width={W + 4} height={H + 4}
            stroke="#22d3ee" strokeWidth={2}
            dash={[6, 4]}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}
      </Group>

      {showTransformer && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          keepRatio={false}
          borderStroke="#22d3ee"
          borderStrokeWidth={2}
          borderDash={[4, 3]}
          anchorSize={8}
          anchorCornerRadius={2}
          anchorStroke="#22d3ee"
          anchorFill="#ffffff"
          anchorStrokeWidth={1}
          onMouseDown={(e) => { e.cancelBubble = true; }}
          boundBoxFunc={(oldBox, newBox) => {
            const stageScale = groupRef.current?.getStage()?.scaleX() ?? 1;
            if (newBox.width < SN_MIN_W * stageScale || newBox.height < SN_MIN_H * stageScale) {
              return oldBox;
            }
            return newBox;
          }}
          onTransformEnd={() => {
            const node = groupRef.current;
            if (!node) return;
            const sx = node.scaleX();
            const sy = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            // A left/top anchor also moves the group's origin. react-konva never
            // re-applies an x/y prop that didn't change, so put the node back and
            // report the delta — the store commit is what actually moves it.
            const dx = node.x() - x;
            const dy = node.y() - y;
            node.x(x);
            node.y(y);
            onResizeEnd?.(vm.id, Math.max(SN_MIN_W, W * sx), Math.max(SN_MIN_H, H * sy), dx, dy);
          }}
        />
      )}
    </>
  );
}
