import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — coregions', () => {
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

  it('creates a coregion bracketing a lifeline', () => {
    const a = createLifeline('A');
    const id = useModelStore.getState().createCoregion({
      name: '',
      lifelineId: a,
      fromSequence: 0,
      toSequence: 3,
    });

    const cr = useModelStore.getState().model?.coregions?.[id];
    expect(cr).toBeDefined();
    expect(cr?.kind).toBe('COREGION');
    expect(cr?.lifelineId).toBe(a);
    expect(cr?.toSequence).toBe(3);
  });

  it('updates the span', () => {
    const a = createLifeline('A');
    const id = useModelStore.getState().createCoregion({
      name: '',
      lifelineId: a,
      fromSequence: 0,
      toSequence: 2,
    });
    useModelStore.getState().updateCoregion(id, { toSequence: 5 });
    expect(useModelStore.getState().model?.coregions?.[id]?.toSequence).toBe(5);
  });

  it('deletes a coregion', () => {
    const a = createLifeline('A');
    const id = useModelStore.getState().createCoregion({
      name: '',
      lifelineId: a,
      fromSequence: 0,
      toSequence: 1,
    });
    useModelStore.getState().deleteCoregion(id);
    expect(useModelStore.getState().model?.coregions?.[id]).toBeUndefined();
  });

  it('cascades coregion deletion when its lifeline is deleted', () => {
    const a = createLifeline('A');
    const b = createLifeline('B');
    const onA = useModelStore.getState().createCoregion({
      name: '',
      lifelineId: a,
      fromSequence: 0,
      toSequence: 2,
    });
    const onB = useModelStore.getState().createCoregion({
      name: '',
      lifelineId: b,
      fromSequence: 0,
      toSequence: 2,
    });

    useModelStore.getState().deleteLifeline(a);

    const coregions = useModelStore.getState().model?.coregions ?? {};
    expect(coregions[onA]).toBeUndefined();
    expect(coregions[onB]).toBeDefined();
  });
});
