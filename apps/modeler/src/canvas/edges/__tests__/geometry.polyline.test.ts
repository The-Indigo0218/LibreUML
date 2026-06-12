import { describe, it, expect } from 'vitest';
import { polylineRoute, straightRoute, orthogonalPolylineRoute, resolveRoutingMode, type Point } from '../geometry';

describe('polylineRoute', () => {
  const src: Point = { x: 0, y: 0 };
  const tgt: Point = { x: 100, y: 100 };

  it('returns a straight two-point array when there are no waypoints', () => {
    expect(polylineRoute(src, [], tgt)).toEqual([0, 0, 100, 100]);
  });

  it('matches straightRoute when there are no waypoints', () => {
    expect(polylineRoute(src, [], tgt)).toEqual(straightRoute(src, tgt));
  });

  it('threads the flat array through a single waypoint', () => {
    expect(polylineRoute(src, [{ x: 50, y: 0 }], tgt)).toEqual([0, 0, 50, 0, 100, 100]);
  });

  it('threads the flat array through multiple waypoints in order', () => {
    const waypoints: Point[] = [
      { x: 30, y: 10 },
      { x: 60, y: 40 },
      { x: 80, y: 90 },
    ];
    expect(polylineRoute(src, waypoints, tgt)).toEqual([
      0, 0, 30, 10, 60, 40, 80, 90, 100, 100,
    ]);
  });

  it('always starts at src and ends at tgt', () => {
    const pts = polylineRoute(src, [{ x: 5, y: 5 }], tgt);
    expect(pts.slice(0, 2)).toEqual([src.x, src.y]);
    expect(pts.slice(-2)).toEqual([tgt.x, tgt.y]);
  });
});

describe('orthogonalPolylineRoute', () => {
  const src: Point = { x: 0, y: 0 };
  const tgt: Point = { x: 100, y: 100 };

  it('inserts a right-angle elbow per diagonal leg (no waypoints)', () => {
    // |dx| === |dy| → horizontal-first elbow at (100, 0).
    expect(orthogonalPolylineRoute(src, [], tgt)).toEqual([0, 0, 100, 0, 100, 100]);
  });

  it('leads with the vertical axis when the leg is taller than wide', () => {
    const t: Point = { x: 20, y: 100 };
    expect(orthogonalPolylineRoute(src, [], t)).toEqual([0, 0, 0, 100, 20, 100]);
  });

  it('adds no elbow for axis-aligned legs', () => {
    // src→wp is horizontal, wp→tgt is vertical: already orthogonal, no extra points.
    const pts = orthogonalPolylineRoute(src, [{ x: 100, y: 0 }], tgt);
    expect(pts).toEqual([0, 0, 100, 0, 100, 100]);
  });

  it('routes orthogonally through each waypoint as a fixed bend', () => {
    const pts = orthogonalPolylineRoute(src, [{ x: 40, y: 30 }], tgt);
    expect(pts.slice(0, 2)).toEqual([0, 0]);
    expect(pts.slice(-2)).toEqual([100, 100]);
    // Every consecutive pair shares an axis (pure 90° path).
    for (let i = 0; i < pts.length - 2; i += 2) {
      const sameX = pts[i] === pts[i + 2];
      const sameY = pts[i + 1] === pts[i + 3];
      expect(sameX || sameY).toBe(true);
    }
  });

  it('keeps every segment axis-aligned through multiple waypoints', () => {
    const waypoints: Point[] = [
      { x: 40, y: 30 },
      { x: 70, y: 10 },
      { x: 85, y: 75 },
    ];
    const pts = orthogonalPolylineRoute(src, waypoints, tgt);
    expect(pts.slice(0, 2)).toEqual([0, 0]);
    expect(pts.slice(-2)).toEqual([100, 100]);
    // Each waypoint must appear verbatim (it is a fixed user bend).
    for (const w of waypoints) {
      let found = false;
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] === w.x && pts[i + 1] === w.y) { found = true; break; }
      }
      expect(found).toBe(true);
    }
    // Pure 90° path: no diagonal segments.
    for (let i = 0; i < pts.length - 2; i += 2) {
      expect(pts[i] === pts[i + 2] || pts[i + 1] === pts[i + 3]).toBe(true);
    }
  });
});

describe('orthogonalPolylineRoute — obstacle-aware leg', () => {
  const src: Point = { x: 0, y: 0 };
  const tgt: Point = { x: 100, y: 100 };

  it('keeps the dominant orientation when no obstacle is in the way', () => {
    // |dx| === |dy| → horizontal-first by default.
    expect(orthogonalPolylineRoute(src, [], tgt, [])).toEqual([0, 0, 100, 0, 100, 100]);
  });

  it('flips to the clean orientation when the dominant elbow clips a node', () => {
    // Default horizontal-first elbow runs along y=0 then x=100. Place an obstacle
    // straddling y=0 between x=0..100 so the horizontal arm clips it → expect VH.
    const obstacle = { x: 40, y: -10, width: 20, height: 20 };
    expect(orthogonalPolylineRoute(src, [], tgt, [obstacle])).toEqual([0, 0, 0, 100, 100, 100]);
  });

  it('falls back to the dominant orientation when both elbows clip', () => {
    // Obstacle over the shared corner region so neither orientation is clean.
    const big = { x: -50, y: -50, width: 200, height: 200 };
    expect(orthogonalPolylineRoute(src, [], tgt, [big])).toEqual([0, 0, 100, 0, 100, 100]);
  });
});

describe('resolveRoutingMode (legacy fallback rule)', () => {
  it('falls back to orthogonal when undefined (pre-existing edges)', () => {
    expect(resolveRoutingMode(undefined)).toBe('orthogonal');
  });

  it('returns an explicit mode unchanged (new / user-set edges)', () => {
    expect(resolveRoutingMode('straight')).toBe('straight');
    expect(resolveRoutingMode('orthogonal')).toBe('orthogonal');
    expect(resolveRoutingMode('curved')).toBe('curved');
  });
});
