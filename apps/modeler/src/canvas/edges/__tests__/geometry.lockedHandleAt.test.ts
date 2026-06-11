import { describe, it, expect } from 'vitest';
import { lockedHandleAt, type NodeBounds } from '../geometry';

// 100×100 box at origin → center (50, 50).
const box: NodeBounds = { x: 0, y: 0, width: 100, height: 100 };

describe('lockedHandleAt — (x,y) → nearest of 8 handles', () => {
  it('maps cardinal midpoints', () => {
    expect(lockedHandleAt(box, 50, 0)).toBe('T');
    expect(lockedHandleAt(box, 50, 100)).toBe('B');
    expect(lockedHandleAt(box, 0, 50)).toBe('L');
    expect(lockedHandleAt(box, 100, 50)).toBe('R');
  });

  it('maps the four corners', () => {
    expect(lockedHandleAt(box, 0, 0)).toBe('TL');
    expect(lockedHandleAt(box, 100, 0)).toBe('TR');
    expect(lockedHandleAt(box, 0, 100)).toBe('BL');
    expect(lockedHandleAt(box, 100, 100)).toBe('BR');
  });
});
