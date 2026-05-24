import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { useModelStore } from '../../../../store/model.store';
import type {
  IRLifeline,
  IRMessage,
  IRActivation,
  IRInteractionFragment,
  ViewNode,
} from '../../../../core/domain/vfs/vfs.types';
import type {
  LifelineViewModel,
  MessageViewModel,
  ActivationViewModel,
  FragmentViewModel,
  FragmentOperandVM,
  LifelineParticipantKindVM,
} from '../../../../adapters/view-models/node.view-model';
import {
  resolveSemanticElement,
  getAbsolutePosition,
  makeNoteNode,
  type NodeBuilderContext,
} from './sharedNodeBuilders';

// ─── Layout constants ─────────────────────────────────────────────────────────

const LIFELINE_HEAD_W = 140;
export const LIFELINE_HEAD_H = 50;
export const MESSAGE_BAND_H = 50;
export const TIMELINE_TOP_PAD = 30;
const TIMELINE_BOTTOM_PAD = 60;
const MIN_TIMELINE = 200;
const ACTIVATION_W = 10;
const ACTIVATION_END_PAD = 16; // extra height when activation is still open
const FRAGMENT_X_PAD = 20;
const FRAGMENT_TOP_PAD = 28;
const FRAGMENT_BOTTOM_PAD = 16;
const FRAGMENT_MIN_W = 120;
const FRAGMENT_MIN_H = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveLifelineDisplayName(
  ll: IRLifeline,
  ctx: NodeBuilderContext,
): string {
  if (ll.alias) return ll.alias;
  if (ll.represents) {
    const resolved = resolveSemanticElement(ctx.model, ll.represents);
    if (resolved.element && 'name' in resolved.element) {
      return resolved.element.name;
    }
  }
  return ll.name || 'Lifeline';
}

function participantKindFromIR(k: IRLifeline['participantKind']): LifelineParticipantKindVM {
  return k;
}

function computeTimelineLength(messageCount: number): number {
  const need = TIMELINE_TOP_PAD + messageCount * MESSAGE_BAND_H + TIMELINE_BOTTOM_PAD;
  return Math.max(MIN_TIMELINE, need);
}

function messageYForIndex(index1Based: number): number {
  // index 1 → first band centred at TIMELINE_TOP_PAD + 0.5 * MESSAGE_BAND_H
  return TIMELINE_TOP_PAD + (index1Based - 0.5) * MESSAGE_BAND_H + LIFELINE_HEAD_H;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildSequenceDiagramNodes(ctx: NodeBuilderContext) {
  const { diagramView, model, isStandalone, activeTabId, handleNoteUpdate } = ctx;

  // 1. Collect lifeline view nodes (the ones with a resolvable IRLifeline)
  //    and notes. Other elementIds → notes fallback (orphan).
  const lifelineViewNodes: ViewNode[] = [];
  const noteViewNodes: ViewNode[] = [];

  for (const vn of diagramView.nodes) {
    const { kind } = resolveSemanticElement(model, vn.elementId);
    if (kind === 'LIFELINE') lifelineViewNodes.push(vn);
    else if (kind === 'NOTE' || kind === 'UNKNOWN') noteViewNodes.push(vn);
  }

  // 2. Order messages by sequenceNumber for stable indexing.
  const allMessages: IRMessage[] = Object.values(model.messages ?? {})
    .filter((m) => {
      // Only show messages whose source AND target are present in this diagram.
      const srcIn = lifelineViewNodes.some((vn) => vn.elementId === m.sourceLifelineId);
      const tgtIn = lifelineViewNodes.some((vn) => vn.elementId === m.targetLifelineId);
      return srcIn && tgtIn;
    })
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // 3. Lifeline-id → center X (computed once for messages to reuse).
  const lifelineCenterX = new Map<string, number>();
  for (const vn of lifelineViewNodes) {
    lifelineCenterX.set(vn.elementId, vn.x + LIFELINE_HEAD_W / 2);
  }

  const timelineLength = computeTimelineLength(allMessages.length);

  // 4. Emit Lifelines.
  const lifelineNodes = lifelineViewNodes.map((viewNode) => {
    const ll = model.lifelines?.[viewNode.elementId] as IRLifeline;
    const displayName = resolveLifelineDisplayName(ll, ctx);

    const onRename = (name: string) => {
      if (isStandalone && activeTabId) {
        standaloneModelOps(activeTabId).updateLifeline(viewNode.elementId, { alias: name });
      } else {
        useModelStore.getState().updateLifeline(viewNode.elementId, { alias: name });
      }
    };

    const viewModel: LifelineViewModel = {
      __brand: 'lifeline',
      id: viewNode.id,
      domainId: viewNode.elementId,
      name: displayName,
      participantKind: participantKindFromIR(ll.participantKind),
      isExternal: ll.isExternal,
      timelineLength,
      headWidth: LIFELINE_HEAD_W,
      headHeight: LIFELINE_HEAD_H,
      onRename,
    };

    return {
      id: viewNode.id,
      type: 'umlLifeline',
      position: getAbsolutePosition(viewNode, diagramView.nodes),
      data: viewModel,
      domainId: viewNode.elementId,
    };
  });

  // 4b. Build a lookup from messageId → 1-based index for activation Y maths.
  const messageIndex = new Map<string, number>();
  allMessages.forEach((m, i) => messageIndex.set(m.id, i + 1));

  // 4c. Emit Activations BEFORE messages so arrows render on top of bars.
  const allActivations: IRActivation[] = Object.values(model.activations ?? {}).filter((a) => {
    const lifelineInDiagram = lifelineViewNodes.some((vn) => vn.elementId === a.lifelineId);
    return lifelineInDiagram && messageIndex.has(a.startMessageId);
  });

  // Compute nesting depth per activation: how many other activations on the same
  // lifeline overlap and started earlier. Used as visual X offset.
  const nestingDepthFor = (act: IRActivation): number => {
    const startIdx = messageIndex.get(act.startMessageId)!;
    let depth = 0;
    for (const other of allActivations) {
      if (other.id === act.id) continue;
      if (other.lifelineId !== act.lifelineId) continue;
      const otherStart = messageIndex.get(other.startMessageId)!;
      const otherEnd = other.endMessageId ? messageIndex.get(other.endMessageId) ?? allMessages.length + 1 : allMessages.length + 1;
      if (otherStart < startIdx && otherEnd > startIdx) depth++;
    }
    return depth;
  };

  const activationNodes = allActivations.map((act) => {
    const startIdx = messageIndex.get(act.startMessageId)!;
    const endIdx = act.endMessageId
      ? messageIndex.get(act.endMessageId) ?? null
      : null;
    const topY = messageYForIndex(startIdx);
    const bottomY = endIdx
      ? messageYForIndex(endIdx)
      : topY + MESSAGE_BAND_H + ACTIVATION_END_PAD;
    const height = Math.max(MESSAGE_BAND_H * 0.6, bottomY - topY);
    const centerX = lifelineCenterX.get(act.lifelineId) ?? 0;

    const viewModel: ActivationViewModel = {
      __brand: 'activation',
      id: act.id,
      domainId: act.id,
      width: ACTIVATION_W,
      height,
      isOpen: !act.endMessageId,
      nestingDepth: nestingDepthFor(act),
    };

    return {
      id: `act-${act.id}`,
      type: 'umlActivation',
      position: { x: centerX, y: topY },
      data: viewModel,
      domainId: act.id,
    };
  });

  // 5. Emit Messages (as pseudo-edge nodes — see plan §5).
  const allFragments = Object.values(model.interactionFragments ?? {}) as IRInteractionFragment[];
  const hierarchicalNumbers = computeHierarchicalNumbers(allMessages, allFragments);

  const messageNodes = allMessages.map((msg, idx) => {
    const srcX = lifelineCenterX.get(msg.sourceLifelineId) ?? 0;
    const tgtX = lifelineCenterX.get(msg.targetLifelineId) ?? srcX;
    const isSelf = msg.sourceLifelineId === msg.targetLifelineId;
    const y = messageYForIndex(idx + 1);

    const viewModel: MessageViewModel = {
      __brand: 'message',
      id: msg.id,
      domainId: msg.id,
      name: msg.name || '',
      messageKind: msg.messageKind,
      sequenceNumber: msg.sequenceNumber,
      displayNumber: hierarchicalNumbers.get(msg.id) ?? `${msg.sequenceNumber}`,
      length: isSelf ? 0 : tgtX - srcX,
      isSelfMessage: isSelf,
      onRename: (name: string) => {
        if (isStandalone && activeTabId) {
          standaloneModelOps(activeTabId).updateMessage(msg.id, { name });
        } else {
          useModelStore.getState().updateMessage(msg.id, { name });
        }
      },
    };

    return {
      id: `msg-${msg.id}`,
      type: 'umlMessage',
      position: { x: srcX, y },
      data: viewModel,
      domainId: msg.id,
    };
  });

  // 6. Emit Notes (reuse existing makeNoteNode helper).
  const noteNodes = noteViewNodes.map((vn) =>
    makeNoteNode(vn, handleNoteUpdate, diagramView.nodes),
  );

  // 7. Emit Combined Fragments. They must render BEHIND messages/activations
  //    so we prepend them to the result.
  const fragmentNodes = buildFragmentNodes(
    Object.values(model.interactionFragments ?? {}),
    lifelineViewNodes,
    lifelineCenterX,
    messageIndex,
    allMessages.length,
  );

  return [...fragmentNodes, ...lifelineNodes, ...activationNodes, ...messageNodes, ...noteNodes];
}

// ─── Fragment geometry ────────────────────────────────────────────────────────

function buildFragmentNodes(
  fragments: IRInteractionFragment[],
  _lifelineViewNodes: ViewNode[],
  lifelineCenterX: Map<string, number>,
  messageIndex: Map<string, number>,
  totalMessages: number,
) {
  // Compute nesting depth = number of ancestors.
  const depthFor = (frag: IRInteractionFragment): number => {
    let d = 0;
    let current = frag.parentFragmentId;
    const guard = new Set<string>([frag.id]);
    while (current && !guard.has(current)) {
      guard.add(current);
      const parent = fragments.find((f) => f.id === current);
      if (!parent) break;
      d++;
      current = parent.parentFragmentId;
    }
    return d;
  };

  return fragments
    .map((frag) => {
      // Filter to lifelines actually present in the diagram.
      const liveLifelineIds = frag.coveredLifelineIds.filter((id) => lifelineCenterX.has(id));
      if (liveLifelineIds.length === 0) return null;

      const xs = liveLifelineIds.map((id) => lifelineCenterX.get(id)!).sort((a, b) => a - b);
      const left = xs[0] - FRAGMENT_X_PAD;
      const right = xs[xs.length - 1] + FRAGMENT_X_PAD;
      const width = Math.max(FRAGMENT_MIN_W, right - left);

      // Y bounds: derived from the messages contained in any operand.
      const allMsgIds = frag.operands.flatMap((op) => op.messageIds);
      const messageYs = allMsgIds
        .map((mid) => messageIndex.get(mid))
        .filter((idx): idx is number => idx !== undefined)
        .map((idx) => messageYForIndex(idx));

      let top: number;
      let bottom: number;
      if (messageYs.length > 0) {
        top = Math.min(...messageYs) - FRAGMENT_TOP_PAD;
        bottom = Math.max(...messageYs) + MESSAGE_BAND_H / 2 + FRAGMENT_BOTTOM_PAD;
      } else {
        // Empty fragment: anchor below the lifeline head.
        top = LIFELINE_HEAD_H + TIMELINE_TOP_PAD;
        bottom = top + FRAGMENT_MIN_H;
      }
      const height = Math.max(FRAGMENT_MIN_H, bottom - top);

      // Operand yOffsets: first = 0; rest distributed by message count.
      const operandVMs: FragmentOperandVM[] = (() => {
        const result: FragmentOperandVM[] = [];
        const totalOps = frag.operands.length || 1;
        const operandBandH = height / totalOps;
        frag.operands.forEach((op, idx) => {
          result.push({
            id: op.id,
            guard: op.guard,
            yOffset: idx * operandBandH,
          });
        });
        return result;
      })();

      const viewModel: FragmentViewModel = {
        __brand: 'fragment',
        id: frag.id,
        domainId: frag.id,
        fragmentKind: frag.fragmentKind,
        width,
        height,
        operands: operandVMs,
        nestingDepth: depthFor(frag),
      };

      return {
        id: `frag-${frag.id}`,
        type: 'umlFragment',
        position: { x: left, y: top },
        data: viewModel,
        domainId: frag.id,
      };
    })
    .filter(<T>(n: T | null): n is T => n !== null);
  // Note: totalMessages currently unused in geometry calc but kept in signature
  // for future use (e.g. clamping bottom to within-the-timeline).
  void totalMessages;
}

/**
 * Convert a canvas Y coordinate (from a MessageShape drag) to a 1-based
 * slot index, clamped within [1, totalMessages].
 *
 * Inverse of `messageYForIndex`.
 */
export function yToMessageSlot(y: number, totalMessages: number): number {
  const raw = (y - LIFELINE_HEAD_H - TIMELINE_TOP_PAD) / MESSAGE_BAND_H + 0.5;
  return Math.max(1, Math.min(totalMessages, Math.round(raw)));
}

/**
 * Compute hierarchical display numbers for messages.
 *
 * Root messages (not inside any fragment) get 1, 2, 3 …
 * Messages inside a fragment get <rootContext>.<positionInOperand> …
 * Sub-fragment messages get <rootContext>.<parentPos>.<positionInOperand> …
 *
 * Sub-fragments that appear between sibling messages "consume" a slot so
 * messages following them are not assigned the same number (no collisions).
 *
 * Returns a Map<messageId, displayString>.
 */
export function computeHierarchicalNumbers(
  messages: IRMessage[],
  fragments: IRInteractionFragment[],
): Map<string, string> {
  const result = new Map<string, string>();
  if (messages.length === 0) return result;

  const sorted = [...messages].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const fragById = new Map(fragments.map((f) => [f.id, f]));

  // messageId → id of the fragment whose operand directly contains it
  const msgDirectFrag = new Map<string, string>();
  for (const frag of fragments) {
    for (const op of frag.operands) {
      for (const msgId of op.messageIds) {
        msgDirectFrag.set(msgId, frag.id);
      }
    }
  }

  // Root messages: not in any fragment operand
  const rootMsgs = sorted.filter((m) => !msgDirectFrag.has(m.id));
  rootMsgs.forEach((m, i) => result.set(m.id, `${i + 1}`));

  // Min sequenceNumber of the direct messages in each fragment
  const fragMinSeq = new Map<string, number>();
  for (const frag of fragments) {
    const seqs = frag.operands
      .flatMap((op) => op.messageIds)
      .map((id) => sorted.find((m) => m.id === id)?.sequenceNumber ?? Infinity);
    fragMinSeq.set(frag.id, seqs.length > 0 ? Math.min(...seqs) : Infinity);
  }

  // Direct child fragments per parent (null = root level)
  const childFrags = new Map<string | null, string[]>();
  for (const frag of fragments) {
    const parent = frag.parentFragmentId ?? null;
    if (!childFrags.has(parent)) childFrags.set(parent, []);
    childFrags.get(parent)!.push(frag.id);
  }

  // Compute prefix for a fragment, counting sibling sub-fragments as slot occupants
  const prefixCache = new Map<string, string>();

  function getFragPrefix(fragId: string, visited = new Set<string>()): string {
    if (prefixCache.has(fragId)) return prefixCache.get(fragId)!;
    if (visited.has(fragId)) return '';
    visited.add(fragId);

    const frag = fragById.get(fragId);
    if (!frag) return '';
    const myMinSeq = fragMinSeq.get(fragId) ?? Infinity;

    let prefix: string;
    if (!frag.parentFragmentId) {
      // Root fragment: anchor = count of root messages that precede it
      const prevRootCount = rootMsgs.filter((m) => m.sequenceNumber < myMinSeq).length;
      prefix = prevRootCount > 0 ? `${prevRootCount}` : '';
    } else {
      const parentPrefix = getFragPrefix(frag.parentFragmentId, visited);
      const parentFrag = fragById.get(frag.parentFragmentId);
      if (!parentFrag) {
        prefix = parentPrefix;
      } else {
        // Position = (parent direct messages before us) + (sibling frags before us) + 1
        const parentDirectIds = new Set(parentFrag.operands.flatMap((op) => op.messageIds));
        const prevDirectMsgs = sorted.filter(
          (m) => parentDirectIds.has(m.id) && m.sequenceNumber < myMinSeq,
        ).length;
        const siblingFragIds = childFrags.get(frag.parentFragmentId) ?? [];
        const prevSiblingFrags = siblingFragIds.filter(
          (sid) => sid !== fragId && (fragMinSeq.get(sid) ?? Infinity) < myMinSeq,
        ).length;
        const pos = prevDirectMsgs + prevSiblingFrags + 1;
        prefix = parentPrefix ? `${parentPrefix}.${pos}` : `${pos}`;
      }
    }

    prefixCache.set(fragId, prefix);
    return prefix;
  }

  // Assign numbers to fragment-nested messages.
  // Position = (preceding direct msgs in same operand) + (child sub-frags before this msg) + 1
  for (const frag of fragments) {
    const childFragIds = childFrags.get(frag.id) ?? [];
    const fragPrefix = getFragPrefix(frag.id);

    for (const op of frag.operands) {
      const opMsgsSorted = op.messageIds
        .map((id) => sorted.find((m) => m.id === id))
        .filter((m): m is IRMessage => !!m)
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      for (const msg of opMsgsSorted) {
        const msgSeq = msg.sequenceNumber;
        const prevDirectMsgs = opMsgsSorted.filter((m) => m.sequenceNumber < msgSeq).length;
        const prevSubFrags = childFragIds.filter(
          (cid) => (fragMinSeq.get(cid) ?? Infinity) < msgSeq,
        ).length;
        const posInContext = prevDirectMsgs + prevSubFrags + 1;
        result.set(msg.id, fragPrefix ? `${fragPrefix}.${posInContext}` : `${posInContext}`);
      }
    }
  }

  return result;
}
