/**
 * obstacleAvoidance.ts — single-step bounding-box deflection for orthogonal routes.
 *
 * Algorithm
 * ─────────
 * A standard 3-segment orthogonal route has one "elbow" segment connecting the
 * two L-shaped arms. This is the segment most likely to cross an obstacle:
 *
 *   Left/Right face → elbow is vertical   at x = midX, from y_src to y_tgt
 *   Top/Bottom face → elbow is horizontal at y = midY, from x_src to x_tgt
 *
 * When the elbow intersects one or more obstacles the algorithm:
 *   1. Collects candidates: the left and right (or top and bottom) edges of each
 *      intersecting obstacle, padded by AVOID_PAD.
 *   2. Tests each candidate midpoint against ALL obstacles.
 *   3. Returns the first passing candidate sorted by distance from the original midpoint.
 *   4. Falls back to the original route if no candidate is clean.
 *
 * Caller responsibility
 * ─────────────────────
 * The `obstacles` array must NOT include the source or target node — those
 * nodes define the route start/end and are excluded in KonvaCanvas.
 *
 * Limitations (v1.5)
 * ──────────────────
 * - Only the middle elbow segment is tested; the two outer arms can still clip
 *   an obstacle in extreme layouts.
 * - Multi-obstacle scenarios with no clean single deflection fall back to the
 *   undeflected route.
 * - No A* pathfinding — reserved for a future task.
 */

import { orthogonalRoute } from './geometry';
import type { AnchorPoint, NodeBounds, Point } from './geometry';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Clearance added around each obstacle bounding box. */
const AVOID_PAD = 20;

// ─── Segment / AABB tests ─────────────────────────────────────────────────────

/**
 * Returns true when the vertical segment at x = `segX`, spanning [y1, y2],
 * overlaps the obstacle rectangle (with a small tolerance).
 */
function vertSegHits(segX: number, y1: number, y2: number, obs: NodeBounds): boolean {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return (
    segX > obs.x &&
    segX < obs.x + obs.width &&
    maxY > obs.y &&
    minY < obs.y + obs.height
  );
}

/**
 * Returns true when the horizontal segment at y = `segY`, spanning [x1, x2],
 * overlaps the obstacle rectangle.
 */
function horizSegHits(segY: number, x1: number, x2: number, obs: NodeBounds): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  return (
    segY > obs.y &&
    segY < obs.y + obs.height &&
    maxX > obs.x &&
    minX < obs.x + obs.width
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attempts to route around obstacles using a single elbow deflection.
 * Returns a flat Konva points array (same format as `orthogonalRoute`).
 */
export function avoidObstacles(
  src: AnchorPoint,
  retractedTgt: Point,
  obstacles: NodeBounds[],
): number[] {
  if (obstacles.length === 0) return orthogonalRoute(src, retractedTgt);

  const { x: sx, y: sy } = src;
  const { x: tx, y: ty } = retractedTgt;

  switch (src.face) {
    case 'Left':
    case 'Right': {
      // Default elbow: vertical segment at midX
      const defaultMidX = (sx + tx) / 2;

      // Collect every obstacle that the default elbow intersects
      const blocking = obstacles.filter((obs) => vertSegHits(defaultMidX, sy, ty, obs));
      if (blocking.length === 0) {
        return [sx, sy, defaultMidX, sy, defaultMidX, ty, tx, ty];
      }

      // Candidates: route to the left or right of each blocking obstacle
      const candidates: number[] = [];
      for (const obs of blocking) {
        candidates.push(obs.x - AVOID_PAD);             // left of obstacle
        candidates.push(obs.x + obs.width + AVOID_PAD); // right of obstacle
      }

      // Sort by proximity to default midX (prefer minimal detour)
      candidates.sort((a, b) => Math.abs(a - defaultMidX) - Math.abs(b - defaultMidX));

      for (const midX of candidates) {
        if (!obstacles.some((obs) => vertSegHits(midX, sy, ty, obs))) {
          return [sx, sy, midX, sy, midX, ty, tx, ty];
        }
      }

      // No clean route found — render undeflected (better than nothing)
      return [sx, sy, defaultMidX, sy, defaultMidX, ty, tx, ty];
    }

    case 'Top':
    case 'Bottom': {
      // Default elbow: horizontal segment at midY
      const defaultMidY = (sy + ty) / 2;

      const blocking = obstacles.filter((obs) => horizSegHits(defaultMidY, sx, tx, obs));
      if (blocking.length === 0) {
        return [sx, sy, sx, defaultMidY, tx, defaultMidY, tx, ty];
      }

      const candidates: number[] = [];
      for (const obs of blocking) {
        candidates.push(obs.y - AVOID_PAD);              // above obstacle
        candidates.push(obs.y + obs.height + AVOID_PAD); // below obstacle
      }

      candidates.sort((a, b) => Math.abs(a - defaultMidY) - Math.abs(b - defaultMidY));

      for (const midY of candidates) {
        if (!obstacles.some((obs) => horizSegHits(midY, sx, tx, obs))) {
          return [sx, sy, sx, midY, tx, midY, tx, ty];
        }
      }

      return [sx, sy, sx, defaultMidY, tx, defaultMidY, tx, ty];
    }
  }
}
