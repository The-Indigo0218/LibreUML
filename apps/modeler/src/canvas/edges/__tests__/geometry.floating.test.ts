import { describe, it, expect } from 'vitest';
import {
  edgeIntersection,
  directionToAngle,
  faceToMarkerAngle,
  type NodeBounds,
  type Point,
} from '../geometry';

describe('edgeIntersection — rectangle', () => {
  // 100×100 box centered at (50, 50)
  const box: NodeBounds = { x: 0, y: 0, width: 100, height: 100 };
  const center: Point = { x: 50, y: 50 };

  it('exits the Right face when aiming straight right', () => {
    const p = edgeIntersection(box, center, { x: 200, y: 50 }, 'rect');
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
    expect(p.face).toBe('Right');
  });

  it('exits the Left face when aiming straight left', () => {
    const p = edgeIntersection(box, center, { x: -200, y: 50 }, 'rect');
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(50);
    expect(p.face).toBe('Left');
  });

  it('exits the Top face when aiming straight up', () => {
    const p = edgeIntersection(box, center, { x: 50, y: -200 }, 'rect');
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
    expect(p.face).toBe('Top');
  });

  it('exits the Bottom face when aiming straight down', () => {
    const p = edgeIntersection(box, center, { x: 50, y: 200 }, 'rect');
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(100);
    expect(p.face).toBe('Bottom');
  });

  it('lands on the diagonal corner for a 45° square aim', () => {
    // Square box → a 45° ray exits exactly at the corner (100, 100).
    const p = edgeIntersection(box, center, { x: 150, y: 150 }, 'rect');
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(100);
  });

  it('slides along the border (point is not a fixed cardinal handle)', () => {
    // Shallow downward-right aim exits the right side somewhere below the midpoint.
    const p = edgeIntersection(box, center, { x: 200, y: 90 }, 'rect');
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeGreaterThan(50);
    expect(p.y).toBeLessThan(100);
    expect(p.face).toBe('Right');
  });

  it('falls back to the Right-face midpoint for a degenerate from === to', () => {
    const p = edgeIntersection(box, center, center, 'rect');
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
    expect(p.face).toBe('Right');
  });
});

describe('edgeIntersection — ellipse', () => {
  // 200×100 ellipse centered at (100, 50): a = 100, b = 50
  const oval: NodeBounds = { x: 0, y: 0, width: 200, height: 100 };
  const center: Point = { x: 100, y: 50 };

  it('hits the semi-major axis tip when aiming right', () => {
    const p = edgeIntersection(oval, center, { x: 500, y: 50 }, 'ellipse');
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(50);
    expect(p.face).toBe('Right');
  });

  it('hits the semi-minor axis tip when aiming up', () => {
    const p = edgeIntersection(oval, center, { x: 100, y: -500 }, 'ellipse');
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
    expect(p.face).toBe('Top');
  });

  it('returns a point that lies on the ellipse for a diagonal aim', () => {
    const p = edgeIntersection(oval, center, { x: 300, y: 200 }, 'ellipse');
    const nx = (p.x - 100) / 100;
    const ny = (p.y - 50) / 50;
    expect(nx * nx + ny * ny).toBeCloseTo(1);
  });
});

describe('directionToAngle', () => {
  it('matches faceToMarkerAngle for the four cardinal arrival directions', () => {
    // Travel direction (source → target) entering the named face.
    expect(directionToAngle(1, 0)).toBeCloseTo(faceToMarkerAngle('Left'));   // → enters Left
    expect(directionToAngle(0, 1)).toBeCloseTo(faceToMarkerAngle('Top'));    // ↓ enters Top
    expect(directionToAngle(-1, 0)).toBeCloseTo(faceToMarkerAngle('Right')); // ← enters Right
    expect(directionToAngle(0, -1)).toBeCloseTo(faceToMarkerAngle('Bottom'));// ↑ enters Bottom
  });

  it('returns 45° for a down-right diagonal', () => {
    expect(directionToAngle(1, 1)).toBeCloseTo(45);
  });

  it('returns 0 for a zero vector', () => {
    expect(directionToAngle(0, 0)).toBe(0);
  });
});
