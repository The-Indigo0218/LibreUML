import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { useModelStore } from '../../../../store/model.store';
import type {
  IRLifeline,
  IRMessage,
  IRActivation,
  IRInteractionFragment,
  IRStateInvariant,
  IRInteractionUse,
  IRGate,
  IRContinuation,
  ViewNode,
  SemanticModel,
} from '../../../../core/domain/vfs/vfs.types';
import type {
  LifelineViewModel,
  MessageViewModel,
  ActivationViewModel,
  FragmentViewModel,
  FragmentOperandVM,
  StateInvariantViewModel,
  InteractionUseViewModel,
  GateViewModel,
  GeneralOrderingViewModel,
  TimeConstraintViewModel,
  CoregionViewModel,
  ContinuationViewModel,
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
const STATE_INVARIANT_H = 22;
const STATE_INVARIANT_MIN_W = 56;
const STATE_INVARIANT_CHAR_W = 6.2;
const STATE_INVARIANT_PAD_X = 16;
const INTERACTION_USE_H = 48;
const FOUND_LOST_OFFSET = 70; // gap between a lifeline and its found/lost dot
const GATE_SIZE = 10;

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

// ─── Variable slot layout (P4) ──────────────────────────────────────────────
//
// Slots are MESSAGE_BAND_H tall by default, but a message that *opens* one or
// more combined fragments needs extra room above it so the fragment header(s)
// don't compress into the message above — nested/stacked fragments each add a
// header band. The layout is a cumulative array of boundary offsets; absent a
// layout every helper degrades to the original uniform grid (backward compat).

/** Extra room reserved above the first message of each fragment for its header. */
const FRAGMENT_HEADER_ROOM = 26;

export interface SlotLayout {
  /**
   * tops[s] = cumulative px offset (from HEAD + TOP_PAD) of the boundary *after*
   * s messages. tops[0] = 0; length = count + 1. Band i (1-based) is centred at
   * tops[i] - MESSAGE_BAND_H / 2.
   */
  tops: number[];
  /** Number of ordered messages (= tops.length - 1). */
  count: number;
}

type SlotLayoutModel = Pick<SemanticModel, 'messages' | 'interactionFragments'>;

/**
 * Build the slot layout for a model: a cumulative boundary offset per message,
 * widening the band before any message that starts a fragment so nested/stacked
 * fragment headers each get their own room (P4). With no fragments this is the
 * uniform grid (tops[i] = i * MESSAGE_BAND_H).
 */
export function computeSlotLayoutFor(
  orderedMessages: IRMessage[],
  fragments: IRInteractionFragment[],
): SlotLayout {
  const slotOf = new Map<string, number>();
  orderedMessages.forEach((m, i) => slotOf.set(m.id, i + 1));

  // How many fragments begin at each 1-based message slot (earliest covered msg).
  const fragmentStartsAt = new Map<number, number>();
  for (const frag of fragments) {
    const slots = frag.operands
      .flatMap((op) => op.messageIds)
      .map((id) => slotOf.get(id))
      .filter((s): s is number => s !== undefined);
    if (slots.length === 0) continue;
    const start = Math.min(...slots);
    fragmentStartsAt.set(start, (fragmentStartsAt.get(start) ?? 0) + 1);
  }

  const tops = [0];
  for (let i = 1; i <= orderedMessages.length; i++) {
    const headerExtra = (fragmentStartsAt.get(i) ?? 0) * FRAGMENT_HEADER_ROOM;
    tops.push(tops[i - 1] + headerExtra + MESSAGE_BAND_H);
  }
  return { tops, count: orderedMessages.length };
}

/** Model-level convenience wrapper (orders messages by sequenceNumber). */
export function computeSlotLayout(model: SlotLayoutModel): SlotLayout {
  const ordered = Object.values(model.messages ?? {}).sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );
  return computeSlotLayoutFor(ordered, Object.values(model.interactionFragments ?? {}));
}

/** Offset (from HEAD + TOP_PAD) of band `i`'s centre. */
function slotCenterOffset(i: number, layout?: SlotLayout): number {
  if (!layout) return (i - 0.5) * MESSAGE_BAND_H;
  if (i <= layout.count) return layout.tops[i] - MESSAGE_BAND_H / 2;
  // Beyond the last message (insertion append) — extrapolate on the uniform grid.
  return layout.tops[layout.count] + (i - layout.count - 0.5) * MESSAGE_BAND_H;
}

/** Offset (from HEAD + TOP_PAD) of the boundary *after* `slot` messages. */
function boundaryOffset(slot: number, layout?: SlotLayout): number {
  if (!layout) return slot * MESSAGE_BAND_H;
  if (slot <= layout.count) return layout.tops[slot];
  return layout.tops[layout.count] + (slot - layout.count) * MESSAGE_BAND_H;
}

function computeTimelineLength(messageCount: number, layout?: SlotLayout): number {
  const span = layout ? layout.tops[layout.count] : messageCount * MESSAGE_BAND_H;
  return Math.max(MIN_TIMELINE, TIMELINE_TOP_PAD + span + TIMELINE_BOTTOM_PAD);
}

export function messageYForIndex(index1Based: number, layout?: SlotLayout): number {
  return LIFELINE_HEAD_H + TIMELINE_TOP_PAD + slotCenterOffset(index1Based, layout);
}

/**
 * Y coordinate (centre) at which a state invariant anchored *after* message
 * slot `slot` sits — exactly on the boundary between slot and slot+1. slot 0
 * places it at the top of the timeline, before the first message.
 *
 * Exported for unit tests and for the StateInvariant layout below.
 */
export function stateInvariantSlotY(slot: number, layout?: SlotLayout): number {
  return LIFELINE_HEAD_H + TIMELINE_TOP_PAD + boundaryOffset(slot, layout);
}

/** Estimated stadium width for a state-invariant constraint string. */
export function estimateStateInvariantWidth(constraint: string): number {
  const textLen = (constraint?.length ?? 0) + 2; // +2 for the surrounding braces
  return Math.max(STATE_INVARIANT_MIN_W, textLen * STATE_INVARIANT_CHAR_W + STATE_INVARIANT_PAD_X);
}

/**
 * Horizontal bounds (left/right edge X) of a fragment-like box covering the
 * given lifelines. Returns null when none are present in the diagram. Shared by
 * combined fragments, interaction uses, and gate placement so edges stay aligned.
 */
function fragmentHorizontalBounds(
  coveredLifelineIds: string[],
  lifelineCenterX: Map<string, number>,
): { left: number; right: number } | null {
  const liveIds = coveredLifelineIds.filter((id) => lifelineCenterX.has(id));
  if (liveIds.length === 0) return null;
  const xs = liveIds.map((id) => lifelineCenterX.get(id)!).sort((a, b) => a - b);
  const left = xs[0] - FRAGMENT_X_PAD;
  const rawRight = xs[xs.length - 1] + FRAGMENT_X_PAD;
  return { left, right: Math.max(left + FRAGMENT_MIN_W, rawRight) };
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

  // 2. Lifeline-id → center X (computed once; reused by messages and gates).
  const lifelineCenterX = new Map<string, number>();
  for (const vn of lifelineViewNodes) {
    lifelineCenterX.set(vn.elementId, vn.x + LIFELINE_HEAD_W / 2);
  }

  // 2b. Gate-id → boundary X (the gate's owner fragment edge). Used to route
  //     gate-attached message ends and to render the gate markers.
  const gateEdgeX = new Map<string, number>();
  for (const gate of Object.values(model.gates ?? {}) as IRGate[]) {
    const owner = model.interactionFragments?.[gate.ownerFragmentId];
    if (!owner) continue;
    const bounds = fragmentHorizontalBounds(owner.coveredLifelineIds, lifelineCenterX);
    if (!bounds) continue;
    gateEdgeX.set(gate.id, gate.side === 'LEFT' ? bounds.left : bounds.right);
  }
  const llPresent = (id: string) => lifelineCenterX.has(id);

  // 3. Order messages by sequenceNumber for stable indexing.
  const allMessages: IRMessage[] = Object.values(model.messages ?? {})
    .filter((m) => {
      // Found/lost messages only have ONE real lifeline endpoint.
      if (m.isFound) return llPresent(m.targetLifelineId);
      if (m.isLost)  return llPresent(m.sourceLifelineId);
      // A gate-attached end resolves through gateEdgeX instead of a lifeline.
      const srcOk = m.sourceGateId ? gateEdgeX.has(m.sourceGateId) : llPresent(m.sourceLifelineId);
      const tgtOk = m.targetGateId ? gateEdgeX.has(m.targetGateId) : llPresent(m.targetLifelineId);
      return srcOk && tgtOk;
    })
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // Variable slot layout (P4): widen bands that open fragments so headers don't
  // compress. Shared by every Y derivation below and by the drag/insert inverses.
  const slotLayout = computeSlotLayoutFor(
    allMessages,
    Object.values(model.interactionFragments ?? {}),
  );

  const timelineLength = computeTimelineLength(allMessages.length, slotLayout);

  // 3b. Build a lookup from messageId → 1-based slot (used by activations,
  //     fragments, state invariants and the create/destroy geometry below).
  const messageIndex = new Map<string, number>();
  allMessages.forEach((m, i) => messageIndex.set(m.id, i + 1));

  // 3c. Create/Destroy events (UML 2.5 §17.4): map each target lifeline to the
  //     slot of the CREATE message that births it / the DESTROY message that
  //     terminates it. The earliest such message wins.
  const createSlotByLifeline = new Map<string, number>();
  const destroySlotByLifeline = new Map<string, number>();
  for (const m of allMessages) {
    const slot = messageIndex.get(m.id)!;
    if (m.messageKind === 'CREATE' && m.sourceLifelineId !== m.targetLifelineId) {
      const prev = createSlotByLifeline.get(m.targetLifelineId);
      if (prev === undefined || slot < prev) createSlotByLifeline.set(m.targetLifelineId, slot);
    } else if (m.messageKind === 'DESTROY') {
      const prev = destroySlotByLifeline.get(m.targetLifelineId);
      if (prev === undefined || slot < prev) destroySlotByLifeline.set(m.targetLifelineId, slot);
    }
  }
  const normalBottomY = LIFELINE_HEAD_H + timelineLength;

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

    // Create/Destroy geometry: a created lifeline's head drops to the create
    // message's Y; a destroyed lifeline's timeline ends at the destroy Y.
    const createSlot = createSlotByLifeline.get(viewNode.elementId);
    const destroySlot = destroySlotByLifeline.get(viewNode.elementId);
    const headTopOffset = createSlot !== undefined
      ? Math.max(0, messageYForIndex(createSlot, slotLayout) - LIFELINE_HEAD_H / 2)
      : 0;
    const headBottomY = headTopOffset + LIFELINE_HEAD_H;
    const endY = destroySlot !== undefined ? messageYForIndex(destroySlot, slotLayout) : normalBottomY;
    const llTimelineLength = Math.max(MESSAGE_BAND_H * 0.5, endY - headBottomY);

    const viewModel: LifelineViewModel = {
      __brand: 'lifeline',
      id: viewNode.id,
      domainId: viewNode.elementId,
      name: displayName,
      participantKind: participantKindFromIR(ll.participantKind),
      isExternal: ll.isExternal,
      timelineLength: llTimelineLength,
      headWidth: LIFELINE_HEAD_W,
      headHeight: LIFELINE_HEAD_H,
      headTopOffset,
      isDestroyed: destroySlot !== undefined,
      decomposedRef: ll.decomposedAs ? (ll.decomposedName || 'ref') : undefined,
      decomposedDiagramId: ll.decomposedAs,
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
    const autoTopY = messageYForIndex(startIdx, slotLayout);
    const autoBottomY = endIdx
      ? messageYForIndex(endIdx, slotLayout)
      : autoTopY + MESSAGE_BAND_H + ACTIVATION_END_PAD;
    const autoHeight = Math.max(MESSAGE_BAND_H * 0.6, autoBottomY - autoTopY);

    // Hybrid layout: a manual override wins over the message-derived geometry.
    const isManual = act.manualTopY !== undefined || act.manualHeight !== undefined;
    const topY = act.manualTopY ?? autoTopY;
    const height = Math.max(
      MESSAGE_BAND_H * 0.4,
      act.manualHeight ?? autoHeight,
    );
    const centerX = lifelineCenterX.get(act.lifelineId) ?? 0;

    const viewModel: ActivationViewModel = {
      __brand: 'activation',
      id: act.id,
      domainId: act.id,
      width: ACTIVATION_W,
      height,
      isOpen: !act.endMessageId,
      nestingDepth: nestingDepthFor(act),
      isManual,
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
    const isFound = !!msg.isFound;
    const isLost = !!msg.isLost;
    const hasGate = !!msg.sourceGateId || !!msg.targetGateId;
    // A gate-attached end resolves to the gate's boundary X; otherwise the lifeline.
    const srcX = msg.sourceGateId
      ? gateEdgeX.get(msg.sourceGateId) ?? 0
      : lifelineCenterX.get(msg.sourceLifelineId) ?? 0;
    const tgtX = msg.targetGateId
      ? gateEdgeX.get(msg.targetGateId) ?? 0
      : lifelineCenterX.get(msg.targetLifelineId) ?? srcX;
    // Found/lost/gate messages are never self-loops.
    const isSelf =
      !isFound && !isLost && !hasGate && msg.sourceLifelineId === msg.targetLifelineId;
    // Hybrid layout (B2): a manual override pins the glyph Y; otherwise it sits on
    // the computed slot. Ordering/numbering still come from `sequenceNumber`.
    const isManualY = msg.manualY !== undefined;
    const y = msg.manualY ?? messageYForIndex(idx + 1, slotLayout);

    let posX: number;
    let length: number;
    if (isFound) {
      // Dot to the LEFT of the target; arrow points right into the lifeline.
      const realX = lifelineCenterX.get(msg.targetLifelineId) ?? 0;
      posX = realX - FOUND_LOST_OFFSET;
      length = FOUND_LOST_OFFSET;
    } else if (isLost) {
      // Arrow from the source lifeline to a dot on the RIGHT.
      const realX = lifelineCenterX.get(msg.sourceLifelineId) ?? 0;
      posX = realX;
      length = FOUND_LOST_OFFSET;
    } else {
      posX = srcX;
      length = isSelf ? 0 : tgtX - srcX;
      // CREATE arrows stop at the target head's near edge (the head is centred
      // on this same Y), so they visually "create" the box rather than cross it.
      if (msg.messageKind === 'CREATE') {
        const half = LIFELINE_HEAD_W / 2;
        length = tgtX > srcX ? (tgtX - half) - srcX : (tgtX + half) - srcX;
      }
    }

    const viewModel: MessageViewModel = {
      __brand: 'message',
      id: msg.id,
      domainId: msg.id,
      name: msg.name || '',
      messageKind: msg.messageKind,
      sequenceNumber: msg.sequenceNumber,
      displayNumber: hierarchicalNumbers.get(msg.id) ?? `${msg.sequenceNumber}`,
      length,
      isSelfMessage: isSelf,
      isFound,
      isLost,
      guard: msg.guard,
      isManualY,
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
      position: { x: posX, y },
      data: viewModel,
      domainId: msg.id,
    };
  });

  // 5b. Emit State Invariants (UML 2.5 §17.4) — small state symbols centred on
  //     the lifeline at a Y derived from their temporal anchor. Pure derivations
  //     of the IR (no ViewNode), like messages and activations.
  const stateInvariantNodes = Object.values(model.stateInvariants ?? {})
    .filter((si) => lifelineCenterX.has(si.lifelineId))
    .map((si: IRStateInvariant) => {
      const centerX = lifelineCenterX.get(si.lifelineId)!;
      const slot = Math.max(0, Math.min(allMessages.length, si.afterSequenceNumber));
      const cy = stateInvariantSlotY(slot, slotLayout);
      const width = estimateStateInvariantWidth(si.constraint);
      const height = STATE_INVARIANT_H;

      const viewModel: StateInvariantViewModel = {
        __brand: 'stateInvariant',
        id: si.id,
        domainId: si.id,
        constraint: si.constraint,
        width,
        height,
        afterSequenceNumber: slot,
        totalMessages: allMessages.length,
      };

      return {
        id: `si-${si.id}`,
        type: 'umlStateInvariant',
        position: { x: centerX - width / 2, y: cy - height / 2 },
        data: viewModel,
        domainId: si.id,
      };
    });

  // 5c. Emit Gates (UML 2.5 §17.4) — small squares straddling the owner
  //     fragment's boundary at the gate's temporal slot.
  const gateNodes = Object.values(model.gates ?? {})
    .filter((g: IRGate) => gateEdgeX.has(g.id))
    .map((g: IRGate) => {
      const edgeX = gateEdgeX.get(g.id)!;
      const slot = Math.max(0, Math.min(allMessages.length, g.afterSequenceNumber));
      const cy = stateInvariantSlotY(slot, slotLayout);

      const viewModel: GateViewModel = {
        __brand: 'gate',
        id: g.id,
        domainId: g.id,
        name: g.name || '',
        side: g.side,
        size: GATE_SIZE,
        afterSequenceNumber: slot,
        totalMessages: allMessages.length,
      };

      return {
        id: `gate-${g.id}`,
        type: 'umlGate',
        position: { x: edgeX - GATE_SIZE / 2, y: cy - GATE_SIZE / 2 },
        data: viewModel,
        domainId: g.id,
      };
    });

  // 5d. Emit General Orderings (UML 2.5 §17.2) — a dotted arrow forcing a
  //     temporal order between two message occurrences. Position is fully
  //     derived from the two anchored messages (no slot anchor of its own).
  const messageById = new Map(allMessages.map((m) => [m.id, m]));
  const occurrencePoint = (
    messageId: string,
    end: 'SEND' | 'RECEIVE',
  ): { x: number; y: number } | null => {
    const msg = messageById.get(messageId);
    if (!msg) return null;
    const slot = messageIndex.get(messageId);
    if (slot === undefined) return null;
    const y = msg.manualY ?? messageYForIndex(slot, slotLayout);
    const lifelineId = end === 'SEND' ? msg.sourceLifelineId : msg.targetLifelineId;
    const x = lifelineCenterX.get(lifelineId);
    if (x === undefined) return null;
    return { x, y };
  };

  const generalOrderingNodes = Object.values(model.generalOrderings ?? {})
    .map((go) => {
      const from = occurrencePoint(go.beforeMessageId, go.beforeEnd);
      const to = occurrencePoint(go.afterMessageId, go.afterEnd);
      if (!from || !to) return null;

      const minX = Math.min(from.x, to.x);
      const minY = Math.min(from.y, to.y);
      const width = Math.abs(to.x - from.x);
      const height = Math.abs(to.y - from.y);

      const viewModel: GeneralOrderingViewModel = {
        __brand: 'generalOrdering',
        id: go.id,
        domainId: go.id,
        from: { x: from.x - minX, y: from.y - minY },
        to: { x: to.x - minX, y: to.y - minY },
        width,
        height,
      };

      return {
        id: `go-${go.id}`,
        type: 'umlGeneralOrdering',
        position: { x: minX, y: minY },
        data: viewModel,
        domainId: go.id,
      };
    })
    .filter(<T>(n: T | null): n is T => n !== null);

  // 5e. Emit Time / Duration Constraints (UML 2.5 §17.2). A TIME constraint is a
  //     label at one occurrence; a DURATION constraint is a vertical bracket
  //     between two occurrences with a label. Geometry is fully derived; the
  //     bracket/label sits just right of the anchoring lifeline.
  const DURATION_X_OFFSET = 24;
  const TC_LABEL_CHAR_W = 6;
  const TC_LABEL_PAD = 20;
  const tcLabelWidth = (expr: string) => (expr.length + 2) * TC_LABEL_CHAR_W + TC_LABEL_PAD;

  const timeConstraintNodes = Object.values(model.timeConstraints ?? {})
    .map((tc) => {
      const fromP = occurrencePoint(tc.fromMessageId, tc.fromEnd);
      if (!fromP) return null;

      if (tc.constraintKind === 'DURATION') {
        if (!tc.toMessageId || !tc.toEnd) return null;
        const toP = occurrencePoint(tc.toMessageId, tc.toEnd);
        if (!toP) return null;
        const bracketX = fromP.x + DURATION_X_OFFSET;
        const minY = Math.min(fromP.y, toP.y);
        const viewModel: TimeConstraintViewModel = {
          __brand: 'timeConstraint',
          id: tc.id,
          domainId: tc.id,
          constraintKind: 'DURATION',
          expression: tc.expression,
          from: { x: 0, y: fromP.y - minY },
          to: { x: 0, y: toP.y - minY },
          width: tcLabelWidth(tc.expression),
          height: Math.abs(toP.y - fromP.y),
        };
        return {
          id: `tc-${tc.id}`,
          type: 'umlTimeConstraint',
          position: { x: bracketX, y: minY },
          data: viewModel,
          domainId: tc.id,
        };
      }

      // TIME: single-occurrence label with a small tick.
      const viewModel: TimeConstraintViewModel = {
        __brand: 'timeConstraint',
        id: tc.id,
        domainId: tc.id,
        constraintKind: 'TIME',
        expression: tc.expression,
        from: { x: 0, y: 0 },
        width: tcLabelWidth(tc.expression),
        height: 16,
      };
      return {
        id: `tc-${tc.id}`,
        type: 'umlTimeConstraint',
        position: { x: fromP.x, y: fromP.y },
        data: viewModel,
        domainId: tc.id,
      };
    })
    .filter(<T>(n: T | null): n is T => n !== null);

  // 5f. Emit Coregions (UML 2.5 §17.4) — square brackets `[ ]` over a vertical
  //     span of ONE lifeline marking an unordered region. Slot-anchored like
  //     state invariants; fully derived geometry (not draggable).
  const COREGION_W = 18;
  const COREGION_MIN_H = MESSAGE_BAND_H * 0.7;
  const coregionNodes = Object.values(model.coregions ?? {})
    .filter((cr) => lifelineCenterX.has(cr.lifelineId))
    .map((cr) => {
      const centerX = lifelineCenterX.get(cr.lifelineId)!;
      const lo = Math.max(0, Math.min(allMessages.length, Math.min(cr.fromSequence, cr.toSequence)));
      const hi = Math.max(0, Math.min(allMessages.length, Math.max(cr.fromSequence, cr.toSequence)));
      const topY = stateInvariantSlotY(lo, slotLayout);
      const rawBottomY = stateInvariantSlotY(hi, slotLayout);
      const height = Math.max(COREGION_MIN_H, rawBottomY - topY);

      const viewModel: CoregionViewModel = {
        __brand: 'coregion',
        id: cr.id,
        domainId: cr.id,
        width: COREGION_W,
        height,
      };

      return {
        id: `cr-${cr.id}`,
        type: 'umlCoregion',
        position: { x: centerX - COREGION_W / 2, y: topY },
        data: viewModel,
        domainId: cr.id,
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
    slotLayout,
  );

  // 8. Emit Interaction Uses (`ref`). Rendered with fragments at the back.
  const interactionUseNodes = buildInteractionUseNodes(
    Object.values(model.interactionUses ?? {}),
    lifelineCenterX,
    allMessages.length,
    slotLayout,
  );

  // 8b. Emit Continuations (UML 2.5 §17.3) — named stadium boxes spanning the
  //     covered lifelines at a temporal slot. Slot-anchored & draggable like refs.
  const continuationNodes = buildContinuationNodes(
    Object.values(model.continuations ?? {}),
    lifelineCenterX,
    allMessages.length,
    slotLayout,
  );

  return [
    ...fragmentNodes,
    ...interactionUseNodes,
    ...lifelineNodes,
    ...coregionNodes,
    ...activationNodes,
    ...messageNodes,
    ...stateInvariantNodes,
    ...gateNodes,
    ...generalOrderingNodes,
    ...timeConstraintNodes,
    ...continuationNodes,
    ...noteNodes,
  ];
}

// ─── Fragment geometry ────────────────────────────────────────────────────────

function buildFragmentNodes(
  fragments: IRInteractionFragment[],
  _lifelineViewNodes: ViewNode[],
  lifelineCenterX: Map<string, number>,
  messageIndex: Map<string, number>,
  totalMessages: number,
  slotLayout?: SlotLayout,
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
      // Horizontal bounds shared with gate placement (keeps edges aligned).
      const bounds = fragmentHorizontalBounds(frag.coveredLifelineIds, lifelineCenterX);
      if (!bounds) return null;
      const { left, right } = bounds;
      const width = right - left;

      // Y bounds: derived from the messages contained in any operand.
      const allMsgIds = frag.operands.flatMap((op) => op.messageIds);
      const messageYs = allMsgIds
        .map((mid) => messageIndex.get(mid))
        .filter((idx): idx is number => idx !== undefined)
        .map((idx) => messageYForIndex(idx, slotLayout));

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

// ─── Interaction Use (`ref`) geometry ──────────────────────────────────────────

function buildInteractionUseNodes(
  uses: IRInteractionUse[],
  lifelineCenterX: Map<string, number>,
  totalMessages: number,
  slotLayout?: SlotLayout,
) {
  return uses
    .map((use) => {
      const liveIds = use.coveredLifelineIds.filter((id) => lifelineCenterX.has(id));
      if (liveIds.length === 0) return null;

      const xs = liveIds.map((id) => lifelineCenterX.get(id)!).sort((a, b) => a - b);
      const left = xs[0] - FRAGMENT_X_PAD;
      const right = xs[xs.length - 1] + FRAGMENT_X_PAD;
      const width = Math.max(FRAGMENT_MIN_W, right - left);

      const slot = Math.max(0, Math.min(totalMessages, use.afterSequenceNumber));
      const top = stateInvariantSlotY(slot, slotLayout);

      const viewModel: InteractionUseViewModel = {
        __brand: 'interactionUse',
        id: use.id,
        domainId: use.id,
        label: use.referencedName || use.name || 'ref',
        width,
        height: INTERACTION_USE_H,
        afterSequenceNumber: slot,
        totalMessages,
      };

      return {
        id: `iu-${use.id}`,
        type: 'umlInteractionUse',
        position: { x: left, y: top },
        data: viewModel,
        domainId: use.id,
      };
    })
    .filter(<T>(n: T | null): n is T => n !== null);
}

// ─── Continuation geometry ──────────────────────────────────────────────────────

const CONTINUATION_H = 28;

function buildContinuationNodes(
  continuations: IRContinuation[],
  lifelineCenterX: Map<string, number>,
  totalMessages: number,
  slotLayout?: SlotLayout,
) {
  return continuations
    .map((cont) => {
      const liveIds = cont.coveredLifelineIds.filter((id) => lifelineCenterX.has(id));
      if (liveIds.length === 0) return null;

      const xs = liveIds.map((id) => lifelineCenterX.get(id)!).sort((a, b) => a - b);
      const left = xs[0] - FRAGMENT_X_PAD;
      const right = xs[xs.length - 1] + FRAGMENT_X_PAD;
      const width = Math.max(FRAGMENT_MIN_W, right - left);

      const slot = Math.max(0, Math.min(totalMessages, cont.afterSequenceNumber));
      const cy = stateInvariantSlotY(slot, slotLayout);

      const viewModel: ContinuationViewModel = {
        __brand: 'continuation',
        id: cont.id,
        domainId: cont.id,
        label: cont.name || 'continuation',
        width,
        height: CONTINUATION_H,
        afterSequenceNumber: slot,
        totalMessages,
      };

      return {
        id: `cont-${cont.id}`,
        type: 'umlContinuation',
        position: { x: left, y: cy - CONTINUATION_H / 2 },
        data: viewModel,
        domainId: cont.id,
      };
    })
    .filter(<T>(n: T | null): n is T => n !== null);
}

/**
 * Convert a canvas Y coordinate (from a MessageShape drag) to a 1-based
 * slot index, clamped within [1, totalMessages].
 *
 * Inverse of `messageYForIndex`.
 */
export function yToMessageSlot(y: number, totalMessages: number, layout?: SlotLayout): number {
  const localY = y - LIFELINE_HEAD_H - TIMELINE_TOP_PAD;
  if (!layout) {
    const raw = localY / MESSAGE_BAND_H + 0.5;
    return Math.max(1, Math.min(totalMessages, Math.round(raw)));
  }
  // Nearest band centre over [1, totalMessages]; totalMessages may be count + 1
  // for insertion (the extra slot extrapolates below the last message).
  let best = 1;
  let bestDist = Infinity;
  for (let i = 1; i <= totalMessages; i++) {
    const d = Math.abs(localY - slotCenterOffset(i, layout));
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

/**
 * Convert a canvas Y coordinate (from a StateInvariant / Gate / InteractionUse
 * drag) to a 0-based slot index, clamped within [0, totalMessages].
 *
 * Inverse of `stateInvariantSlotY`.
 */
export function yToInvariantSlot(y: number, totalMessages: number, layout?: SlotLayout): number {
  const localY = y - LIFELINE_HEAD_H - TIMELINE_TOP_PAD;
  if (!layout) {
    const raw = localY / MESSAGE_BAND_H;
    return Math.max(0, Math.min(totalMessages, Math.round(raw)));
  }
  // Nearest message boundary over [0, totalMessages].
  let best = 0;
  let bestDist = Infinity;
  for (let s = 0; s <= totalMessages; s++) {
    const d = Math.abs(localY - boundaryOffset(s, layout));
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
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
