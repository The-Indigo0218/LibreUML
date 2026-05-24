import { describe, it, expect } from 'vitest';
import {
  TOOL_TO_MESSAGE_KIND,
  findMatchingSyncForReply,
  nextMessageSequenceNumber,
  autoAssignFragmentForNewMessage,
} from '../sequenceMessageHelpers';
import type {
  IRMessage,
  IRInteractionFragment,
} from '../../../core/domain/vfs/vfs.types';

function msg(
  id: string,
  src: string,
  tgt: string,
  seq: number,
  kind: IRMessage['messageKind'] = 'SYNC',
): IRMessage {
  return {
    id,
    kind: 'MESSAGE',
    name: id,
    sourceLifelineId: src,
    targetLifelineId: tgt,
    sequenceNumber: seq,
    messageKind: kind,
  };
}

describe('TOOL_TO_MESSAGE_KIND', () => {
  it('maps the three sidebar tool ids to MessageKind', () => {
    expect(TOOL_TO_MESSAGE_KIND.MESSAGE_SYNC).toBe('SYNC');
    expect(TOOL_TO_MESSAGE_KIND.MESSAGE_ASYNC).toBe('ASYNC');
    expect(TOOL_TO_MESSAGE_KIND.MESSAGE_REPLY).toBe('REPLY');
  });

  it('returns undefined for unknown tool ids', () => {
    expect(TOOL_TO_MESSAGE_KIND.BOGUS).toBeUndefined();
    expect(TOOL_TO_MESSAGE_KIND.ASSOCIATION).toBeUndefined();
  });
});

describe('nextMessageSequenceNumber', () => {
  it('returns 1 for an empty messages record', () => {
    expect(nextMessageSequenceNumber({})).toBe(1);
  });

  it('returns max + 1', () => {
    const messages = {
      m1: msg('m1', 'A', 'B', 1),
      m2: msg('m2', 'B', 'A', 2),
      m3: msg('m3', 'A', 'B', 5),
    };
    expect(nextMessageSequenceNumber(messages)).toBe(6);
  });

  it('handles non-contiguous sequence numbers', () => {
    const messages = {
      m1: msg('m1', 'A', 'B', 10),
      m2: msg('m2', 'A', 'B', 3),
    };
    expect(nextMessageSequenceNumber(messages)).toBe(11);
  });
});

describe('findMatchingSyncForReply', () => {
  it('returns undefined when no SYNC matches the reversed pair', () => {
    const messages = {
      m1: msg('m1', 'A', 'B', 1, 'SYNC'),
    };
    // REPLY would be B → A, looking for SYNC A → B; that exists, so should match.
    expect(findMatchingSyncForReply(messages, 'B', 'A')).toBe('m1');
    // But REPLY C → D has no matching SYNC.
    expect(findMatchingSyncForReply(messages, 'C', 'D')).toBeUndefined();
  });

  it('returns the most recent SYNC when multiple match', () => {
    const messages = {
      old: msg('old', 'A', 'B', 1, 'SYNC'),
      newer: msg('newer', 'A', 'B', 5, 'SYNC'),
      mid: msg('mid', 'A', 'B', 3, 'SYNC'),
    };
    expect(findMatchingSyncForReply(messages, 'B', 'A')).toBe('newer');
  });

  it('ignores non-SYNC messages even if the pair matches', () => {
    const messages = {
      m1: msg('m1', 'A', 'B', 1, 'ASYNC'),
    };
    expect(findMatchingSyncForReply(messages, 'B', 'A')).toBeUndefined();
  });

  it('does NOT match a SYNC in the same direction (only reversed pairs)', () => {
    const messages = {
      m1: msg('m1', 'A', 'B', 1, 'SYNC'),
    };
    expect(findMatchingSyncForReply(messages, 'A', 'B')).toBeUndefined();
  });
});

// ─── autoAssignFragmentForNewMessage ──────────────────────────────────────────

function frag(
  id: string,
  covered: string[],
  operandMessages: string[],
): IRInteractionFragment {
  return {
    id,
    kind: 'FRAGMENT',
    name: id,
    fragmentKind: 'ALT',
    coveredLifelineIds: covered,
    operands: [
      { id: `${id}-op1`, messageIds: operandMessages, fragmentIds: [] },
    ],
  };
}

describe('autoAssignFragmentForNewMessage', () => {
  it('returns undefined when there is no previous message', () => {
    const result = autoAssignFragmentForNewMessage({}, {}, 'A', 'B', 1);
    expect(result).toBeUndefined();
  });

  it('returns undefined when the previous message exists but no fragment owns it', () => {
    const messages = { m1: msg('m1', 'A', 'B', 1) };
    const result = autoAssignFragmentForNewMessage({}, messages, 'A', 'B', 2);
    expect(result).toBeUndefined();
  });

  it('assigns to a fragment whose operand contains the previous message and covers both endpoints', () => {
    const messages = { m1: msg('m1', 'A', 'B', 1) };
    const fragments = { f1: frag('f1', ['A', 'B'], ['m1']) };
    const result = autoAssignFragmentForNewMessage(fragments, messages, 'A', 'B', 2);
    expect(result?.fragmentId).toBe('f1');
    expect(result?.operandId).toBe('f1-op1');
  });

  it('does NOT assign when target lifeline is not covered', () => {
    const messages = { m1: msg('m1', 'A', 'B', 1) };
    const fragments = { f1: frag('f1', ['A'], ['m1']) }; // B not covered
    const result = autoAssignFragmentForNewMessage(fragments, messages, 'A', 'B', 2);
    expect(result).toBeUndefined();
  });

  it('picks the deepest (smallest covered set) when multiple fragments qualify', () => {
    const messages = { m1: msg('m1', 'A', 'B', 1) };
    const outer = frag('outer', ['A', 'B', 'C'], ['m1']);
    const inner = frag('inner', ['A', 'B'], ['m1']);
    const fragments = { outer, inner };
    const result = autoAssignFragmentForNewMessage(fragments, messages, 'A', 'B', 2);
    expect(result?.fragmentId).toBe('inner');
  });

  it('does NOT assign when the sequence gap is broken (previous=seq-2 not seq-1)', () => {
    // Only m1 with seq=1 exists; new message would be seq=3 (e.g. seq=2 was deleted).
    const messages = { m1: msg('m1', 'A', 'B', 1) };
    const fragments = { f1: frag('f1', ['A', 'B'], ['m1']) };
    const result = autoAssignFragmentForNewMessage(fragments, messages, 'A', 'B', 3);
    expect(result).toBeUndefined();
  });
});
