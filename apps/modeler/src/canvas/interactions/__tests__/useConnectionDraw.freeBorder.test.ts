import { describe, it, expect } from 'vitest';
import { freeBorderNearest, freeBorderLanding } from '../useConnectionDraw';
import type { NodeBounds } from '../../edges/geometry';

// A lifeline: 140-wide head, tall timeline. Center X = 70.
const LIFELINE: NodeBounds = { x: 0, y: 0, width: 140, height: 600 };

describe('freeBorderNearest (C7 — lifeline centerline anchoring)', () => {
  it('snaps to the centerline at the cursor Y when within radius', () => {
    const hit = freeBorderNearest({ x: 76, y: 320 }, 'll1', LIFELINE, 16);
    expect(hit).toEqual({ nodeId: 'll1', x: 70, y: 320, dist: 6 });
  });

  it('locks X to the center regardless of cursor X side', () => {
    const left = freeBorderNearest({ x: 60, y: 100 }, 'll1', LIFELINE, 16);
    expect(left?.x).toBe(70);
    expect(left?.y).toBe(100);
  });

  it('clamps Y to the span and still snaps when just past an end (within radius)', () => {
    const below = freeBorderNearest({ x: 70, y: 610 }, 'll1', LIFELINE, 16);
    expect(below?.y).toBe(600);
    const above = freeBorderNearest({ x: 70, y: -8 }, 'll1', LIFELINE, 16);
    expect(above?.y).toBe(0);
  });

  it('returns null when the cursor is farther than radius from the centerline', () => {
    expect(freeBorderNearest({ x: 100, y: 300 }, 'll1', LIFELINE, 16)).toBeNull();
  });

  it('returns null when the cursor is well beyond a timeline end', () => {
    expect(freeBorderNearest({ x: 70, y: 5000 }, 'll1', LIFELINE, 16)).toBeNull();
  });
});

describe('freeBorderLanding (C7 — drop target on the timeline)', () => {
  it('lands on the centerline at the cursor Y', () => {
    expect(freeBorderLanding(LIFELINE, { x: 12, y: 250 })).toEqual({ x: 70, y: 250 });
  });

  it('clamps to the timeline span', () => {
    expect(freeBorderLanding(LIFELINE, { x: 70, y: 9999 })).toEqual({ x: 70, y: 600 });
  });
});
