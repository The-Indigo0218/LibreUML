import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';
import type { IRMessage } from '../../core/domain/vfs/vfs.types';

/**
 * P1 — "insert where you point". insertMessageAt places a message at the slot
 * carried in `data.sequenceNumber`, shifting later messages down by one so the
 * sequence stays contiguous. Backs the drop-Y sequence-diagram UX.
 */
describe('Sequence Diagram — insertMessageAt (P1)', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  function createTwoLifelines(): { ll1: string; ll2: string } {
    const ll1 = useModelStore.getState().createLifeline({
      name: 'A', participantKind: 'ANONYMOUS', alias: 'A',
    });
    const ll2 = useModelStore.getState().createLifeline({
      name: 'B', participantKind: 'ANONYMOUS', alias: 'B',
    });
    return { ll1, ll2 };
  }

  function msg(
    ll1: string,
    ll2: string,
    sequenceNumber: number,
    name: string,
  ): Omit<IRMessage, 'id' | 'kind'> {
    return { name, messageKind: 'ASYNC', sourceLifelineId: ll1, targetLifelineId: ll2, sequenceNumber };
  }

  function seqByName(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of Object.values(useModelStore.getState().model!.messages!)) {
      out[m.name] = m.sequenceNumber;
    }
    return out;
  }

  it('appends when the slot is beyond the last message (degenerate case)', () => {
    const { ll1, ll2 } = createTwoLifelines();
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 1, 'a'));
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 2, 'b'));

    expect(seqByName()).toEqual({ a: 1, b: 2 });
  });

  it('inserts in the middle and shifts later messages down by one', () => {
    const { ll1, ll2 } = createTwoLifelines();
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 1, 'a')); // [a:1]
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 2, 'b')); // [a:1, b:2]
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 3, 'c')); // [a:1, b:2, c:3]

    // Insert "x" at slot 2 → b and c shift down.
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 2, 'x'));

    expect(seqByName()).toEqual({ a: 1, x: 2, b: 3, c: 4 });
  });

  it('inserting at slot 1 pushes everything down and keeps numbers contiguous', () => {
    const { ll1, ll2 } = createTwoLifelines();
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 1, 'a'));
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 2, 'b'));

    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 1, 'top'));

    expect(seqByName()).toEqual({ top: 1, a: 2, b: 3 });
    const seqs = Object.values(useModelStore.getState().model!.messages!)
      .map((m) => m.sequenceNumber)
      .sort((p, q) => p - q);
    expect(seqs).toEqual([1, 2, 3]);
  });

  it('still auto-creates the activation for an inserted SYNC message', () => {
    const { ll1, ll2 } = createTwoLifelines();
    useModelStore.getState().insertMessageAt(msg(ll1, ll2, 1, 'a'));
    useModelStore.getState().insertMessageAt({
      name: 'call', messageKind: 'SYNC',
      sourceLifelineId: ll1, targetLifelineId: ll2, sequenceNumber: 1,
    });

    const acts = Object.values(useModelStore.getState().model!.activations ?? {});
    expect(acts).toHaveLength(1);
    expect(acts[0].lifelineId).toBe(ll2);
    expect(seqByName()).toEqual({ call: 1, a: 2 });
  });
});
