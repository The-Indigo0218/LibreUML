/**
 * Integration test: simulates the SEQUENCE_DIAGRAM branch of useCanvasEventHandlers.onConnect.
 *
 * We don't render the hook (that requires React + Konva). Instead we replicate
 * the exact sequence the hook executes after a Konva connection lands on two
 * lifelines, and verify the model store ends in the expected state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../../../store/model.store';
import {
  TOOL_TO_MESSAGE_KIND,
  findMatchingSyncForReply,
  nextMessageSequenceNumber,
} from '../sequenceMessageHelpers';
import type { IRMessage } from '../../../core/domain/vfs/vfs.types';

/** Replicates useCanvasEventHandlers.onConnect's SEQUENCE_DIAGRAM branch for the global model. */
function simulateConnect(
  srcLifelineId: string,
  tgtLifelineId: string,
  tool: 'MESSAGE_SYNC' | 'MESSAGE_ASYNC' | 'MESSAGE_REPLY',
): string {
  const model = useModelStore.getState().model!;
  const messageKind = TOOL_TO_MESSAGE_KIND[tool];
  const sequenceNumber = nextMessageSequenceNumber(model.messages ?? {});
  const inReplyTo =
    messageKind === 'REPLY'
      ? findMatchingSyncForReply(model.messages ?? {}, srcLifelineId, tgtLifelineId)
      : undefined;

  const payload: Omit<IRMessage, 'id' | 'kind'> = {
    name: '',
    messageKind,
    sourceLifelineId: srcLifelineId,
    targetLifelineId: tgtLifelineId,
    sequenceNumber,
    ...(inReplyTo ? { inReplyTo } : {}),
  };
  return useModelStore.getState().createMessage(payload);
}

function setup(): { ll1: string; ll2: string } {
  useModelStore.getState().resetModel();
  useModelStore.getState().initModel('test-model');
  const ll1 = useModelStore.getState().createLifeline({
    name: 'A',
    participantKind: 'ANONYMOUS',
    alias: 'A',
  });
  const ll2 = useModelStore.getState().createLifeline({
    name: 'B',
    participantKind: 'ANONYMOUS',
    alias: 'B',
  });
  return { ll1, ll2 };
}

describe('onConnect simulation — SEQUENCE_DIAGRAM creates IRMessage', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
  });

  it('creates a SYNC message with sequenceNumber=1 + auto-activation on target', () => {
    const { ll1, ll2 } = setup();
    const msgId = simulateConnect(ll1, ll2, 'MESSAGE_SYNC');

    const state = useModelStore.getState().model!;
    const msg = state.messages![msgId];
    expect(msg.messageKind).toBe('SYNC');
    expect(msg.sequenceNumber).toBe(1);
    expect(msg.sourceLifelineId).toBe(ll1);
    expect(msg.targetLifelineId).toBe(ll2);

    const activations = Object.values(state.activations!);
    expect(activations).toHaveLength(1);
    expect(activations[0].lifelineId).toBe(ll2);
    expect(activations[0].endMessageId).toBeUndefined();
  });

  it('creates an ASYNC message and does NOT create an activation', () => {
    const { ll1, ll2 } = setup();
    const msgId = simulateConnect(ll1, ll2, 'MESSAGE_ASYNC');

    const state = useModelStore.getState().model!;
    expect(state.messages![msgId].messageKind).toBe('ASYNC');
    expect(Object.keys(state.activations!)).toHaveLength(0);
  });

  it('auto-pairs REPLY with the most recent SYNC and closes the activation', () => {
    const { ll1, ll2 } = setup();
    const syncId = simulateConnect(ll1, ll2, 'MESSAGE_SYNC');
    const replyId = simulateConnect(ll2, ll1, 'MESSAGE_REPLY');

    const state = useModelStore.getState().model!;
    expect(state.messages![replyId].messageKind).toBe('REPLY');
    expect(state.messages![replyId].inReplyTo).toBe(syncId);

    const activations = Object.values(state.activations!);
    expect(activations).toHaveLength(1);
    expect(activations[0].endMessageId).toBe(replyId);
  });

  it('increments sequenceNumber across multiple consecutive connects', () => {
    const { ll1, ll2 } = setup();
    simulateConnect(ll1, ll2, 'MESSAGE_SYNC'); // seq=1, activation on ll2
    simulateConnect(ll1, ll2, 'MESSAGE_ASYNC'); // seq=2
    simulateConnect(ll2, ll1, 'MESSAGE_REPLY'); // seq=3, pairs with seq=1

    const state = useModelStore.getState().model!;
    const seqs = Object.values(state.messages!).map((m) => m.sequenceNumber).sort();
    expect(seqs).toEqual([1, 2, 3]);
  });

  it('allows self-message (src===tgt) and renders auto-activation on the same lifeline', () => {
    const { ll1 } = setup();
    const msgId = simulateConnect(ll1, ll1, 'MESSAGE_SYNC');

    const state = useModelStore.getState().model!;
    expect(state.messages![msgId].sourceLifelineId).toBe(ll1);
    expect(state.messages![msgId].targetLifelineId).toBe(ll1);

    const activations = Object.values(state.activations!);
    expect(activations).toHaveLength(1);
    expect(activations[0].lifelineId).toBe(ll1);
  });

  it('REPLY without a matching SYNC creates the message without inReplyTo', () => {
    const { ll1, ll2 } = setup();
    const replyId = simulateConnect(ll2, ll1, 'MESSAGE_REPLY');

    const state = useModelStore.getState().model!;
    expect(state.messages![replyId].messageKind).toBe('REPLY');
    expect(state.messages![replyId].inReplyTo).toBeUndefined();
    // No activation existed to close.
    expect(Object.keys(state.activations!)).toHaveLength(0);
  });

  it('REPLY only matches reversed-direction SYNCs (not same-direction)', () => {
    const { ll1, ll2 } = setup();
    simulateConnect(ll1, ll2, 'MESSAGE_SYNC'); // SYNC A → B
    const replyId = simulateConnect(ll1, ll2, 'MESSAGE_REPLY'); // REPLY A → B (wrong direction)

    const state = useModelStore.getState().model!;
    // The REPLY should NOT pair (only B → A would match the SYNC).
    expect(state.messages![replyId].inReplyTo).toBeUndefined();
    // The original SYNC activation stays open.
    const acts = Object.values(state.activations!);
    expect(acts).toHaveLength(1);
    expect(acts[0].endMessageId).toBeUndefined();
  });
});
