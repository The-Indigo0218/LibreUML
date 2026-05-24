/**
 * Pure helpers backing the SEQUENCE_DIAGRAM branch of useCanvasEventHandlers.onConnect.
 *
 * Extracted into its own module so they can be unit-tested without spinning up the
 * full React hook (which depends on workspace store, VFS store, etc.).
 */

import type { IRMessage, MessageKind } from '../../core/domain/vfs/vfs.types';

export const TOOL_TO_MESSAGE_KIND: Record<string, MessageKind> = {
  MESSAGE_SYNC:  'SYNC',
  MESSAGE_ASYNC: 'ASYNC',
  MESSAGE_REPLY: 'REPLY',
};

/**
 * For a new REPLY src→tgt, find the most recent open SYNC tgt→src (reversed)
 * so the activation auto-pairing in createMessage can close the matching bar.
 *
 * "Open" here is computed by the caller via the activations record; this helper
 * just returns the most recent SYNC that matches the reversed pair.
 */
export function findMatchingSyncForReply(
  messages: Record<string, IRMessage>,
  newSourceLifelineId: string,
  newTargetLifelineId: string,
): string | undefined {
  const candidates = Object.values(messages)
    .filter(
      (m) =>
        m.messageKind === 'SYNC' &&
        m.sourceLifelineId === newTargetLifelineId &&
        m.targetLifelineId === newSourceLifelineId,
    )
    .sort((a, b) => b.sequenceNumber - a.sequenceNumber);
  return candidates[0]?.id;
}

export function nextMessageSequenceNumber(messages: Record<string, IRMessage>): number {
  const max = Object.values(messages).reduce(
    (acc, m) => (m.sequenceNumber > acc ? m.sequenceNumber : acc),
    0,
  );
  return max + 1;
}
