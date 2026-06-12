import { describe, it, expect } from 'vitest';
import { arrivalAngle, faceToMarkerAngle, type Point } from '../geometry';

describe('arrivalAngle — marker rotation from the last segment', () => {
  const origin: Point = { x: 0, y: 0 };

  it('matches the cardinal face angles for axis-aligned arrivals', () => {
    // Travel +x → enters the Left face; matches faceToMarkerAngle('Left') = 0.
    expect(arrivalAngle(origin, { x: 10, y: 0 })).toBeCloseTo(faceToMarkerAngle('Left'));
    // Travel +y (downward) → Top face = 90.
    expect(arrivalAngle(origin, { x: 0, y: 10 })).toBeCloseTo(faceToMarkerAngle('Top'));
    // Travel -x → Right face = 180.
    expect(Math.abs(arrivalAngle(origin, { x: -10, y: 0 })!)).toBeCloseTo(180);
    // Travel -y (upward) → Bottom face = -90.
    expect(arrivalAngle(origin, { x: 0, y: -10 })).toBeCloseTo(faceToMarkerAngle('Bottom'));
  });

  it('follows the true diagonal instead of snapping to a cardinal angle', () => {
    expect(arrivalAngle(origin, { x: 10, y: 10 })).toBeCloseTo(45);
    expect(arrivalAngle(origin, { x: -10, y: -10 })).toBeCloseTo(-135);
  });

  it('uses the last waypoint as the segment start', () => {
    const lastWaypoint: Point = { x: 100, y: 100 };
    const tgt: Point = { x: 110, y: 100 };
    expect(arrivalAngle(lastWaypoint, tgt)).toBeCloseTo(0);
  });

  it('returns undefined when the points coincide (caller falls back to face)', () => {
    expect(arrivalAngle(origin, { x: 0, y: 0 })).toBeUndefined();
  });
});
