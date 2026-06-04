/**
 * EdgeMarker — Konva Group that renders the arrowhead / diamond at a
 * target anchor point.
 *
 * Marker coordinate convention (matches VfsUmlEdge.tsx SVG markers):
 *   - Tip at local (0, 0).
 *   - Body extends toward negative-x.
 *   - The Group is rotated by `faceToMarkerAngle(face)` so the tip always
 *     points into the node face.
 *
 * Supported kinds:
 *   GENERALIZATION / REALIZATION → hollow triangle
 *   AGGREGATION                  → hollow diamond
 *   COMPOSITION                  → filled diamond
 *   everything else              → open chevron arrow
 */

import { Group, Line } from 'react-konva';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';
import { faceToMarkerAngle, type AnchorFace } from './geometry';

function getCanvasBg(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--canvas-base').trim() || '#f8fafc'
  );
}

interface EdgeMarkerProps {
  kind: RelationKind;
  x: number;
  y: number;
  face: AnchorFace;
  stroke: string;
  /**
   * Explicit rotation (degrees) overriding the cardinal faceToMarkerAngle(face).
   * Used by floating anchors (R4) so the marker points along the true diagonal
   * arrival direction instead of snapping to one of the four cardinal angles.
   */
  angleOverride?: number;
}

export default function EdgeMarker({ kind, x, y, face, stroke, angleOverride }: EdgeMarkerProps) {
  const rotation = angleOverride ?? faceToMarkerAngle(face);
  const bg = getCanvasBg();

  switch (kind) {
    case 'GENERALIZATION':
    case 'REALIZATION':
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

    case 'AGGREGATION':
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

    case 'COMPOSITION':
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
