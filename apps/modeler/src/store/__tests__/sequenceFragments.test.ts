import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Sequence Diagram — fragment store actions', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  function makeTwoLifelines(): { ll1: string; ll2: string } {
    const ll1 = useModelStore.getState().createLifeline({
      name: 'A', participantKind: 'ANONYMOUS', alias: 'A',
    });
    const ll2 = useModelStore.getState().createLifeline({
      name: 'B', participantKind: 'ANONYMOUS', alias: 'B',
    });
    return { ll1, ll2 };
  }

  it('creates an alt fragment with two empty operands', () => {
    const { ll1, ll2 } = makeTwoLifelines();
    const fid = useModelStore.getState().createFragment({
      name: 'alt-1',
      fragmentKind: 'ALT',
      coveredLifelineIds: [ll1, ll2],
      operands: [
        { id: 'op1', guard: 'x > 0', messageIds: [], fragmentIds: [] },
        { id: 'op2', guard: 'else', messageIds: [], fragmentIds: [] },
      ],
    });
    const frag = useModelStore.getState().model!.interactionFragments![fid];
    expect(frag.fragmentKind).toBe('ALT');
    expect(frag.operands).toHaveLength(2);
    expect(frag.coveredLifelineIds).toEqual([ll1, ll2]);
  });

  it('cascades fragment cleanup when a covered lifeline is deleted', () => {
    const { ll1, ll2 } = makeTwoLifelines();
    const fid = useModelStore.getState().createFragment({
      name: 'opt-1',
      fragmentKind: 'OPT',
      coveredLifelineIds: [ll1, ll2],
      operands: [{ id: 'op1', messageIds: [], fragmentIds: [] }],
    });
    useModelStore.getState().deleteLifeline(ll1);
    const frag = useModelStore.getState().model!.interactionFragments![fid];
    expect(frag.coveredLifelineIds).toEqual([ll2]);
  });

  it('deletes fragments that lose all covered lifelines', () => {
    const { ll1 } = makeTwoLifelines();
    const fid = useModelStore.getState().createFragment({
      name: 'loop-1',
      fragmentKind: 'LOOP',
      coveredLifelineIds: [ll1],
      operands: [{ id: 'op1', guard: 'i<10', messageIds: [], fragmentIds: [] }],
    });
    expect(useModelStore.getState().model!.interactionFragments![fid]).toBeDefined();
    useModelStore.getState().deleteLifeline(ll1);
    expect(useModelStore.getState().model!.interactionFragments![fid]).toBeUndefined();
  });

  it('deleteFragment re-parents children and unsets fragmentId on contained messages', () => {
    const { ll1, ll2 } = makeTwoLifelines();
    const parentId = useModelStore.getState().createFragment({
      name: 'parent',
      fragmentKind: 'ALT',
      coveredLifelineIds: [ll1, ll2],
      operands: [{ id: 'p-op1', messageIds: [], fragmentIds: [] }],
    });
    const childId = useModelStore.getState().createFragment({
      name: 'child',
      fragmentKind: 'OPT',
      coveredLifelineIds: [ll1, ll2],
      operands: [{ id: 'c-op1', messageIds: [], fragmentIds: [] }],
      parentFragmentId: parentId,
    });
    const msgId = useModelStore.getState().createMessage({
      name: 'inside',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
      fragmentId: parentId,
    });

    useModelStore.getState().deleteFragment(parentId);

    const childAfter = useModelStore.getState().model!.interactionFragments![childId];
    expect(childAfter.parentFragmentId).toBeUndefined();

    const msgAfter = useModelStore.getState().model!.messages![msgId];
    expect(msgAfter.fragmentId).toBeUndefined();
  });

  it('strips deleted messages from operand.messageIds', () => {
    const { ll1, ll2 } = makeTwoLifelines();
    const msgId = useModelStore.getState().createMessage({
      name: 'm1',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
    });
    const fid = useModelStore.getState().createFragment({
      name: 'alt-1',
      fragmentKind: 'ALT',
      coveredLifelineIds: [ll1, ll2],
      operands: [{ id: 'op1', messageIds: [msgId], fragmentIds: [] }],
    });
    expect(useModelStore.getState().model!.interactionFragments![fid].operands[0].messageIds).toContain(msgId);

    useModelStore.getState().deleteMessage(msgId);
    expect(useModelStore.getState().model!.interactionFragments![fid].operands[0].messageIds).not.toContain(msgId);
  });
});
