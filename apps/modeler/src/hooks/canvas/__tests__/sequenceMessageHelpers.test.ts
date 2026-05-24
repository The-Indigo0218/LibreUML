import { describe, it, expect } from 'vitest';
import {
  TOOL_TO_MESSAGE_KIND,
  findMatchingSyncForReply,
  nextMessageSequenceNumber,
} from '../sequenceMessageHelpers';
import type { IRMessage } from '../../../core/domain/vfs/vfs.types';

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
