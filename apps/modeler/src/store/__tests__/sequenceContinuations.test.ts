import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — continuations', () => {
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

  it('creates a continuation spanning lifelines', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const id = useModelStore.getState().createContinuation({
      name: 'loggedIn',
      coveredLifelineIds: [a, b],
      afterSequenceNumber: 0,
    });

    const cont = useModelStore.getState().model?.continuations?.[id];
    expect(cont).toBeDefined();
    expect(cont?.kind).toBe('CONTINUATION');
    expect(cont?.name).toBe('loggedIn');
    expect(cont?.coveredLifelineIds).toEqual([a, b]);
  });

  it('updates the name', () => {
    const a = createLifeline('A');
    const id = useModelStore.getState().createContinuation({
      name: '',
      coveredLifelineIds: [a],
      afterSequenceNumber: 0,
    });
    useModelStore.getState().updateContinuation(id, { name: 'done' });
    expect(useModelStore.getState().model?.continuations?.[id]?.name).toBe('done');
  });

  it('deletes a continuation', () => {
    const a = createLifeline('A');
    const id = useModelStore.getState().createContinuation({
      name: 'x',
      coveredLifelineIds: [a],
      afterSequenceNumber: 0,
    });
    useModelStore.getState().deleteContinuation(id);
    expect(useModelStore.getState().model?.continuations?.[id]).toBeUndefined();
  });

  it('strips a deleted lifeline; drops the continuation when none remain', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const spans2 = useModelStore.getState().createContinuation({
      name: 'multi',
      coveredLifelineIds: [a, b],
      afterSequenceNumber: 0,
    });
    const onlyA = useModelStore.getState().createContinuation({
      name: 'solo',
      coveredLifelineIds: [a],
      afterSequenceNumber: 0,
    });

    useModelStore.getState().deleteLifeline(a);

    const conts = useModelStore.getState().model?.continuations ?? {};
    expect(conts[spans2]?.coveredLifelineIds).toEqual([b]);
    expect(conts[onlyA]).toBeUndefined();
  });
});
