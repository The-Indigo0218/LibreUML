import { describe, it, expect } from 'vitest';
import { polylineRoute, straightRoute, type Point } from '../geometry';

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
