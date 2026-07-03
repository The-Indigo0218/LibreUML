/**
 * EdgeMarker — Konva Group that renders an endpoint glyph (arrowhead, diamond,
 * triangle or navigability ✕) at an anchor point.
 *
 * Marker coordinate convention (matches diagramToSvg.ts markers):
 *   - Tip at local (0, 0).
 *   - Body extends toward negative-x.
 *   - The Group is rotated by `faceToMarkerAngle(face)` (or `angleOverride`) so
 *     the tip always points into the node face.
 *
 * The glyph is chosen by the caller via `resolveEndMarker` (markers.ts) — this
 * component only draws the requested `shape`, so the same set of shapes renders
 * at either end (source or target).
 */

import { Group, Line } from 'react-konva';
import { faceToMarkerAngle, type AnchorFace } from './geometry';
import type { MarkerShape } from './markers';

function getCanvasBg(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--canvas-base').trim() || '#f8fafc'
  );
}

interface EdgeMarkerProps {
  shape: MarkerShape;
  x: number;
  y: number;
  face: AnchorFace;
  stroke: string;
  /**
   * Explicit rotation (degrees) overriding the cardinal faceToMarkerAngle(face).
   * Used by floating anchors so the marker points along the true diagonal
   * arrival direction instead of snapping to one of the four cardinal angles.
   */
  angleOverride?: number;
}

export default function EdgeMarker({ shape, x, y, face, stroke, angleOverride }: EdgeMarkerProps) {
  const rotation = angleOverride ?? faceToMarkerAngle(face);
  const bg = getCanvasBg();

  switch (shape) {
    case 'triangle':
      // Hollow triangle: tip at (0,0), base at x = -16
      return (
        <Group x={x} y={y} rotation={rotation} listening={false}>
          <Line
            points={[-16, -8, -16, 8, 0, 0]}
            closed={true}
            fill={bg}
            stroke={stroke}
            strokeWidth={2}
            lineJoin="round"
            perfectDrawEnabled={false}
          />
        </Group>
      );

    case 'diamondHollow':
      // Hollow diamond: right tip at (0,0), left tip at (-24, 0)
      return (
        <Group x={x} y={y} rotation={rotation} listening={false}>
          <Line
            points={[0, 0, -12, 6, -24, 0, -12, -6]}
            closed={true}
            fill={bg}
            stroke={stroke}
            strokeWidth={2}
            lineJoin="round"
            perfectDrawEnabled={false}
          />
        </Group>
      );

    case 'diamondFilled':
      // Filled diamond: same shape, fill = stroke color
      return (
        <Group x={x} y={y} rotation={rotation} listening={false}>
          <Line
            points={[0, 0, -12, 6, -24, 0, -12, -6]}
            closed={true}
            fill={stroke}
            stroke={stroke}
            strokeWidth={2}
            lineJoin="round"
            perfectDrawEnabled={false}
          />
        </Group>
      );

    case 'cross':
      // Navigability ✕ (explicitly non-navigable end). Small saltire sitting just
      // off the anchor along the line body (toward −x), rotation-aligned.
      return (
        <Group x={x} y={y} rotation={rotation} listening={false}>
          <Line points={[-12, -5, -2, 5]} stroke={stroke} strokeWidth={2} lineCap="round" perfectDrawEnabled={false} />
          <Line points={[-12, 5, -2, -5]} stroke={stroke} strokeWidth={2} lineCap="round" perfectDrawEnabled={false} />
        </Group>
      );

    case 'arrow':
    default:
      // Open chevron arrow: tip at (0,0)
      return (
        <Group x={x} y={y} rotation={rotation} listening={false}>
          <Line
            points={[-14, -7, 0, 0, -14, 7]}
            stroke={stroke}
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
            perfectDrawEnabled={false}
          />
        </Group>
      );
  }
}
