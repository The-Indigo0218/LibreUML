import { describe, it, expect } from 'vitest';
import { ratioFromPoint, anchorFromRatio, type NodeBounds } from '../geometry';

const box: NodeBounds = { x: 0, y: 0, width: 100, height: 100 };

describe('ratioFromPoint — capture (P4)', () => {
  it('maps a border point to its relative ratio', () => {
    expect(ratioFromPoint(box, 100, 30)).toEqual({ nx: 1, ny: 0.3 });
    expect(ratioFromPoint(box, 0, 75)).toEqual({ nx: 0, ny: 0.75 });
  });

  it('clamps points outside the box into [0,1]', () => {
    expect(ratioFromPoint(box, 140, -20)).toEqual({ nx: 1, ny: 0 });
  });

  it('magnet snaps near-cardinal coords but leaves the free axis continuous', () => {
    // x within 10px of the right edge → snaps to 1; y at 30% stays free.
    expect(ratioFromPoint(box, 94, 30, 10)).toEqual({ nx: 1, ny: 0.3 });
    // both near the centre marks → snaps to (0.5, 0)
    expect(ratioFromPoint(box, 53, 4, 10)).toEqual({ nx: 0.5, ny: 0 });
  });
});

describe('anchorFromRatio — resolve (P4)', () => {
  it('projects a right-border ratio to the Right face', () => {
    expect(anchorFromRatio(box, { nx: 1, ny: 0.3 })).toEqual({ x: 100, y: 30, face: 'Right' });
  });

  it('projects cardinal ratios to their faces', () => {
    expect(anchorFromRatio(box, { nx: 0.5, ny: 0 })).toEqual({ x: 50, y: 0, face: 'Top' });
    expect(anchorFromRatio(box, { nx: 0, ny: 0.5 })).toEqual({ x: 0, y: 50, face: 'Left' });
    expect(anchorFromRatio(box, { nx: 0.2, ny: 1 })).toEqual({ x: 20, y: 100, face: 'Bottom' });
  });

  it('snaps a slightly-inward ratio back onto the nearest border', () => {
    // ny=0.95 → closest side is Bottom; x stays at the free position.
    expect(anchorFromRatio(box, { nx: 0.4, ny: 0.95 })).toEqual({ x: 40, y: 100, face: 'Bottom' });
  });
});
