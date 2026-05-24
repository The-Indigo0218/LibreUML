/**
 * Pure helpers backing the SEQUENCE_DIAGRAM branch of useCanvasEventHandlers.onConnect.
 *
 * Extracted into its own module so they can be unit-tested without spinning up the
 * full React hook (which depends on workspace store, VFS store, etc.).
 */

import type {
  IRMessage,
  MessageKind,
  IRInteractionFragment,
} from '../../core/domain/vfs/vfs.types';

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

export interface FragmentAutoAssignment {
  fragmentId: string;
  operandId: string;
}

/**
 * Auto-assign a newly-created message to a fragment using a sequential heuristic.
 *
 * Rule: returns the fragment that
 *   (1) covers BOTH source and target lifelines, AND
 *   (2) contains a message whose sequenceNumber === newSequenceNumber - 1.
 *
 * Picks the deepest match (smallest covered-lifelines set) when several
 * fragments qualify, so nested fragments win over their parents.
 *
 * Returns the fragmentId + the operandId where the message should be appended,
 * or undefined if no fragment qualifies.
 */
export function autoAssignFragmentForNewMessage(
  fragments: Record<string, IRInteractionFragment>,
  messages: Record<string, IRMessage>,
  sourceLifelineId: string,
  targetLifelineId: string,
  newSequenceNumber: number,
): FragmentAutoAssignment | undefined {
  const previousSeq = newSequenceNumber - 1;
  if (previousSeq < 1) return undefined;

  // Find the message with sequenceNumber === previousSeq.
  const prevMsg = Object.values(messages).find((m) => m.sequenceNumber === previousSeq);
  if (!prevMsg) return undefined;

  const candidates: Array<{ frag: IRInteractionFragment; operandId: string }> = [];

  for (const frag of Object.values(fragments)) {
    const covers = new Set(frag.coveredLifelineIds);
    if (!covers.has(sourceLifelineId) || !covers.has(targetLifelineId)) continue;
    // The previous message must live in one of this fragment's operands.
    const owningOperand = frag.operands.find((op) => op.messageIds.includes(prevMsg.id));
    if (owningOperand) {
      candidates.push({ frag, operandId: owningOperand.id });
    }
  }

  if (candidates.length === 0) return undefined;

  // Deepest match = smallest coveredLifelineIds size (proxy for "innermost").
  candidates.sort((a, b) => a.frag.coveredLifelineIds.length - b.frag.coveredLifelineIds.length);
  return { fragmentId: candidates[0].frag.id, operandId: candidates[0].operandId };
}
