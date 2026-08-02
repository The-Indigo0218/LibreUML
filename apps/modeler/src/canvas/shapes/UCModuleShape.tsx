import { useRef, useEffect } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { UCModuleViewModel } from '../../adapters/view-models/node.view-model';
import { resolveUCModuleColors } from '../tokens/colors';

// ─── Layout constants ──────────────────────────────────────────────────────────

export const UCM_DEFAULT_W = 380;
export const UCM_DEFAULT_H = 280;
export const UCM_MIN_W = 180;
export const UCM_MIN_H = 120;

const TAB_H = 24;
const TAB_W = 100;
const STROKE_W = 1.5;
const TITLE_FONT = 12;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const STEREO_FONT = 10;

export function getUCModuleShapeSize(vm: UCModuleViewModel): { width: number; height: number } {
  return { width: vm.width, height: vm.height };
}

interface UCModuleShapeProps {
  viewModel: UCModuleViewModel;
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

export default function UCModuleShape({
  viewModel: vm,
  x,
  y,
  selected,
  isDropTarget = false,
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
}: UCModuleShapeProps) {
  const colors = resolveUCModuleColors();
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

  // Re-sync anchor positions when the module's own size changes (e.g. after
  // onResizeEnd commits a new width/height) — the Transformer only tracks the
  // Group node's own transform, not its children's dimensions.
  useEffect(() => {
    if (!showTransformer) return;
    trRef.current?.forceUpdate();
    trRef.current?.getLayer()?.batchDraw();
  }, [showTransformer, W, H]);

  const borderColor = isDropTarget ? '#22d3ee' : colors.border;
  const strokeW = isDropTarget ? 2 : STROKE_W;

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
        {/* ── Tab (top-left folded header) ─────────────────────────────────── */}
        <Rect
          x={0}
          y={-TAB_H}
          width={TAB_W}
          height={TAB_H}
          fill={isDropTarget ? 'rgba(34,211,238,0.15)' : colors.tabBg}
          stroke={borderColor}
          strokeWidth={strokeW}
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── «module» stereotype inside tab ───────────────────────────────── */}
        <Text
          x={4}
          y={-TAB_H + 2}
          width={TAB_W - 8}
          text="«module»"
          fontSize={STEREO_FONT}
          fontFamily={FONT_SANS}
          fontStyle="italic"
          fill={colors.text}
          align="center"
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── Module name below stereotype in tab ──────────────────────────── */}
        <Text
          x={4}
          y={-TAB_H + STEREO_FONT + 3}
          width={TAB_W - 8}
          text={vm.name}
          fontSize={TITLE_FONT}
          fontFamily={FONT_SANS}
          fontStyle="bold"
          fill={colors.text}
          align="center"
          ellipsis={true}
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── Main body rectangle ──────────────────────────────────────────── */}
        <Rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill={isDropTarget ? 'rgba(34,211,238,0.06)' : colors.bodyBg}
          stroke={borderColor}
          strokeWidth={strokeW}
          listening={false}
          perfectDrawEnabled={false}
        />

        {/* ── Hit targets (borders + tab) ──────────────────────────────────── */}
        <Rect x={0} y={-TAB_H} width={TAB_W} height={TAB_H + 8} listening={true} />
        <Rect x={0} y={H - 8} width={W} height={8} listening={true} />
        <Rect x={0} y={0} width={8} height={H} listening={true} />
        <Rect x={W - 8} y={0} width={8} height={H} listening={true} />

        {/* ── Selection outline ────────────────────────────────────────────── */}
        {selected && !showTransformer && (
          <Rect
            x={-2} y={-TAB_H - 2}
            width={W + 4} height={H + TAB_H + 4}
            stroke="#22d3ee" strokeWidth={2}
            dash={[4, 3]}
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
            if (newBox.width < UCM_MIN_W * stageScale || newBox.height < UCM_MIN_H * stageScale) {
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
            onResizeEnd?.(vm.id, Math.max(UCM_MIN_W, W * sx), Math.max(UCM_MIN_H, H * sy), dx, dy);
          }}
        />
      )}
    </>
  );
}
