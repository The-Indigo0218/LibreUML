import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — interaction uses (ref)', () => {
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

  it('creates an interaction use covering lifelines', () => {
    const ll1 = createLifeline('A');
    const ll2 = createLifeline('B');
    const id = useModelStore.getState().createInteractionUse({
      name: 'Login',
      coveredLifelineIds: [ll1, ll2],
      referencedName: 'Login',
      afterSequenceNumber: 0,
    });
    const use = useModelStore.getState().model?.interactionUses?.[id];
    expect(use).toBeDefined();
    expect(use?.kind).toBe('INTERACTION_USE');
    expect(use?.coveredLifelineIds).toEqual([ll1, ll2]);
    expect(use?.referencedName).toBe('Login');
  });

  it('updates the referenced diagram and label', () => {
    const ll1 = createLifeline('A');
    const id = useModelStore.getState().createInteractionUse({
      name: '',
      coveredLifelineIds: [ll1],
      afterSequenceNumber: 0,
    });
    useModelStore.getState().updateInteractionUse(id, {
      referencedDiagramId: 'diagram-xyz',
      referencedName: 'Checkout',
    });
    const use = useModelStore.getState().model?.interactionUses?.[id];
    expect(use?.referencedDiagramId).toBe('diagram-xyz');
    expect(use?.referencedName).toBe('Checkout');
  });

  it('deletes an interaction use', () => {
    const ll1 = createLifeline('A');
    const id = useModelStore.getState().createInteractionUse({
      name: '',
      coveredLifelineIds: [ll1],
      afterSequenceNumber: 0,
    });
    useModelStore.getState().deleteInteractionUse(id);
    expect(useModelStore.getState().model?.interactionUses?.[id]).toBeUndefined();
  });

  it('strips a deleted lifeline from a ref, dropping the ref when it covers none', () => {
    const ll1 = createLifeline('A');
    const ll2 = createLifeline('B');
    const spanning = useModelStore.getState().createInteractionUse({
      name: '',
      coveredLifelineIds: [ll1, ll2],
      afterSequenceNumber: 0,
    });
    const soloOnLl1 = useModelStore.getState().createInteractionUse({
      name: '',
      coveredLifelineIds: [ll1],
      afterSequenceNumber: 0,
    });

    useModelStore.getState().deleteLifeline(ll1);

    const uses = useModelStore.getState().model?.interactionUses ?? {};
    // The spanning ref survives but no longer covers ll1.
    expect(uses[spanning]?.coveredLifelineIds).toEqual([ll2]);
    // The ref that only covered ll1 is dropped.
    expect(uses[soloOnLl1]).toBeUndefined();
  });
});
