/**
 * geometry.ts — pure routing utilities for Konva edge rendering.
 *
 * All functions are pure (no React, no Konva deps) and unit-testable.
 *
 * Coordinate system: world-space pixels (same as Konva node positions).
 * Flat `points` arrays follow the Konva convention: [x0, y0, x1, y1, …].
 */

import type { EdgeRoutingMode } from '../../core/domain/vfs/vfs.types';

export interface Point {
  x: number;
  y: number;
}

/**
 * Resolves the routing mode actually used to render an edge.
 *
 * Undefined falls back to 'orthogonal' so edges saved before per-edge routing
 * modes existed keep their original look; freshly drawn edges carry an explicit
 * mode (created as 'straight'). This is the single source of truth for the
 * backward-compatibility rule — used by both KonvaEdge (render) and the toolbar
 * (which mode the popover highlights).
 */
export function resolveRoutingMode(mode?: EdgeRoutingMode): EdgeRoutingMode {
  return mode ?? 'orthogonal';
}

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnchorFace = 'Top' | 'Bottom' | 'Left' | 'Right';

/** Geometric outline of a node — rectangles (most shapes) or ellipses (UseCase ovals). */
export type NodeShape = 'rect' | 'ellipse';

/**
 * 8-position handle label used to persist a locked anchor.
 * Cardinal midpoints (T/B/L/R) + corners (TL/TR/BL/BR).
 */
export type LockedHandle = 'T' | 'B' | 'L' | 'R' | 'TL' | 'TR' | 'BL' | 'BR';

export interface AnchorPoint extends Point {
  face: AnchorFace;
  /** True for corner anchors — face is assigned dynamically by selectAnchors. */
  isCorner?: boolean;
}

/**
 * Returns 8 anchor points: 4 cardinal midpoints + 4 corners.
 * Corner faces are placeholder values; selectAnchors reassigns them dynamically
 * based on the direction toward the opposing anchor.
 */
export function getAnchorPoints(b: NodeBounds): AnchorPoint[] {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return [
    // Cardinal midpoints
    { x: cx,            y: b.y,            face: 'Top'    },
    { x: cx,            y: b.y + b.height, face: 'Bottom' },
    { x: b.x,           y: cy,             face: 'Left'   },
    { x: b.x + b.width, y: cy,             face: 'Right'  },
    // Corners (face assigned in selectAnchors)
    { x: b.x,           y: b.y,            face: 'Top',    isCorner: true },
    { x: b.x + b.width, y: b.y,            face: 'Top',    isCorner: true },
    { x: b.x,           y: b.y + b.height, face: 'Bottom', isCorner: true },
    { x: b.x + b.width, y: b.y + b.height, face: 'Bottom', isCorner: true },
  ];
}

/**
 * Assigns a cardinal face to a corner anchor based on the direction from the
 * corner toward the other endpoint.
 *
 * For a SOURCE corner: face points toward the target → determines first-segment
 * direction in orthogonalRoute / outward control-point in curvedRoute.
 *
 * For a TARGET corner: face points toward the source → gives the arrival
 * direction used by faceToMarkerAngle (marker rotation) and retractAnchor.
 */
function assignCornerFace(corner: Point, other: Point): AnchorFace {
  const dx = other.x - corner.x;
  const dy = other.y - corner.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? (dx >= 0 ? 'Right' : 'Left')
    : (dy >= 0 ? 'Bottom' : 'Top');
}

/**
 * Selects the closest pair of anchor points, one from each node.
 * Considers all 8 anchors (4 cardinal + 4 corners) — O(64).
 * Corner anchors get a dynamically computed face after selection.
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

  // Assign dynamic faces to any corner anchor in the winning pair
  const src = bestSrc.isCorner
    ? { ...bestSrc, face: assignCornerFace(bestSrc, bestTgt) }
    : bestSrc;
  const tgt = bestTgt.isCorner
    ? { ...bestTgt, face: assignCornerFace(bestTgt, bestSrc) }
    : bestTgt;

  return { src, tgt };
}

/**
 * Converts a computed AnchorPoint to the nearest LockedHandle label.
 * Called when the user locks an edge to snapshot the current anchor position.
 */
export function anchorPointToHandle(bounds: NodeBounds, pt: AnchorPoint): LockedHandle {
  const cx = bounds.x + bounds.width  / 2;
  const cy = bounds.y + bounds.height / 2;
  const EDGE_TOL = 3; // px tolerance for "on the node edge"

  const onTop    = pt.y <= bounds.y             + EDGE_TOL;
  const onBottom = pt.y >= bounds.y + bounds.height - EDGE_TOL;
  const onLeft   = pt.x <= bounds.x             + EDGE_TOL;
  const onRight  = pt.x >= bounds.x + bounds.width  - EDGE_TOL;
  const nearCx   = Math.abs(pt.x - cx) <= bounds.width  * 0.3;
  const nearCy   = Math.abs(pt.y - cy) <= bounds.height * 0.3;

  if (onTop    && nearCx)  return 'T';
  if (onBottom && nearCx)  return 'B';
  if (onLeft   && nearCy)  return 'L';
  if (onRight  && nearCy)  return 'R';
  if (onTop    && onLeft)  return 'TL';
  if (onTop    && onRight) return 'TR';
  if (onBottom && onLeft)  return 'BL';
  if (onBottom && onRight) return 'BR';

  // Fallback: nearest named position
  const { x, y, width: w, height: h } = bounds;
  const candidates: [LockedHandle, number, number][] = [
    ['T',  cx,   y],      ['B',  cx,   y+h],
    ['L',  x,    cy],     ['R',  x+w,  cy],
    ['TL', x,    y],      ['TR', x+w,  y],
    ['BL', x,    y+h],    ['BR', x+w,  y+h],
  ];
  let best: LockedHandle = 'T';
  let bestDist = Infinity;
  for (const [handle, hx, hy] of candidates) {
    const d = Math.hypot(pt.x - hx, pt.y - hy);
    if (d < bestDist) { bestDist = d; best = handle; }
  }
  return best;
}

/**
 * Reconstructs an AnchorPoint from a stored LockedHandle.
 * Corner anchors are returned with a placeholder face — callers must
 * use resolveLockedAnchors (which assigns dynamic corner faces) instead
 * of calling this directly.
 */
function handleToAnchorPoint(bounds: NodeBounds, handle: LockedHandle): AnchorPoint {
  const cx = bounds.x + bounds.width  / 2;
  const cy = bounds.y + bounds.height / 2;
  const { x, y, width: w, height: h } = bounds;
  switch (handle) {
    case 'T':  return { x: cx,   y,     face: 'Top'    };
    case 'B':  return { x: cx,   y: y+h, face: 'Bottom' };
    case 'L':  return { x,       y: cy,  face: 'Left'   };
    case 'R':  return { x: x+w,  y: cy,  face: 'Right'  };
    case 'TL': return { x,       y,      face: 'Top',    isCorner: true };
    case 'TR': return { x: x+w,  y,      face: 'Top',    isCorner: true };
    case 'BL': return { x,       y: y+h, face: 'Bottom', isCorner: true };
    case 'BR': return { x: x+w,  y: y+h, face: 'Bottom', isCorner: true };
  }
}

/**
 * Returns fixed anchor points from stored LockedHandle labels, with correct
 * dynamic corner faces (same algorithm as selectAnchors).
 * Drop-in replacement for selectAnchors when anchorLocked is true.
 */
export function resolveLockedAnchors(
  sourceBounds: NodeBounds,
  targetBounds: NodeBounds,
  srcHandle: LockedHandle,
  tgtHandle: LockedHandle,
): { src: AnchorPoint; tgt: AnchorPoint } {
  const rawSrc = handleToAnchorPoint(sourceBounds, srcHandle);
  const rawTgt = handleToAnchorPoint(targetBounds, tgtHandle);
  const src = rawSrc.isCorner ? { ...rawSrc, face: assignCornerFace(rawSrc, rawTgt) } : rawSrc;
  const tgt = rawTgt.isCorner ? { ...rawTgt, face: assignCornerFace(rawTgt, rawSrc) } : rawTgt;
  return { src, tgt };
}

/**
 * Floating anchor (R4): intersection of the ray from `from` (the node center)
 * toward `to` (the opposing endpoint, usually the other node's center) with this
 * node's border. Unlike selectAnchors — which snaps to one of 8 fixed handles —
 * the returned point slides freely along the border so the edge enters radially.
 *
 * `shape` picks the outline: 'rect' (bounding box) or 'ellipse' (UseCase ovals).
 * The returned `face` is the dominant cardinal side the point lands on; it drives
 * marker retraction fallback and label sidedness (the marker itself can rotate to
 * the true line direction via directionToAngle).
 *
 * Degenerate `from === to` falls back to the Right-face midpoint.
 */
export function edgeIntersection(
  b: NodeBounds,
  from: Point,
  to: Point,
  shape: NodeShape = 'rect',
): AnchorPoint {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const hw = b.width / 2;
  const hh = b.height / 2;

  const dy = to.y - from.y;
  // Degenerate from === to: aim Right so we still return a border point.
  const dx = to.x - from.x === 0 && dy === 0 ? 1 : to.x - from.x;

  let s: number;
  if (shape === 'ellipse') {
    // Scale the direction so the point lands on the ellipse (x/a)² + (y/b)² = 1.
    const nx = dx / (hw || 1);
    const ny = dy / (hh || 1);
    s = 1 / Math.hypot(nx, ny);
  } else {
    // Rectangle: shortest scale that reaches a vertical or horizontal side.
    const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
    const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
    s = Math.min(tx, ty);
  }

  const px = cx + dx * s;
  const py = cy + dy * s;

  // Dominant face: which border (relative to the node's aspect) the ray exits.
  const face: AnchorFace =
    Math.abs(dx) / (hw || 1) >= Math.abs(dy) / (hh || 1)
      ? dx >= 0 ? 'Right' : 'Left'
      : dy >= 0 ? 'Bottom' : 'Top';

  return { x: px, y: py, face };
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

/**
 * Marker rotation (degrees, clockwise) for a freely-angled arrival direction
 * (floating anchors, R4). `(dx, dy)` is the direction of travel into the target
 * (source → target). Returns the angle so the marker tip points along it.
 *
 * Matches faceToMarkerAngle for the four cardinal directions:
 *   →(1,0)=0 (enters Left face) · ↓(0,1)=90 (Top) · ←(−1,0)=180 (Right) · ↑(0,−1)=−90 (Bottom).
 */
export function directionToAngle(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

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

/**
 * Polyline route through explicit user waypoints (R3).
 * Returns a flat Konva points array: [src, ...waypoints, tgt].
 *
 * Used when an edge carries manual waypoints — it overrides automatic routing
 * (orthogonal / curved) so the user's bends are respected verbatim. Reconciling
 * manual waypoints with orthogonal auto-routing (keeping 90° on the auto
 * segments) is a separate concern (R6).
 */
export function polylineRoute(src: Point, waypoints: Point[], tgt: Point): number[] {
  const pts: number[] = [src.x, src.y];
  for (const w of waypoints) pts.push(w.x, w.y);
  pts.push(tgt.x, tgt.y);
  return pts;
}

/**
 * True when the axis-aligned segment (x1,y1)-(x2,y2) overlaps any obstacle rect.
 * Bounding-box overlap with strict edges (matches obstacleAvoidance's hit tests).
 */
function axisSegHits(x1: number, y1: number, x2: number, y2: number, obstacles: NodeBounds[]): boolean {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  return obstacles.some(
    (o) => maxX > o.x && minX < o.x + o.width && maxY > o.y && minY < o.y + o.height,
  );
}

/**
 * Orthogonal route through explicit user waypoints (R6).
 *
 * Reconciles auto-orthogonal routing with manual bends: the waypoints stay fixed
 * (the user "pins" them), but each leg between two consecutive control points is
 * connected with a single right-angle elbow instead of a diagonal. The elbow leads
 * with the dominant axis (horizontal-first when |dx| ≥ |dy|, else vertical-first)
 * so the path reads naturally; when `obstacles` are supplied and the dominant
 * orientation would clip a node, the other orientation is used if it is clean.
 * Legs that are already axis-aligned add no elbow.
 *
 * Because the endpoints come from the live node bounds, the elbows recompute on
 * every move while the waypoints remain user-fixed — "the lines settle themselves".
 */
export function orthogonalPolylineRoute(
  src: Point,
  waypoints: Point[],
  tgt: Point,
  obstacles: NodeBounds[] = [],
): number[] {
  const ctrl: Point[] = [src, ...waypoints, tgt];
  const out: number[] = [src.x, src.y];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const a = ctrl[i];
    const b = ctrl[i + 1];
    if (a.x !== b.x && a.y !== b.y) {
      // Two possible elbows. Prefer the dominant-axis one; if it clips an obstacle
      // and the alternative is clean, take the alternative.
      let horizontalFirst = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
      if (obstacles.length > 0) {
        // horizontal-first elbow corner (b.x, a.y); vertical-first corner (a.x, b.y)
        const hvHits = axisSegHits(a.x, a.y, b.x, a.y, obstacles) || axisSegHits(b.x, a.y, b.x, b.y, obstacles);
        const vhHits = axisSegHits(a.x, a.y, a.x, b.y, obstacles) || axisSegHits(a.x, b.y, b.x, b.y, obstacles);
        const preferredHits = horizontalFirst ? hvHits : vhHits;
        const altHits = horizontalFirst ? vhHits : hvHits;
        if (preferredHits && !altHits) horizontalFirst = !horizontalFirst;
      }
      if (horizontalFirst) {
        out.push(b.x, a.y); // horizontal then vertical
      } else {
        out.push(a.x, b.y); // vertical then horizontal
      }
    }
    out.push(b.x, b.y);
  }
  return out;
}

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
