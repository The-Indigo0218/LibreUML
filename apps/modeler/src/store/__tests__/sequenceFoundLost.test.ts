import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — found/lost messages', () => {
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

  it('persists the isFound flag and creates no activation (ASYNC)', () => {
    const ll = createLifeline('A');
    const id = useModelStore.getState().createMessage({
      name: 'event',
      messageKind: 'ASYNC',
      sourceLifelineId: '',
      targetLifelineId: ll,
      sequenceNumber: 1,
      isFound: true,
    });
    const msg = useModelStore.getState().model?.messages?.[id];
    expect(msg?.isFound).toBe(true);
    expect(msg?.sourceLifelineId).toBe('');
    expect(Object.keys(useModelStore.getState().model?.activations ?? {})).toHaveLength(0);
  });

  it('persists the isLost flag with an empty target', () => {
    const ll = createLifeline('A');
    const id = useModelStore.getState().createMessage({
      name: 'fire',
      messageKind: 'ASYNC',
      sourceLifelineId: ll,
      targetLifelineId: '',
      sequenceNumber: 1,
      isLost: true,
    });
    const msg = useModelStore.getState().model?.messages?.[id];
    expect(msg?.isLost).toBe(true);
    expect(msg?.targetLifelineId).toBe('');
  });

  it('cascades a found message when its real lifeline is deleted', () => {
    const ll = createLifeline('A');
    const id = useModelStore.getState().createMessage({
      name: '',
      messageKind: 'ASYNC',
      sourceLifelineId: '',
      targetLifelineId: ll,
      sequenceNumber: 1,
      isFound: true,
    });
    useModelStore.getState().deleteLifeline(ll);
    expect(useModelStore.getState().model?.messages?.[id]).toBeUndefined();
  });
});
