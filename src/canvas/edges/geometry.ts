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

// ─── Curved routing ───────────────────────────────────────────────────────────

/** Outward unit direction for each face (away from the node body). */
function faceOutward(face: AnchorFace): [number, number] {
  switch (face) {
    case 'Top':    return [0, -1];
    case 'Bottom': return [0,  1];
    case 'Left':   return [-1, 0];
    case 'Right':  return [ 1, 0];
  }
}

/**
 * Cubic Bezier route.
 * Returns an 8-element flat array: [x0,y0, cp1x,cp1y, cp2x,cp2y, x1,y1].
 * Use with Konva `<Line bezier={true}>`.
 *
 * Control points extend outward from each anchor face, scaled to 40 % of the
 * straight-line distance (min 60 px) so the curve reads naturally at all scales.
 */
export function curvedRoute(
  src: AnchorPoint,
  retractedTgt: Point,
  tgtFace: AnchorFace,
): number[] {
  const dist = Math.hypot(retractedTgt.x - src.x, retractedTgt.y - src.y);
  const cpLen = Math.max(60, dist * 0.4);

  const [sdx, sdy] = faceOutward(src.face);
  const [tdx, tdy] = faceOutward(tgtFace);

  return [
    src.x,                        src.y,
    src.x + sdx * cpLen,          src.y + sdy * cpLen,          // cp1
    retractedTgt.x + tdx * cpLen, retractedTgt.y + tdy * cpLen, // cp2
    retractedTgt.x,               retractedTgt.y,
  ];
}

// ─── Self-loop routing ────────────────────────────────────────────────────────

export interface SelfLoopResult {
  /** 8-element flat bezier array for Konva <Line bezier={true}>. */
  points: number[];
  /** Marker tip position (original, non-retracted anchor). */
  markerX: number;
  markerY: number;
  markerFace: AnchorFace;
}

/**
 * Self-loop path for an edge whose source and target are the same node.
 *
 * The loop exits the right face (~35 % down) and re-enters the top face
 * (~70 % right), curving through the upper-right quadrant.
 * `retract` shifts the bezier endpoint inward so the line body meets the
 * base of the marker (same role as `retractAnchor` for straight edges).
 */
export function selfLoopPath(bounds: NodeBounds, retract: number): SelfLoopResult {
  const OFF = 52; // loop extension outside the node bounding box

  // Exit anchor — right face, 35 % down
  const exitX = bounds.x + bounds.width;
  const exitY = bounds.y + bounds.height * 0.35;

  // Entry anchor tip — top face, 70 % right
  const entryX = bounds.x + bounds.width * 0.7;
  const entryY = bounds.y;

  // Retract the endpoint so the line body terminates before the marker tip
  const retractedEntryY = entryY - retract;

  return {
    points: [
      exitX,                  exitY,
      exitX + OFF * 1.5,      exitY - OFF * 0.25,      // cp1: far right, slightly up
      entryX + OFF * 0.5,     retractedEntryY - OFF,   // cp2: above-right of entry
      entryX,                 retractedEntryY,
    ],
    markerX: entryX,
    markerY: entryY,
    markerFace: 'Top',
  };
}
