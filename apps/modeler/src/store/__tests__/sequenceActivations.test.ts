import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — auto-activation in createMessage', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  function createTwoLifelines(): { ll1: string; ll2: string } {
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

  it('creates exactly one activation on the target lifeline when a SYNC is created', () => {
    const { ll1, ll2 } = createTwoLifelines();
    useModelStore.getState().createMessage({
      name: 'op',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
    });

    const acts = Object.values(useModelStore.getState().model?.activations ?? {});
    expect(acts).toHaveLength(1);
    expect(acts[0].lifelineId).toBe(ll2);
    expect(acts[0].endMessageId).toBeUndefined();
  });

  it('does NOT create an activation for ASYNC messages', () => {
    const { ll1, ll2 } = createTwoLifelines();
    useModelStore.getState().createMessage({
      name: 'evt',
      messageKind: 'ASYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
    });
    const acts = Object.values(useModelStore.getState().model?.activations ?? {});
    expect(acts).toHaveLength(0);
  });

  it('closes the matching activation when a REPLY with inReplyTo is created', () => {
    const { ll1, ll2 } = createTwoLifelines();
    const syncId = useModelStore.getState().createMessage({
      name: 'op',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
    });
    useModelStore.getState().createMessage({
      name: 'ret',
      messageKind: 'REPLY',
      sourceLifelineId: ll2,
      targetLifelineId: ll1,
      sequenceNumber: 2,
      inReplyTo: syncId,
    });

    const acts = Object.values(useModelStore.getState().model?.activations ?? {});
    expect(acts).toHaveLength(1);
    expect(acts[0].endMessageId).toBeDefined();
  });

  it('cascades activation deletion when its start message is deleted', () => {
    const { ll1, ll2 } = createTwoLifelines();
    const syncId = useModelStore.getState().createMessage({
      name: 'op',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
    });
    expect(Object.keys(useModelStore.getState().model?.activations ?? {})).toHaveLength(1);

    useModelStore.getState().deleteMessage(syncId);
    expect(Object.keys(useModelStore.getState().model?.activations ?? {})).toHaveLength(0);
  });

  it('clears endMessageId when the REPLY message is deleted (activation re-opens)', () => {
    const { ll1, ll2 } = createTwoLifelines();
    const syncId = useModelStore.getState().createMessage({
      name: 'op',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
    });
    const replyId = useModelStore.getState().createMessage({
      name: 'ret',
      messageKind: 'REPLY',
      sourceLifelineId: ll2,
      targetLifelineId: ll1,
      sequenceNumber: 2,
      inReplyTo: syncId,
    });

    let acts = Object.values(useModelStore.getState().model?.activations ?? {});
    expect(acts[0].endMessageId).toBe(replyId);

    useModelStore.getState().deleteMessage(replyId);
    acts = Object.values(useModelStore.getState().model?.activations ?? {});
    expect(acts).toHaveLength(1);
    expect(acts[0].endMessageId).toBeUndefined();
  });

  it('cascades activations when the lifeline itself is deleted', () => {
    const { ll1, ll2 } = createTwoLifelines();
    useModelStore.getState().createMessage({
      name: 'op',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
    });
    expect(Object.keys(useModelStore.getState().model?.activations ?? {})).toHaveLength(1);

    useModelStore.getState().deleteLifeline(ll2);
    expect(Object.keys(useModelStore.getState().model?.activations ?? {})).toHaveLength(0);
    expect(Object.keys(useModelStore.getState().model?.messages ?? {})).toHaveLength(0);
  });
});
