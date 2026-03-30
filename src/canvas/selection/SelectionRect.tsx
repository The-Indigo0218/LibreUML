/**
 * SelectionRect — Konva Rect that visualises the lasso selection marquee.
 *
 * Rendered on the selection layer (above edges, above nodes) so it overlays
 * the entire canvas.  Coordinates are in world space (same as node positions);
 * the parent Stage's transform handles screen-space scaling.
 */

import { Rect } from 'react-konva';

interface SelectionRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function SelectionRect({ x, y, width, height }: SelectionRectProps) {
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(34, 211, 238, 0.08)"
      stroke="#22d3ee"
      strokeWidth={1}
      dash={[4, 3]}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
