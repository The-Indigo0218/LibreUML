import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { useModelStore } from '../../../../store/model.store';
import type {
  IRLifeline,
  IRMessage,
  IRActivation,
  ViewNode,
} from '../../../../core/domain/vfs/vfs.types';
import type {
  LifelineViewModel,
  MessageViewModel,
  ActivationViewModel,
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
const LIFELINE_HEAD_H = 50;
const MESSAGE_BAND_H = 50;
const TIMELINE_TOP_PAD = 30;
const TIMELINE_BOTTOM_PAD = 60;
const MIN_TIMELINE = 200;
const ACTIVATION_W = 10;
const ACTIVATION_END_PAD = 16; // extra height when activation is still open

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

  return [...lifelineNodes, ...activationNodes, ...messageNodes, ...noteNodes];
}
