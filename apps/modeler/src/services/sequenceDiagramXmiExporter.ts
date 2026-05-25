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
  MessageKind,
  FragmentKind,
} from '../core/domain/vfs/vfs.types';
import { esc, xmiId, xmiHeader, xmiFooter, downloadXml } from './xmi/xmiHelpers';

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
  return `    <lifeline xmi:id="${xmiId(ll.id)}" name="${esc(name)}"${represents}/>`;
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
  const attrs = [
    `xmi:type="uml:Message"`,
    `xmi:id="${xmiId(msg.id)}"`,
    `name="${esc(msg.name || '')}"`,
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
): string {
  const covered = frag.coveredLifelineIds.filter(coveredInScope).map(xmiId).join(' ');
  const open = `    <fragment xmi:type="uml:CombinedFragment" xmi:id="${xmiId(frag.id)}" interactionOperator="${interactionOperator(frag.fragmentKind)}"${covered ? ` covered="${covered}"` : ''}>`;
  const lines: string[] = [open];

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

  const lines: string[] = xmiHeader(model.id, diagramName);
  lines.push(
    `  <packagedElement xmi:type="uml:Interaction" xmi:id="interaction_${xmiId(model.id)}" name="${esc(diagramName)}">`,
  );

  // Lifelines first.
  for (const ll of lifelines) lines.push(serializeLifeline(ll));

  // Occurrence-spec fragments for message ends, in chronological order.
  const messageElements: string[] = [];
  for (const msg of messages) {
    const { sendEvent, receiveEvent, occurrences } = messageEnds(msg);
    lines.push(...occurrences);
    messageElements.push(serializeMessage(msg, sendEvent, receiveEvent));
  }

  // Combined fragments (with their gates + operands).
  for (const frag of fragments) {
    lines.push(serializeCombinedFragment(frag, gatesByFragment.get(frag.id) ?? [], (id) => lifelineIds.has(id)));
  }

  // State invariants + interaction uses.
  for (const si of stateInvariants) lines.push(serializeStateInvariant(si));
  for (const use of interactionUses) lines.push(serializeInteractionUse(use, (id) => lifelineIds.has(id)));

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
