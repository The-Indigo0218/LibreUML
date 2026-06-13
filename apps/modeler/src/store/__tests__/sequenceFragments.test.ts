import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';
import {
  FRAGMENT_KINDS,
  MULTI_OPERAND_FRAGMENT_KINDS,
  defaultOperandCount,
  type FragmentKind,
} from '../../core/domain/vfs/vfs.types';

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

// ─── Fragment-kind coverage (B1 — all 7 combined fragments creatable) ───────

describe('Sequence Diagram — all fragment kinds (B1)', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  it('exposes all seven UML 2.5 combined-fragment kinds', () => {
    expect(FRAGMENT_KINDS).toEqual(['ALT', 'OPT', 'LOOP', 'PAR', 'SEQ', 'BREAK', 'CRITICAL']);
  });

  it('defaultOperandCount seeds 2 for multi-operand kinds, 1 otherwise', () => {
    for (const k of FRAGMENT_KINDS) {
      const expected = MULTI_OPERAND_FRAGMENT_KINDS.has(k) ? 2 : 1;
      expect(defaultOperandCount(k)).toBe(expected);
    }
    // Explicit: alt/par/seq multi, opt/loop/break/critical single.
    expect(MULTI_OPERAND_FRAGMENT_KINDS.has('SEQ')).toBe(true);
    expect(MULTI_OPERAND_FRAGMENT_KINDS.has('CRITICAL')).toBe(false);
  });

  it('persists a fragment of every kind through the store', () => {
    const ll1 = useModelStore.getState().createLifeline({
      name: 'A', participantKind: 'ANONYMOUS', alias: 'A',
    });
    for (const kind of FRAGMENT_KINDS as readonly FragmentKind[]) {
      const operands = Array.from({ length: defaultOperandCount(kind) }, (_, i) => ({
        id: `${kind}-op${i}`, messageIds: [], fragmentIds: [],
      }));
      const fid = useModelStore.getState().createFragment({
        name: kind.toLowerCase(),
        fragmentKind: kind,
        coveredLifelineIds: [ll1],
        operands,
      });
      const frag = useModelStore.getState().model!.interactionFragments![fid];
      expect(frag.fragmentKind).toBe(kind);
      expect(frag.operands).toHaveLength(defaultOperandCount(kind));
    }
  });
});

// ─── Fragment operand-editing flows (what FragmentPropertiesModal commits) ───

describe('Sequence Diagram — operand edits via updateFragment', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  function setup() {
    const ll1 = useModelStore.getState().createLifeline({
      name: 'A', participantKind: 'ANONYMOUS', alias: 'A',
    });
    const ll2 = useModelStore.getState().createLifeline({
      name: 'B', participantKind: 'ANONYMOUS', alias: 'B',
    });
    const fid = useModelStore.getState().createFragment({
      name: 'alt-1',
      fragmentKind: 'ALT',
      coveredLifelineIds: [ll1, ll2],
      operands: [
        { id: 'op1', guard: 'x>0', messageIds: [], fragmentIds: [] },
        { id: 'op2', guard: 'else', messageIds: [], fragmentIds: [] },
      ],
    });
    return { ll1, ll2, fid };
  }

  it('saves an updated guard on an existing operand', () => {
    const { fid } = setup();
    const original = useModelStore.getState().model!.interactionFragments![fid].operands;
    const next = original.map((op) =>
      op.id === 'op1' ? { ...op, guard: 'x>=0' } : op,
    );
    useModelStore.getState().updateFragment(fid, { operands: next });

    const updated = useModelStore.getState().model!.interactionFragments![fid].operands;
    expect(updated.find((o) => o.id === 'op1')?.guard).toBe('x>=0');
    expect(updated.find((o) => o.id === 'op2')?.guard).toBe('else');
  });

  it('appends a new operand (simulating Add Operand)', () => {
    const { fid } = setup();
    const original = useModelStore.getState().model!.interactionFragments![fid].operands;
    const next = [
      ...original,
      { id: 'op3', guard: 'third', messageIds: [], fragmentIds: [] },
    ];
    useModelStore.getState().updateFragment(fid, { operands: next });

    const updated = useModelStore.getState().model!.interactionFragments![fid].operands;
    expect(updated).toHaveLength(3);
    expect(updated[2].guard).toBe('third');
  });

  it('removes an operand and migrates its messages to the previous operand', () => {
    const { ll1, ll2, fid } = setup();
    const msgId = useModelStore.getState().createMessage({
      name: 'mig',
      messageKind: 'SYNC',
      sourceLifelineId: ll1,
      targetLifelineId: ll2,
      sequenceNumber: 1,
    });
    // Manually put the message into op2.
    let opsNow = useModelStore.getState().model!.interactionFragments![fid].operands;
    opsNow = opsNow.map((op) =>
      op.id === 'op2' ? { ...op, messageIds: [msgId] } : op,
    );
    useModelStore.getState().updateFragment(fid, { operands: opsNow });

    // Now simulate the modal: remove op2 and merge its messages into op1.
    const after = useModelStore.getState().model!.interactionFragments![fid].operands;
    const removedIdx = after.findIndex((op) => op.id === 'op2');
    const removed = after[removedIdx];
    const survivors = after.filter((op) => op.id !== 'op2');
    const mergeTargetIdx = Math.max(0, removedIdx - 1);
    survivors[mergeTargetIdx] = {
      ...survivors[mergeTargetIdx],
      messageIds: [...survivors[mergeTargetIdx].messageIds, ...removed.messageIds],
    };
    useModelStore.getState().updateFragment(fid, { operands: survivors });

    const finalOps = useModelStore.getState().model!.interactionFragments![fid].operands;
    expect(finalOps).toHaveLength(1);
    expect(finalOps[0].id).toBe('op1');
    expect(finalOps[0].messageIds).toContain(msgId);
  });
});
