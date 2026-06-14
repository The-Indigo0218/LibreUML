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
  autoAssignFragmentForNewMessage,
} from '../sequenceMessageHelpers';
import type { IRMessage } from '../../../core/domain/vfs/vfs.types';

/** Replicates useCanvasEventHandlers.onConnect's SEQUENCE_DIAGRAM branch for the global model. */
function simulateConnect(
  srcLifelineId: string,
  tgtLifelineId: string,
  tool: 'MESSAGE_SYNC' | 'MESSAGE_ASYNC' | 'MESSAGE_REPLY',
): string {
  const model = useModelStore.getState().model!;
  // Manual self-connections are rejected by onConnect — self-messages must be
  // created from the lifeline's "Create Self Message" action instead.
  if (srcLifelineId === tgtLifelineId) return '';
  const messageKind = TOOL_TO_MESSAGE_KIND[tool];
  const sequenceNumber = nextMessageSequenceNumber(model.messages ?? {});
  const inReplyTo =
    messageKind === 'REPLY'
      ? findMatchingSyncForReply(model.messages ?? {}, srcLifelineId, tgtLifelineId)
      : undefined;

  const autoAssignment = autoAssignFragmentForNewMessage(
    model.interactionFragments ?? {},
    model.messages ?? {},
    srcLifelineId,
    tgtLifelineId,
    sequenceNumber,
  );

  const payload: Omit<IRMessage, 'id' | 'kind'> = {
    name: '',
    messageKind,
    sourceLifelineId: srcLifelineId,
    targetLifelineId: tgtLifelineId,
    sequenceNumber,
    ...(inReplyTo ? { inReplyTo } : {}),
    ...(autoAssignment ? { fragmentId: autoAssignment.fragmentId } : {}),
  };
  const newMessageId = useModelStore.getState().createMessage(payload);

  if (autoAssignment) {
    const refreshed = useModelStore.getState().model!;
    const frag = refreshed.interactionFragments![autoAssignment.fragmentId];
    const updatedOperands = frag.operands.map((op) =>
      op.id === autoAssignment.operandId
        ? { ...op, messageIds: [...op.messageIds, newMessageId] }
        : op,
    );
    useModelStore.getState().updateFragment(autoAssignment.fragmentId, { operands: updatedOperands });
  }

  return newMessageId;
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

  it('blocks a manual self-connection; the sanctioned self-message seeds a nested activation', () => {
    const { ll1 } = setup();
    // Drawing a connection back onto the same lifeline is rejected.
    expect(simulateConnect(ll1, ll1, 'MESSAGE_SYNC')).toBe('');
    expect(Object.keys(useModelStore.getState().model!.messages!)).toHaveLength(0);

    // The "Create Self Message" action creates a SYNC self-message, which the
    // store auto-pairs with a nested activation on the same lifeline.
    const msgId = useModelStore.getState().createMessage({
      name: '',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll1,
      sequenceNumber: 1,
    });
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

  // ─── Auto-assignment of fragmentId ──────────────────────────────────────────

  it('auto-assigns a new message to a fragment when the previous message is inside it', () => {
    const { ll1, ll2 } = setup();
    const firstMsgId = simulateConnect(ll1, ll2, 'MESSAGE_SYNC');
    // Manually wrap the first message in an ALT fragment.
    const fragId = useModelStore.getState().createFragment({
      name: 'alt-1',
      fragmentKind: 'ALT',
      coveredLifelineIds: [ll1, ll2],
      operands: [
        { id: 'op1', messageIds: [firstMsgId], fragmentIds: [] },
        { id: 'op2', messageIds: [], fragmentIds: [] },
      ],
    });
    // Now create a new message — it should auto-assign to fragId.
    const secondMsgId = simulateConnect(ll1, ll2, 'MESSAGE_ASYNC');

    const state = useModelStore.getState().model!;
    expect(state.messages![secondMsgId].fragmentId).toBe(fragId);
    const frag = state.interactionFragments![fragId];
    expect(frag.operands[0].messageIds).toContain(secondMsgId);
  });

  it('does NOT auto-assign when the previous message lives outside any matching fragment', () => {
    const { ll1, ll2 } = setup();
    simulateConnect(ll1, ll2, 'MESSAGE_SYNC');
    // Create an empty fragment (no messages inside).
    useModelStore.getState().createFragment({
      name: 'opt-empty',
      fragmentKind: 'OPT',
      coveredLifelineIds: [ll1, ll2],
      operands: [{ id: 'op1', messageIds: [], fragmentIds: [] }],
    });
    const newMsgId = simulateConnect(ll1, ll2, 'MESSAGE_ASYNC');

    const state = useModelStore.getState().model!;
    expect(state.messages![newMsgId].fragmentId).toBeUndefined();
  });

  it('does NOT auto-assign when the new message endpoints are not all covered', () => {
    const { ll1, ll2 } = setup();
    const ll3 = useModelStore.getState().createLifeline({
      name: 'C', participantKind: 'ANONYMOUS', alias: 'C',
    });
    const firstMsgId = simulateConnect(ll1, ll2, 'MESSAGE_SYNC');
    useModelStore.getState().createFragment({
      name: 'alt-narrow',
      fragmentKind: 'ALT',
      coveredLifelineIds: [ll1, ll2], // does NOT cover ll3
      operands: [{ id: 'op1', messageIds: [firstMsgId], fragmentIds: [] }],
    });

    // New message ll1 → ll3 — endpoints not both covered, so no auto-assign.
    const newMsgId = simulateConnect(ll1, ll3, 'MESSAGE_ASYNC');
    const state = useModelStore.getState().model!;
    expect(state.messages![newMsgId].fragmentId).toBeUndefined();
  });
});
