/**
 * reconcileOverrides — keeps drag position overrides from shadowing the store
 * after an external change (the bug that made undo/redo of node & package moves
 * have no visible effect: the store reverted but the local override pinned the
 * node at the dragged spot).
 */
import { describe, it, expect } from 'vitest';
import { reconcileOverrides } from '../useDragHandler';

const node = (id: string, x: number, y: number) => ({ id, position: { x, y } });

describe('reconcileOverrides', () => {
  it('drops an override once the store position diverges (undo/redo)', () => {
    const overrides = new Map([['n1', { x: 120, y: 80 }]]);
    // Undo reverted the store node back to its original spot.
    const next = reconcileOverrides(overrides, [node('n1', 0, 0)]);
    expect(next.has('n1')).toBe(false); // store wins → node renders at 0,0
  });

  it('keeps an override that still matches the store (no-op after drag persist)', () => {
    const overrides = new Map([['n1', { x: 120, y: 80 }]]);
    const next = reconcileOverrides(overrides, [node('n1', 120, 80)]);
    expect(next).toBe(overrides); // same reference → no re-render
  });

  it('prunes only the diverged entries, leaving the rest', () => {
    const overrides = new Map([
      ['n1', { x: 120, y: 80 }],
      ['n2', { x: 40, y: 40 }],
    ]);
    const next = reconcileOverrides(overrides, [
      node('n1', 0, 0),      // diverged → drop
      node('n2', 40, 40),    // matches → keep
    ]);
    expect(next.has('n1')).toBe(false);
    expect(next.get('n2')).toEqual({ x: 40, y: 40 });
  });

  it('returns the same empty map untouched', () => {
    const empty = new Map();
    expect(reconcileOverrides(empty, [node('n1', 0, 0)])).toBe(empty);
  });

  it('ignores nodes that have no override', () => {
    const overrides = new Map([['n1', { x: 10, y: 10 }]]);
    const next = reconcileOverrides(overrides, [node('n2', 99, 99)]);
    expect(next).toBe(overrides);
  });
});
