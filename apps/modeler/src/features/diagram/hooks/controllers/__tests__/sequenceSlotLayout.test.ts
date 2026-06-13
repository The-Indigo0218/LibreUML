/**
 * Variable slot layout (P4) — fragment headers widen the band before the
 * message that opens them, so nested/stacked headers don't compress. These tests
 * pin the cumulative `tops` math and the layout-aware forward/inverse round-trip.
 */
import { describe, it, expect } from 'vitest';
import {
  computeSlotLayoutFor,
  messageYForIndex,
  stateInvariantSlotY,
  yToMessageSlot,
  yToInvariantSlot,
  MESSAGE_BAND_H,
} from '../sequenceDiagramNodes';
import type { IRMessage, IRInteractionFragment } from '../../../../../core/domain/vfs/vfs.types';

const msg = (id: string, seq: number): IRMessage =>
  ({ id, kind: 'MESSAGE', name: id, messageKind: 'SYNC', sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: seq } as IRMessage);

const frag = (id: string, messageIds: string[]): IRInteractionFragment =>
  ({ id, kind: 'FRAGMENT', name: id, fragmentKind: 'ALT', coveredLifelineIds: ['a', 'b'], operands: [{ id: `${id}-op`, messageIds }] } as IRInteractionFragment);

const messages = [msg('m1', 1), msg('m2', 2), msg('m3', 3)];

describe('computeSlotLayoutFor', () => {
  it('is the uniform grid when there are no fragments', () => {
    const layout = computeSlotLayoutFor(messages, []);
    expect(layout.count).toBe(3);
    expect(layout.tops).toEqual([0, MESSAGE_BAND_H, MESSAGE_BAND_H * 2, MESSAGE_BAND_H * 3]);
  });

  it('reserves header room before the first message of a fragment', () => {
    const layout = computeSlotLayoutFor(messages, [frag('f1', ['m2', 'm3'])]);
    // Band 1 unchanged; band 2 (opens f1) widened; the extra carries downward.
    expect(layout.tops[1]).toBe(MESSAGE_BAND_H);
    const headerRoom = layout.tops[2] - layout.tops[1] - MESSAGE_BAND_H;
    expect(headerRoom).toBeGreaterThan(0);
    expect(layout.tops[3]).toBe(layout.tops[2] + MESSAGE_BAND_H);
  });

  it('stacks header room for nested fragments starting at the same message', () => {
    const one = computeSlotLayoutFor(messages, [frag('f1', ['m2'])]);
    const two = computeSlotLayoutFor(messages, [frag('f1', ['m2']), frag('f2', ['m2'])]);
    const roomOne = one.tops[2] - one.tops[1] - MESSAGE_BAND_H;
    const roomTwo = two.tops[2] - two.tops[1] - MESSAGE_BAND_H;
    expect(roomTwo).toBe(roomOne * 2);
  });
});

describe('layout-aware forward/inverse round-trip', () => {
  const layout = computeSlotLayoutFor(messages, [frag('f1', ['m2', 'm3'])]);

  it('round-trips each message slot through messageYForIndex → yToMessageSlot', () => {
    for (let k = 1; k <= layout.count; k++) {
      expect(yToMessageSlot(messageYForIndex(k, layout), layout.count, layout)).toBe(k);
    }
  });

  it('round-trips each boundary through stateInvariantSlotY → yToInvariantSlot', () => {
    for (let s = 0; s <= layout.count; s++) {
      expect(yToInvariantSlot(stateInvariantSlotY(s, layout), layout.count, layout)).toBe(s);
    }
  });

  it('pushes the fragment-opening message lower than the uniform grid would', () => {
    expect(messageYForIndex(2, layout)).toBeGreaterThan(messageYForIndex(2));
  });

  it('extrapolates an append slot below the last message', () => {
    const appendY = messageYForIndex(layout.count + 1, layout);
    expect(yToMessageSlot(appendY, layout.count + 1, layout)).toBe(layout.count + 1);
  });
});
