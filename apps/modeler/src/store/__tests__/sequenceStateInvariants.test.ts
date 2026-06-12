import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — state invariants', () => {
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

  it('creates a state invariant attached to a lifeline', () => {
    const ll = createLifeline('A');
    const id = useModelStore.getState().createStateInvariant({
      name: 'balance > 0',
      lifelineId: ll,
      constraint: 'balance > 0',
      afterSequenceNumber: 0,
    });

    const si = useModelStore.getState().model?.stateInvariants?.[id];
    expect(si).toBeDefined();
    expect(si?.kind).toBe('STATE_INVARIANT');
    expect(si?.lifelineId).toBe(ll);
    expect(si?.constraint).toBe('balance > 0');
  });

  it('updates the constraint text', () => {
    const ll = createLifeline('A');
    const id = useModelStore.getState().createStateInvariant({
      name: '',
      lifelineId: ll,
      constraint: 'x > 0',
      afterSequenceNumber: 1,
    });
    useModelStore.getState().updateStateInvariant(id, { constraint: 'x >= 10' });
    expect(useModelStore.getState().model?.stateInvariants?.[id]?.constraint).toBe('x >= 10');
  });

  it('deletes a state invariant', () => {
    const ll = createLifeline('A');
    const id = useModelStore.getState().createStateInvariant({
      name: '',
      lifelineId: ll,
      constraint: 'idle',
      afterSequenceNumber: 0,
    });
    useModelStore.getState().deleteStateInvariant(id);
    expect(useModelStore.getState().model?.stateInvariants?.[id]).toBeUndefined();
  });

  it('cascades state-invariant deletion when its lifeline is deleted', () => {
    const ll1 = createLifeline('A');
    const ll2 = createLifeline('B');
    const onLl1 = useModelStore.getState().createStateInvariant({
      name: '',
      lifelineId: ll1,
      constraint: 'ready',
      afterSequenceNumber: 0,
    });
    const onLl2 = useModelStore.getState().createStateInvariant({
      name: '',
      lifelineId: ll2,
      constraint: 'idle',
      afterSequenceNumber: 0,
    });

    useModelStore.getState().deleteLifeline(ll1);

    const invariants = useModelStore.getState().model?.stateInvariants ?? {};
    expect(invariants[onLl1]).toBeUndefined();
    expect(invariants[onLl2]).toBeDefined();
  });
});
