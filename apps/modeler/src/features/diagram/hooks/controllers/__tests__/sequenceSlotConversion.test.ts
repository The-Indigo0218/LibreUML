/**
 * Sequence-diagram slot conversion — the math behind the "derived shape vertical
 * drag → slot" handlers (handleDerivedDragEnd / message drag).
 *
 * The drag handlers themselves live inline in KonvaCanvas and react-konva shapes,
 * which the test mock cannot drive. Their load-bearing logic is the pure
 * coordinate↔slot conversion: yToInvariantSlot / yToMessageSlot, the inverses of
 * stateInvariantSlotY / messageYForIndex. We test those round-trips and the
 * clamping that the handlers rely on (a drag past the timeline ends pins to the
 * first/last legal slot). stateInvariantSlotY's forward mapping is already
 * covered elsewhere; the inverse functions are net-new here.
 */
import { describe, it, expect } from 'vitest';
import {
  yToInvariantSlot,
  yToMessageSlot,
  stateInvariantSlotY,
} from '../sequenceDiagramNodes';

describe('yToInvariantSlot (StateInvariant / Gate vertical drag → 0-based slot)', () => {
  const TOTAL = 5;

  it('round-trips each forward slot Y back to the same slot', () => {
    for (let slot = 0; slot <= TOTAL; slot++) {
      const y = stateInvariantSlotY(slot);
      expect(yToInvariantSlot(y, TOTAL)).toBe(slot);
    }
  });

  it('snaps a Y near a slot boundary to the nearest slot', () => {
    const ySlot2 = stateInvariantSlotY(2);
    const ySlot3 = stateInvariantSlotY(3);
    const justBelow2 = ySlot2 + (ySlot3 - ySlot2) * 0.1;
    const nearer3 = ySlot2 + (ySlot3 - ySlot2) * 0.9;
    expect(yToInvariantSlot(justBelow2, TOTAL)).toBe(2);
    expect(yToInvariantSlot(nearer3, TOTAL)).toBe(3);
  });

  it('clamps a drag above the timeline to slot 0', () => {
    expect(yToInvariantSlot(-9999, TOTAL)).toBe(0);
  });

  it('clamps a drag below the last slot to totalMessages', () => {
    expect(yToInvariantSlot(99999, TOTAL)).toBe(TOTAL);
  });

  it('produces a slot in the legal [0, total] range for arbitrary Y', () => {
    for (const y of [-50, 0, 37, 123, 480, 5000]) {
      const slot = yToInvariantSlot(y, TOTAL);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThanOrEqual(TOTAL);
    }
  });
});

describe('yToMessageSlot (Message vertical drag → 1-based slot)', () => {
  const TOTAL = 4;

  it('is clamped within [1, totalMessages]', () => {
    expect(yToMessageSlot(-9999, TOTAL)).toBe(1);
    expect(yToMessageSlot(99999, TOTAL)).toBe(TOTAL);
  });

  it('never returns slot 0 (messages are 1-based)', () => {
    for (const y of [-100, 0, 10, 50, 200, 1000]) {
      expect(yToMessageSlot(y, TOTAL)).toBeGreaterThanOrEqual(1);
    }
  });

  it('moves to a higher slot as the drag Y increases monotonically', () => {
    const samples = [0, 100, 200, 300, 400, 500].map((y) => yToMessageSlot(y, TOTAL));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });
});
