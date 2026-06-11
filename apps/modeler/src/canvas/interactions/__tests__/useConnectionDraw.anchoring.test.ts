import { describe, it, expect } from 'vitest';
import { computeDropAnchoring } from '../useConnectionDraw';
import type { NodeBounds } from '../../edges/geometry';

// 100×100 boxes side by side.
const A: NodeBounds = { x: 0, y: 0, width: 100, height: 100 };
const B: NodeBounds = { x: 200, y: 0, width: 100, height: 100 };

describe('computeDropAnchoring', () => {
  it('returns empty anchoring (floating) when not fixed', () => {
    const r = computeDropAnchoring(
      false,
      { bounds: A, x: 100, y: 50 }, // A right-mid
      { bounds: B, x: 200, y: 50 }, // B left-mid
    );
    expect(r).toEqual({});
    expect(r.anchorLocked).toBeUndefined();
  });

  it('locks BOTH endpoints to their nearest handle when fixed', () => {
    const r = computeDropAnchoring(
      true,
      { bounds: A, x: 100, y: 50 }, // A right-mid → R
      { bounds: B, x: 200, y: 50 }, // B left-mid → L
    );
    expect(r).toEqual({ sourceHandle: 'R', targetHandle: 'L', anchorLocked: true });
  });

  it('maps corner drops to corner handles', () => {
    const r = computeDropAnchoring(
      true,
      { bounds: A, x: 100, y: 100 }, // A bottom-right → BR
      { bounds: B, x: 200, y: 0 },   // B top-left → TL
    );
    expect(r.sourceHandle).toBe('BR');
    expect(r.targetHandle).toBe('TL');
    expect(r.anchorLocked).toBe(true);
  });
});
