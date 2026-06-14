/**
 * Sequence Diagram XMI 2.1 / UML 2.5.1 exporter.
 *
 * Maps the diagram to a single `uml:Interaction` packagedElement containing:
 *  - uml:Lifeline (one per IRLifeline, `represents` → the represented classifier)
 *  - uml:Message (messageSort from MessageKind; found/lost via messageKind)
 *  - uml:MessageOccurrenceSpecification fragments for the message ends
 *  - uml:CombinedFragment (interactionOperator + guarded uml:InteractionOperand,
 *    with its gates serialized as cfragmentGate)
 *  - uml:StateInvariant fragments
 *  - uml:InteractionUse fragments (refersTo the referenced interaction)
 *  - uml:Continuation fragments (named jump points spanning lifelines, C3)
 *  - uml:Coregion → a single-lifeline `par` CombinedFragment (the standard
 *    UML 2.5 shorthand the `[ ]` notation abbreviates, C4)
 *  - uml:PartDecomposition fragments + Lifeline.decomposedAs (C5)
 *  - uml:GeneralOrdering edges between two message occurrences (C6)
 *  - uml:DurationConstraint / uml:TimeConstraint ownedRules over occurrences (C1/C2)
 *  - per-message guards folded into the message name as `[guard] name` (C8)
 *
 * Only elements whose lifelines are present in the DiagramView are exported.
 */

import type {
  SemanticModel,
  DiagramView,
  IRLifeline,
  IRMessage,
  IRInteractionFragment,
  IRStateInvariant,
  IRInteractionUse,
  IRGate,
  IRContinuation,
  IRCoregion,
  IRGeneralOrdering,
  IRTimeConstraint,
  MessageKind,
  FragmentKind,
} from '../core/domain/vfs/vfs.types';
import { esc, xmiId, xmiHeader, xmiFooter, downloadXml } from './xmi/xmiHelpers';

/** XMI id of a lifeline's PartDecomposition fragment (C5). */
function partDecompositionId(lifelineId: string): string {
  return `decomp_${xmiId(lifelineId)}`;
}

const MESSAGE_SORT: Record<MessageKind, string> = {
  SYNC: 'synchCall',
  ASYNC: 'asynchCall',
  REPLY: 'reply',
  CREATE: 'createMessage',
  DESTROY: 'deleteMessage',
};

function interactionOperator(kind: FragmentKind): string {
  return kind.toLowerCase();
}

// ─── Serializers ──────────────────────────────────────────────────────────────

function serializeLifeline(ll: IRLifeline): string {
  const name = ll.alias || ll.name || 'lifeline';
  const represents = ll.represents ? ` represents="${xmiId(ll.represents)}"` : '';
  // C5: a decomposed lifeline points at its PartDecomposition fragment.
  const decomposed = ll.decomposedAs ? ` decomposedAs="${partDecompositionId(ll.id)}"` : '';
  return `    <lifeline xmi:id="${xmiId(ll.id)}" name="${esc(name)}"${represents}${decomposed}/>`;
}

/** Message ends → ids of the occurrence specs (or gate ids) plus the MOS fragments to emit. */
function messageEnds(msg: IRMessage): {
  sendEvent?: string;
  receiveEvent?: string;
  occurrences: string[];
} {
  const occurrences: string[] = [];
  let sendEvent: string | undefined;
  let receiveEvent: string | undefined;

  // Send end: omitted for found messages; a gate id when gate-attached.
  if (!msg.isFound) {
    if (msg.sourceGateId) {
      sendEvent = xmiId(msg.sourceGateId);
    } else if (msg.sourceLifelineId) {
      sendEvent = `${xmiId(msg.id)}_send`;
      occurrences.push(
        `    <fragment xmi:type="uml:MessageOccurrenceSpecification" xmi:id="${sendEvent}" covered="${xmiId(msg.sourceLifelineId)}" message="${xmiId(msg.id)}"/>`,
      );
    }
  }

  // Receive end: omitted for lost messages; a gate id when gate-attached.
  if (!msg.isLost) {
    if (msg.targetGateId) {
      receiveEvent = xmiId(msg.targetGateId);
    } else if (msg.targetLifelineId) {
      receiveEvent = `${xmiId(msg.id)}_recv`;
      occurrences.push(
        `    <fragment xmi:type="uml:MessageOccurrenceSpecification" xmi:id="${receiveEvent}" covered="${xmiId(msg.targetLifelineId)}" message="${xmiId(msg.id)}"/>`,
      );
    }
  }

  return { sendEvent, receiveEvent, occurrences };
}

function serializeMessage(msg: IRMessage, sendEvent?: string, receiveEvent?: string): string {
  const messageKind = msg.isFound ? 'found' : msg.isLost ? 'lost' : 'complete';
  // C8: a per-message guard has no home on the UML Message metaclass, so we fold
  // it into the name as `[guard] name` — matching the on-canvas label so the
  // condition survives a round-trip into EA/StarUML.
  const guard = msg.guard?.trim();
  const baseName = msg.name || '';
  const name = guard ? `[${guard}]${baseName ? ` ${baseName}` : ''}` : baseName;
  const attrs = [
    `xmi:type="uml:Message"`,
    `xmi:id="${xmiId(msg.id)}"`,
    `name="${esc(name)}"`,
    `messageSort="${MESSAGE_SORT[msg.messageKind]}"`,
    `messageKind="${messageKind}"`,
    sendEvent ? `sendEvent="${sendEvent}"` : '',
    receiveEvent ? `receiveEvent="${receiveEvent}"` : '',
  ].filter(Boolean).join(' ');
  return `    <message ${attrs}/>`;
}

function serializeCombinedFragment(
  frag: IRInteractionFragment,
  gates: IRGate[],
  coveredInScope: (id: string) => boolean,
  messageIdByName?: Map<string, string>,
): string {
  const covered = frag.coveredLifelineIds.filter(coveredInScope).map(xmiId).join(' ');

  // UML 2.5: IGNORE/CONSIDER carry a message set → ConsiderIgnoreFragment.
  // `message` references the matching Messages by name; the literal set is also
  // kept as an ownedComment so it survives a round-trip even when a name doesn't
  // resolve to a message in this diagram.
  const isConsiderIgnore =
    (frag.fragmentKind === 'IGNORE' || frag.fragmentKind === 'CONSIDER') &&
    !!frag.messageSet?.length;
  const xmiType = isConsiderIgnore ? 'uml:ConsiderIgnoreFragment' : 'uml:CombinedFragment';
  const messageRefs = isConsiderIgnore
    ? (frag.messageSet ?? [])
        .map((name) => messageIdByName?.get(name))
        .filter((id): id is string => !!id)
    : [];

  const openAttrs = [
    `xmi:type="${xmiType}"`,
    `xmi:id="${xmiId(frag.id)}"`,
    `interactionOperator="${interactionOperator(frag.fragmentKind)}"`,
    covered ? `covered="${covered}"` : '',
    messageRefs.length ? `message="${messageRefs.join(' ')}"` : '',
  ].filter(Boolean).join(' ');
  const open = `    <fragment ${openAttrs}>`;
  const lines: string[] = [open];

  if (isConsiderIgnore) {
    lines.push(
      `      <ownedComment xmi:type="uml:Comment" xmi:id="${xmiId(frag.id)}_set">`,
      `        <body>{${esc((frag.messageSet ?? []).join(', '))}}</body>`,
      `      </ownedComment>`,
    );
  }

  for (const gate of gates) {
    lines.push(`      <cfragmentGate xmi:id="${xmiId(gate.id)}" name="${esc(gate.name || '')}"/>`);
  }

  for (const op of frag.operands) {
    if (op.guard && op.guard.trim()) {
      lines.push(
        `      <operand xmi:type="uml:InteractionOperand" xmi:id="${xmiId(op.id)}">`,
        `        <guard xmi:type="uml:InteractionConstraint" xmi:id="${xmiId(op.id)}_g">`,
        `          <specification xmi:type="uml:OpaqueExpression" xmi:id="${xmiId(op.id)}_spec">`,
        `            <body>${esc(op.guard)}</body>`,
        `          </specification>`,
        `        </guard>`,
        `      </operand>`,
      );
    } else {
      lines.push(`      <operand xmi:type="uml:InteractionOperand" xmi:id="${xmiId(op.id)}"/>`);
    }
  }

  lines.push(`    </fragment>`);
  return lines.join('\n');
}

function serializeStateInvariant(si: IRStateInvariant): string {
  return [
    `    <fragment xmi:type="uml:StateInvariant" xmi:id="${xmiId(si.id)}" covered="${xmiId(si.lifelineId)}">`,
    `      <invariant xmi:type="uml:Constraint" xmi:id="${xmiId(si.id)}_inv">`,
    `        <specification xmi:type="uml:OpaqueExpression" xmi:id="${xmiId(si.id)}_spec">`,
    `          <body>${esc(si.constraint || '')}</body>`,
    `        </specification>`,
    `      </invariant>`,
    `    </fragment>`,
  ].join('\n');
}

function serializeInteractionUse(use: IRInteractionUse, coveredInScope: (id: string) => boolean): string {
  const covered = use.coveredLifelineIds.filter(coveredInScope).map(xmiId).join(' ');
  const attrs = [
    `xmi:type="uml:InteractionUse"`,
    `xmi:id="${xmiId(use.id)}"`,
    `name="${esc(use.referencedName || use.name || 'ref')}"`,
    covered ? `covered="${covered}"` : '',
    use.referencedDiagramId ? `refersTo="${xmiId(use.referencedDiagramId)}"` : '',
  ].filter(Boolean).join(' ');
  return `    <fragment ${attrs}/>`;
}

/** C3: named continuation point spanning one or more lifelines. */
function serializeContinuation(cont: IRContinuation, coveredInScope: (id: string) => boolean): string {
  const covered = cont.coveredLifelineIds.filter(coveredInScope).map(xmiId).join(' ');
  const attrs = [
    `xmi:type="uml:Continuation"`,
    `xmi:id="${xmiId(cont.id)}"`,
    `name="${esc(cont.name || 'continuation')}"`,
    covered ? `covered="${covered}"` : '',
  ].filter(Boolean).join(' ');
  return `    <fragment ${attrs}/>`;
}

/**
 * C4: a coregion is the UML 2.5 shorthand for a `par` CombinedFragment covering
 * a single lifeline, so we serialize it as exactly that for round-trip fidelity.
 */
function serializeCoregion(co: IRCoregion): string {
  return [
    `    <fragment xmi:type="uml:CombinedFragment" xmi:id="${xmiId(co.id)}" interactionOperator="par" covered="${xmiId(co.lifelineId)}">`,
    `      <operand xmi:type="uml:InteractionOperand" xmi:id="${xmiId(co.id)}_op"/>`,
    `    </fragment>`,
  ].join('\n');
}

/** C5: the PartDecomposition fragment a decomposed lifeline refers to. */
function serializePartDecomposition(ll: IRLifeline): string {
  const name = ll.decomposedName || ll.alias || ll.name || 'decomposition';
  const refersTo = ll.decomposedAs ? ` refersTo="${xmiId(ll.decomposedAs)}"` : '';
  return `    <fragment xmi:type="uml:PartDecomposition" xmi:id="${partDecompositionId(ll.id)}" name="${esc(name)}"${refersTo}/>`;
}

/**
 * C6: a GeneralOrdering edge between two message occurrences. `before`/`after`
 * reference the occurrence-spec ids resolved from the message ends; callers pass
 * `undefined` when either occurrence is out of scope so the order is skipped.
 */
function serializeGeneralOrdering(go: IRGeneralOrdering, before: string, after: string): string {
  return `    <generalOrdering xmi:type="uml:GeneralOrdering" xmi:id="${xmiId(go.id)}" before="${before}" after="${after}"/>`;
}

/**
 * C1/C2: a timing constraint. DURATION → DurationConstraint over the two anchor
 * occurrences; TIME → TimeConstraint over the single anchor. The expression is
 * carried in an OpaqueExpression specification.
 */
function serializeTimeConstraint(tc: IRTimeConstraint, constrained: string[]): string {
  const umlType = tc.constraintKind === 'DURATION' ? 'uml:DurationConstraint' : 'uml:TimeConstraint';
  return [
    `    <ownedRule xmi:type="${umlType}" xmi:id="${xmiId(tc.id)}" constrainedElement="${constrained.join(' ')}">`,
    `      <specification xmi:type="uml:OpaqueExpression" xmi:id="${xmiId(tc.id)}_spec">`,
    `        <body>${esc(tc.expression || '')}</body>`,
    `      </specification>`,
    `    </ownedRule>`,
  ].join('\n');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildSequenceDiagramXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): string {
  // In-scope lifelines = those present in the diagram view (or all if no view).
  const viewLifelineIds = diagramView
    ? new Set(diagramView.nodes.map((vn) => vn.elementId).filter(Boolean))
    : null;
  const inScope = (id: string) => !id ? false : (!viewLifelineIds || viewLifelineIds.has(id));

  const lifelines = Object.values(model.lifelines ?? {}).filter((ll) => inScope(ll.id));
  const lifelineIds = new Set(lifelines.map((ll) => ll.id));

  // A message is in scope when each of its real-lifeline ends is in scope.
  const messages = Object.values(model.messages ?? {})
    .filter((m) => {
      const srcOk = m.isFound || m.sourceGateId ? true : lifelineIds.has(m.sourceLifelineId);
      const tgtOk = m.isLost || m.targetGateId ? true : lifelineIds.has(m.targetLifelineId);
      return srcOk && tgtOk;
    })
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const fragments = Object.values(model.interactionFragments ?? {}).filter((f) =>
    f.coveredLifelineIds.some((id) => lifelineIds.has(id)),
  );
  const fragmentIds = new Set(fragments.map((f) => f.id));
  const gatesByFragment = new Map<string, IRGate[]>();
  for (const gate of Object.values(model.gates ?? {})) {
    if (!fragmentIds.has(gate.ownerFragmentId)) continue;
    const list = gatesByFragment.get(gate.ownerFragmentId) ?? [];
    list.push(gate);
    gatesByFragment.set(gate.ownerFragmentId, list);
  }

  const stateInvariants = Object.values(model.stateInvariants ?? {}).filter((si) =>
    lifelineIds.has(si.lifelineId),
  );
  const interactionUses = Object.values(model.interactionUses ?? {}).filter((u) =>
    u.coveredLifelineIds.some((id) => lifelineIds.has(id)),
  );
  const continuations = Object.values(model.continuations ?? {}).filter((c) =>
    c.coveredLifelineIds.some((id) => lifelineIds.has(id)),
  );
  const coregions = Object.values(model.coregions ?? {}).filter((c) =>
    lifelineIds.has(c.lifelineId),
  );
  const decomposedLifelines = lifelines.filter((ll) => !!ll.decomposedAs);

  const lines: string[] = xmiHeader(model.id, diagramName);
  lines.push(
    `  <packagedElement xmi:type="uml:Interaction" xmi:id="interaction_${xmiId(model.id)}" name="${esc(diagramName)}">`,
  );

  // Lifelines first.
  for (const ll of lifelines) lines.push(serializeLifeline(ll));

  // Occurrence-spec fragments for message ends, in chronological order. The
  // ends map lets general orderings and timing constraints reference the exact
  // occurrence ids emitted here.
  const messageElements: string[] = [];
  const endsByMsg = new Map<string, { sendEvent?: string; receiveEvent?: string }>();
  for (const msg of messages) {
    const { sendEvent, receiveEvent, occurrences } = messageEnds(msg);
    endsByMsg.set(msg.id, { sendEvent, receiveEvent });
    lines.push(...occurrences);
    messageElements.push(serializeMessage(msg, sendEvent, receiveEvent));
  }

  /** Resolve a message-end to its occurrence-spec (or gate) id, when in scope. */
  const occRef = (messageId: string, end: 'SEND' | 'RECEIVE'): string | undefined => {
    const ends = endsByMsg.get(messageId);
    if (!ends) return undefined;
    return end === 'SEND' ? ends.sendEvent : ends.receiveEvent;
  };

  // Name → message id, for ConsiderIgnoreFragment.message references.
  const messageIdByName = new Map<string, string>();
  for (const msg of messages) {
    if (msg.name) messageIdByName.set(msg.name, xmiId(msg.id));
  }

  // Combined fragments (with their gates + operands).
  for (const frag of fragments) {
    lines.push(serializeCombinedFragment(frag, gatesByFragment.get(frag.id) ?? [], (id) => lifelineIds.has(id), messageIdByName));
  }

  // State invariants + interaction uses.
  for (const si of stateInvariants) lines.push(serializeStateInvariant(si));
  for (const use of interactionUses) lines.push(serializeInteractionUse(use, (id) => lifelineIds.has(id)));

  // Continuations, coregions and part-decompositions (more interaction fragments).
  for (const cont of continuations) lines.push(serializeContinuation(cont, (id) => lifelineIds.has(id)));
  for (const co of coregions) lines.push(serializeCoregion(co));
  for (const ll of decomposedLifelines) lines.push(serializePartDecomposition(ll));

  // General orderings — only when both occurrence ends are in scope.
  for (const go of Object.values(model.generalOrderings ?? {})) {
    const before = occRef(go.beforeMessageId, go.beforeEnd);
    const after = occRef(go.afterMessageId, go.afterEnd);
    if (before && after) lines.push(serializeGeneralOrdering(go, before, after));
  }

  // Timing constraints — DURATION needs both anchors, TIME only the first.
  for (const tc of Object.values(model.timeConstraints ?? {})) {
    const from = occRef(tc.fromMessageId, tc.fromEnd);
    if (!from) continue;
    if (tc.constraintKind === 'DURATION') {
      const to = tc.toMessageId ? occRef(tc.toMessageId, tc.toEnd ?? 'RECEIVE') : undefined;
      if (!to) continue;
      lines.push(serializeTimeConstraint(tc, [from, to]));
    } else {
      lines.push(serializeTimeConstraint(tc, [from]));
    }
  }

  // Messages last (they reference the occurrence specs above).
  lines.push(...messageElements);

  lines.push(`  </packagedElement>`);
  lines.push(...xmiFooter());

  return lines.join('\n');
}

export function downloadSequenceDiagramXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): void {
  downloadXml(buildSequenceDiagramXmi(model, diagramView, diagramName), diagramName);
}
