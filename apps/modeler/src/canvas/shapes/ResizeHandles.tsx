import { Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

/**
 * Shared resize handles for box-like sequence shapes (G-d): three transparent
 * grabbers (right edge → width, bottom edge → height, bottom-right corner →
 * both) that resize from the shape's top-left anchor. The parent owns the live
 * preview (`onResize`) and persistence (`onCommit`); this component is purely
 * geometric so fragments, interaction-uses, etc. don't each reimplement it.
 */

const HANDLE = 7;
const CORNER_COLOR = '#22d3ee';

interface ResizeHandlesProps {
  w: number;
  h: number;
  /** Minimum width/height the handles clamp to. */
  minW?: number;
  minH?: number;
  /** Live preview while dragging. */
  onResize: (w: number, h: number) => void;
  /** Final size on release. */
  onCommit: (w: number, h: number) => void;
}

export default function ResizeHandles({ w, h, minW = 40, minH = 24, onResize, onCommit }: ResizeHandlesProps) {
  const cursor = (e: KonvaEventObject<MouseEvent>, c: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = c;
  };
  return (
    <>
      {/* Right edge → width */}
      <Rect
        x={w - HANDLE / 2}
        y={HANDLE}
        width={HANDLE}
        height={Math.max(0, h - 2 * HANDLE)}
        fill="transparent"
        draggable
        onMouseEnter={(e) => cursor(e, 'ew-resize')}
        onMouseLeave={(e) => cursor(e, 'default')}
        dragBoundFunc={function (pos) {
          return { x: pos.x, y: this.getAbsolutePosition().y };
        }}
        onDragStart={(e) => { e.cancelBubble = true; }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          onResize(Math.max(minW, e.target.x() + HANDLE / 2), h);
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          const nw = Math.max(minW, e.target.x() + HANDLE / 2);
          e.target.position({ x: w - HANDLE / 2, y: HANDLE });
          onCommit(nw, h);
        }}
      />
      {/* Bottom edge → height */}
      <Rect
        x={HANDLE}
        y={h - HANDLE / 2}
        width={Math.max(0, w - 2 * HANDLE)}
        height={HANDLE}
        fill="transparent"
        draggable
        onMouseEnter={(e) => cursor(e, 'ns-resize')}
        onMouseLeave={(e) => cursor(e, 'default')}
        dragBoundFunc={function (pos) {
          return { x: this.getAbsolutePosition().x, y: pos.y };
        }}
        onDragStart={(e) => { e.cancelBubble = true; }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          onResize(w, Math.max(minH, e.target.y() + HANDLE / 2));
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          const nh = Math.max(minH, e.target.y() + HANDLE / 2);
          e.target.position({ x: HANDLE, y: h - HANDLE / 2 });
          onCommit(w, nh);
        }}
      />
      {/* Bottom-right corner → both */}
      <Rect
        x={w - HANDLE / 2}
        y={h - HANDLE / 2}
        width={HANDLE}
        height={HANDLE}
        fill={CORNER_COLOR}
        opacity={0.5}
        draggable
        onMouseEnter={(e) => cursor(e, 'nwse-resize')}
        onMouseLeave={(e) => cursor(e, 'default')}
        onDragStart={(e) => { e.cancelBubble = true; }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          onResize(
            Math.max(minW, e.target.x() + HANDLE / 2),
            Math.max(minH, e.target.y() + HANDLE / 2),
          );
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          const nw = Math.max(minW, e.target.x() + HANDLE / 2);
          const nh = Math.max(minH, e.target.y() + HANDLE / 2);
          e.target.position({ x: w - HANDLE / 2, y: h - HANDLE / 2 });
          onCommit(nw, nh);
        }}
      />
    </>
  );
}
