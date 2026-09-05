import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — general orderings', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  function createLifeline(name: string): string {
    return useModelStore.getState().createLifeline({
      name,
      participantKind: 'ANONYMOUS',
      alias: name,
    });
  }

  function createMessage(src: string, tgt: string, seq: number): string {
    return useModelStore.getState().createMessage({
      name: `m${seq}`,
      messageKind: 'SYNC',
      sourceLifelineId: src,
      targetLifelineId: tgt,
      sequenceNumber: seq,
    });
  }

  it('creates a general ordering between two messages', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);
    const m2 = createMessage(b, a, 2);

    const id = useModelStore.getState().createGeneralOrdering({
      name: '',
      beforeMessageId: m1,
      beforeEnd: 'RECEIVE',
      afterMessageId: m2,
      afterEnd: 'SEND',
    });

    const go = useModelStore.getState().model?.generalOrderings?.[id];
    expect(go).toBeDefined();
    expect(go?.kind).toBe('GENERAL_ORDERING');
    expect(go?.beforeMessageId).toBe(m1);
    expect(go?.afterMessageId).toBe(m2);
  });

  it('updates the ordering endpoints', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);
    const m2 = createMessage(b, a, 2);
    const id = useModelStore.getState().createGeneralOrdering({
      name: '',
      beforeMessageId: m1,
      beforeEnd: 'RECEIVE',
      afterMessageId: m2,
      afterEnd: 'SEND',
    });

    useModelStore.getState().updateGeneralOrdering(id, { beforeEnd: 'SEND' });
    expect(useModelStore.getState().model?.generalOrderings?.[id]?.beforeEnd).toBe('SEND');
  });

  it('deletes a general ordering', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);
    const m2 = createMessage(b, a, 2);
    const id = useModelStore.getState().createGeneralOrdering({
      name: '',
      beforeMessageId: m1,
      beforeEnd: 'RECEIVE',
      afterMessageId: m2,
      afterEnd: 'SEND',
    });

    useModelStore.getState().deleteGeneralOrdering(id);
    expect(useModelStore.getState().model?.generalOrderings?.[id]).toBeUndefined();
  });

  it('clears orderings that reference a deleted message', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);
    const m2 = createMessage(b, a, 2);
    const m3 = createMessage(a, b, 3);
    const touchesM1 = useModelStore.getState().createGeneralOrdering({
      name: '',
      beforeMessageId: m1,
      beforeEnd: 'RECEIVE',
      afterMessageId: m2,
      afterEnd: 'SEND',
    });
    const untouched = useModelStore.getState().createGeneralOrdering({
      name: '',
      beforeMessageId: m2,
      beforeEnd: 'RECEIVE',
      afterMessageId: m3,
      afterEnd: 'SEND',
    });

    useModelStore.getState().deleteMessage(m1);

    const orderings = useModelStore.getState().model?.generalOrderings ?? {};
    expect(orderings[touchesM1]).toBeUndefined();
    expect(orderings[untouched]).toBeDefined();
  });
});
