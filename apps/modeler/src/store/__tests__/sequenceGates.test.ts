import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — gates', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  function createLifeline(name: string): string {
    return useModelStore.getState().createLifeline({ name, participantKind: 'ANONYMOUS', alias: name });
  }

  function createFragment(coveredLifelineIds: string[]): string {
    return useModelStore.getState().createFragment({
      name: 'alt',
      fragmentKind: 'ALT',
      coveredLifelineIds,
      operands: [{ id: 'op', guard: '', messageIds: [], fragmentIds: [] }],
    });
  }

  it('creates / updates / deletes a gate on a fragment', () => {
    const ll = createLifeline('A');
    const frag = createFragment([ll]);
    const id = useModelStore.getState().createGate({
      name: 'in', ownerFragmentId: frag, side: 'LEFT', afterSequenceNumber: 0,
    });
    expect(useModelStore.getState().model?.gates?.[id]?.ownerFragmentId).toBe(frag);

    useModelStore.getState().updateGate(id, { name: 'out', side: 'RIGHT' });
    const g = useModelStore.getState().model?.gates?.[id];
    expect(g?.name).toBe('out');
    expect(g?.side).toBe('RIGHT');

    useModelStore.getState().deleteGate(id);
    expect(useModelStore.getState().model?.gates?.[id]).toBeUndefined();
  });

  it('clears gate references on messages when the gate is deleted', () => {
    const ll = createLifeline('A');
    const frag = createFragment([ll]);
    const gate = useModelStore.getState().createGate({
      name: 'g', ownerFragmentId: frag, side: 'RIGHT', afterSequenceNumber: 0,
    });
    const msg = useModelStore.getState().createMessage({
      name: 'cross', messageKind: 'ASYNC',
      sourceLifelineId: ll, targetLifelineId: '', sequenceNumber: 1, targetGateId: gate,
    });

    useModelStore.getState().deleteGate(gate);
    expect(useModelStore.getState().model?.messages?.[msg]?.targetGateId).toBeUndefined();
  });

  it('deletes a fragment\'s gates (and clears refs) when the fragment is deleted', () => {
    const ll = createLifeline('A');
    const frag = createFragment([ll]);
    const gate = useModelStore.getState().createGate({
      name: 'g', ownerFragmentId: frag, side: 'LEFT', afterSequenceNumber: 0,
    });
    const msg = useModelStore.getState().createMessage({
      name: 'cross', messageKind: 'ASYNC',
      sourceLifelineId: '', targetLifelineId: ll, sequenceNumber: 1, sourceGateId: gate,
    });

    useModelStore.getState().deleteFragment(frag);
    expect(useModelStore.getState().model?.gates?.[gate]).toBeUndefined();
    expect(useModelStore.getState().model?.messages?.[msg]?.sourceGateId).toBeUndefined();
  });

  it('cascades gate deletion when the fragment is dropped via lifeline removal', () => {
    const ll = createLifeline('A');
    const frag = createFragment([ll]);
    const gate = useModelStore.getState().createGate({
      name: 'g', ownerFragmentId: frag, side: 'LEFT', afterSequenceNumber: 0,
    });
    // Deleting the only covered lifeline drops the (now empty) fragment + its gate.
    useModelStore.getState().deleteLifeline(ll);
    expect(useModelStore.getState().model?.interactionFragments?.[frag]).toBeUndefined();
    expect(useModelStore.getState().model?.gates?.[gate]).toBeUndefined();
  });
});
