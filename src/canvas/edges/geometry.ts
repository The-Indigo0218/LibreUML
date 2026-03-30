/**
 * geometry.ts — pure routing utilities for Konva edge rendering.
 *
 * All functions are pure (no React, no Konva deps) and unit-testable.
 *
 * Coordinate system: world-space pixels (same as Konva node positions).
 * Flat `points` arrays follow the Konva convention: [x0, y0, x1, y1, …].
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnchorFace = 'Top' | 'Bottom' | 'Left' | 'Right';

export interface AnchorPoint extends Point {
  face: AnchorFace;
}

// ─── Anchor geometry ──────────────────────────────────────────────────────────

/** Returns 4 cardinal anchor points at the mid-edge of each side. */
export function getAnchorPoints(b: NodeBounds): AnchorPoint[] {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return [
    { x: cx,            y: b.y,            face: 'Top'    },
    { x: cx,            y: b.y + b.height, face: 'Bottom' },
    { x: b.x,           y: cy,             face: 'Left'   },
    { x: b.x + b.width, y: cy,             face: 'Right'  },
  ];
}

/**
 * Selects the closest pair of anchor points, one from each node.
 * Brute-force O(16) — acceptable for 4-anchor sets.
 */
export function selectAnchors(
  source: NodeBounds,
  target: NodeBounds,
): { src: AnchorPoint; tgt: AnchorPoint } {
  const srcAnchors = getAnchorPoints(source);
  const tgtAnchors = getAnchorPoints(target);

  let bestDist = Infinity;
  let bestSrc: AnchorPoint = srcAnchors[0];
  let bestTgt: AnchorPoint = tgtAnchors[0];

  for (const s of srcAnchors) {
    for (const t of tgtAnchors) {
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      if (d < bestDist) {
        bestDist = d;
        bestSrc = s;
        bestTgt = t;
      }
    }
  }
  return { src: bestSrc, tgt: bestTgt };
}

/**
 * Retracts the target anchor inward by `retract` px.
 * The line body terminates at the retracted point; the marker tip stays at the
 * original anchor so it visually touches the node face.
 */
export function retractAnchor(anchor: AnchorPoint, retract: number): Point {
  switch (anchor.face) {
    case 'Top':    return { x: anchor.x, y: anchor.y - retract };
    case 'Bottom': return { x: anchor.x, y: anchor.y + retract };
    case 'Left':   return { x: anchor.x - retract, y: anchor.y };
    case 'Right':  return { x: anchor.x + retract, y: anchor.y };
  }
}

// ─── Marker rotation ──────────────────────────────────────────────────────────

/**
 * Rotation angle (degrees, clockwise) for the Konva marker Group at the
 * target anchor face.
 *
 * Convention: 0° = marker tip points +x (right).  The marker path coordinates
 * follow the same convention as VfsUmlEdge.tsx — tip at (0,0), body extends
 * toward −x — so these rotations match that SVG rendering exactly.
 */
export function faceToMarkerAngle(face: AnchorFace): number {
  switch (face) {
    case 'Top':    return 90;
    case 'Left':   return 0;
    case 'Bottom': return -90;
    case 'Right':  return 180;
  }
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/**
 * Orthogonal route: two right-angle bends through a midpoint elbow.
 * Returns a flat Konva `points` array.
 *
 * Bend direction follows the source face:
 *   Top / Bottom → go vertical first, then horizontal, then vertical.
 *   Left / Right → go horizontal first, then vertical, then horizontal.
 */
export function orthogonalRoute(src: AnchorPoint, tgt: Point): number[] {
  const { x: sx, y: sy } = src;
  const { x: tx, y: ty } = tgt;

  switch (src.face) {
    case 'Top':
    case 'Bottom': {
      const midY = (sy + ty) / 2;
      return [sx, sy, sx, midY, tx, midY, tx, ty];
    }
    case 'Left':
    case 'Right': {
      const midX = (sx + tx) / 2;
      return [sx, sy, midX, sy, midX, ty, tx, ty];
    }
  }
}

/** Straight two-point route (source → target, no bends). */
export function straightRoute(src: Point, tgt: Point): number[] {
  return [src.x, src.y, tgt.x, tgt.y];
}
