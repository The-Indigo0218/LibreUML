import { describe, it, expect } from 'vitest';
import { computeDropAnchoring } from '../useConnectionDraw';
import type { NodeBounds } from '../../edges/geometry';

// 100×100 boxes side by side.
const A: NodeBounds = { x: 0, y: 0, width: 100, height: 100 };
const B: NodeBounds = { x: 200, y: 0, width: 100, height: 100 };

describe('computeDropAnchoring (P4 — free border anchors)', () => {
  it('anchors both ends to their continuous border ratio', () => {
    const r = computeDropAnchoring(
      { bounds: A, x: 100, y: 50 },  // A right-mid → (1, 0.5)
      { bounds: B, x: 200, y: 35 },  // B left border, 35% down → (0, 0.35)
    );
    expect(r.sourceAnchor).toEqual({ nx: 1, ny: 0.5 });
    expect(r.targetAnchor).toEqual({ nx: 0, ny: 0.35 });
  });

  it('magnet snaps near-cardinal drops to exact ratios', () => {
    const r = computeDropAnchoring(
      { bounds: A, x: 96, y: 53 },   // ~right-mid → magnets to (1, 0.5)
      { bounds: B, x: 200, y: 100 }, // B bottom-left corner → (0, 1)
    );
    expect(r.sourceAnchor).toEqual({ nx: 1, ny: 0.5 });
    expect(r.targetAnchor).toEqual({ nx: 0, ny: 1 });
  });
});
