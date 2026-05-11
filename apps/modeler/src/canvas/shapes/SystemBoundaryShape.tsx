import { useRef, useEffect } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { SystemBoundaryViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import { resolveSystemBoundaryColors } from '../tokens/colors';

// ─── Layout constants ──────────────────────────────────────────────────────────

export const SB_DEFAULT_W = 420;
export const SB_DEFAULT_H = 320;
export const SB_MIN_W = 200;
export const SB_MIN_H = 150;
const TITLE_FONT = 13;
const TITLE_H = 22;
const TITLE_PAD_X = 10;
const TITLE_PAD_Y = 4;
const STROKE_W = 1.5;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

export function getSystemBoundaryShapeSize(vm: SystemBoundaryViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface SystemBoundaryShapeProps {
  viewModel: SystemBoundaryViewModel;
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
  onResizeEnd?: (id: string, width: number, height: number) => void;
}

export default function SystemBoundaryShape({
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
}: SystemBoundaryShapeProps) {
  const colors = resolveSystemBoundaryColors();
  const W = vm.width;
  const H = vm.height;

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
          stroke={isDropTarget ? '#22d3ee' : colors.stroke}
          strokeWidth={isDropTarget ? 2 : STROKE_W}
          dash={isDropTarget ? undefined : [8, 5]}
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── System name label ────────────────────────────────────────────── */}
        <Text
          x={TITLE_PAD_X}
          y={TITLE_PAD_Y}
          width={W - TITLE_PAD_X * 2}
          text={vm.name}
          fontSize={TITLE_FONT}
          fontFamily={FONT_SANS}
          fill={colors.text}
          align="left"
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── Separator below title ─────────────────────────────────────────── */}
        <Rect
          x={0}
          y={TITLE_PAD_Y + TITLE_H}
          width={W}
          height={1}
          fill={colors.stroke}
          opacity={0.4}
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── Hit targets (border strips + title area) ──────────────────────── */}
        <Rect x={0} y={0} width={W} height={TITLE_H + TITLE_PAD_Y + 4} listening={true} />
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
          boundBoxFunc={(oldBox, newBox) => {
            const stageScale = groupRef.current?.getStage()?.scaleX() ?? 1;
            if (newBox.width < SB_MIN_W * stageScale || newBox.height < SB_MIN_H * stageScale) {
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
            onResizeEnd?.(vm.id, Math.max(SB_MIN_W, W * sx), Math.max(SB_MIN_H, H * sy));
          }}
        />
      )}
    </>
  );
}
