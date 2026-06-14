import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — time / duration constraints', () => {
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

  it('creates a TIME constraint at one occurrence', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);

    const id = useModelStore.getState().createTimeConstraint({
      name: '',
      constraintKind: 'TIME',
      fromMessageId: m1,
      fromEnd: 'RECEIVE',
      expression: 't=now',
    });

    const tc = useModelStore.getState().model?.timeConstraints?.[id];
    expect(tc).toBeDefined();
    expect(tc?.kind).toBe('TIME_CONSTRAINT');
    expect(tc?.constraintKind).toBe('TIME');
    expect(tc?.fromMessageId).toBe(m1);
  });

  it('creates a DURATION constraint spanning two occurrences', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);
    const m2 = createMessage(a, b, 2);

    const id = useModelStore.getState().createTimeConstraint({
      name: '',
      constraintKind: 'DURATION',
      fromMessageId: m1,
      fromEnd: 'RECEIVE',
      toMessageId: m2,
      toEnd: 'RECEIVE',
      expression: '0..3s',
    });

    const tc = useModelStore.getState().model?.timeConstraints?.[id];
    expect(tc?.constraintKind).toBe('DURATION');
    expect(tc?.toMessageId).toBe(m2);
  });

  it('updates the expression', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);
    const id = useModelStore.getState().createTimeConstraint({
      name: '',
      constraintKind: 'TIME',
      fromMessageId: m1,
      fromEnd: 'RECEIVE',
      expression: 't=now',
    });
    useModelStore.getState().updateTimeConstraint(id, { expression: 't<5s' });
    expect(useModelStore.getState().model?.timeConstraints?.[id]?.expression).toBe('t<5s');
  });

  it('deletes a constraint', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);
    const id = useModelStore.getState().createTimeConstraint({
      name: '',
      constraintKind: 'TIME',
      fromMessageId: m1,
      fromEnd: 'RECEIVE',
      expression: 't=now',
    });
    useModelStore.getState().deleteTimeConstraint(id);
    expect(useModelStore.getState().model?.timeConstraints?.[id]).toBeUndefined();
  });

  it('clears constraints anchored to a deleted message (either end)', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const m1 = createMessage(a, b, 1);
    const m2 = createMessage(a, b, 2);
    const m3 = createMessage(a, b, 3);

    const onM1 = useModelStore.getState().createTimeConstraint({
      name: '',
      constraintKind: 'TIME',
      fromMessageId: m1,
      fromEnd: 'RECEIVE',
      expression: 't=now',
    });
    const durEndsAtM1 = useModelStore.getState().createTimeConstraint({
      name: '',
      constraintKind: 'DURATION',
      fromMessageId: m2,
      fromEnd: 'RECEIVE',
      toMessageId: m1,
      toEnd: 'SEND',
      expression: '0..1s',
    });
    const untouched = useModelStore.getState().createTimeConstraint({
      name: '',
      constraintKind: 'DURATION',
      fromMessageId: m2,
      fromEnd: 'RECEIVE',
      toMessageId: m3,
      toEnd: 'RECEIVE',
      expression: '0..2s',
    });

    useModelStore.getState().deleteMessage(m1);

    const tcs = useModelStore.getState().model?.timeConstraints ?? {};
    expect(tcs[onM1]).toBeUndefined();
    expect(tcs[durEndsAtM1]).toBeUndefined();
    expect(tcs[untouched]).toBeDefined();
  });
});
