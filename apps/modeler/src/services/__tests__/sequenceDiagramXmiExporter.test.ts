import { describe, it, expect } from 'vitest';
import { buildSequenceDiagramXmi } from '../sequenceDiagramXmiExporter';
import type {
  SemanticModel,
  IRLifeline,
  IRMessage,
  IRInteractionFragment,
  IRStateInvariant,
  IRInteractionUse,
  IRGate,
} from '../../core/domain/vfs/vfs.types';

function makeModel(overrides: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'model-1',
    name: 'Test',
    version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activityNodes: {}, objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, relations: {},
    createdAt: 0, updatedAt: 0,
    ...overrides,
  } as SemanticModel;
}

const ll = (id: string, partial: Partial<IRLifeline> = {}): IRLifeline => ({
  id, kind: 'LIFELINE', name: id, participantKind: 'ANONYMOUS', alias: id, ...partial,
});

describe('buildSequenceDiagramXmi', () => {
  it('wraps everything in a uml:Interaction with lifelines', () => {
    const model = makeModel({ lifelines: { a: ll('a'), b: ll('b') } });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('xmi:type="uml:Interaction"');
    expect(xmi).toContain('name="Seq"');
    expect((xmi.match(/<lifeline /g) ?? []).length).toBe(2);
    // Well-formed XML (no parser error in jsdom).
    const doc = new DOMParser().parseFromString(xmi, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
  });

  it('maps message kinds to UML messageSort and emits occurrence specs', () => {
    const sync: IRMessage = {
      id: 'm1', kind: 'MESSAGE', name: 'op', messageKind: 'SYNC',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 1,
    };
    const model = makeModel({ lifelines: { a: ll('a'), b: ll('b') }, messages: { m1: sync } });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('xmi:type="uml:Message"');
    expect(xmi).toContain('messageSort="synchCall"');
    expect(xmi).toContain('messageKind="complete"');
    expect(xmi).toContain('uml:MessageOccurrenceSpecification');
    expect(xmi).toContain('sendEvent="m1_send"');
    expect(xmi).toContain('receiveEvent="m1_recv"');
  });

  it('serializes a found message without a sendEvent', () => {
    const found: IRMessage = {
      id: 'f1', kind: 'MESSAGE', name: '', messageKind: 'ASYNC',
      sourceLifelineId: '', targetLifelineId: 'a', sequenceNumber: 1, isFound: true,
    };
    const model = makeModel({ lifelines: { a: ll('a') }, messages: { f1: found } });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('messageKind="found"');
    expect(xmi).not.toContain('sendEvent=');
    expect(xmi).toContain('receiveEvent="f1_recv"');
  });

  it('serializes a combined fragment with operator, guard and its gate', () => {
    const frag: IRInteractionFragment = {
      id: 'fr1', kind: 'FRAGMENT', name: 'alt', fragmentKind: 'ALT',
      coveredLifelineIds: ['a', 'b'],
      operands: [{ id: 'op1', guard: 'x>0', messageIds: [], fragmentIds: [] }],
    };
    const gate: IRGate = { id: 'g1', kind: 'GATE', name: 'in', ownerFragmentId: 'fr1', side: 'LEFT', afterSequenceNumber: 0 };
    const model = makeModel({
      lifelines: { a: ll('a'), b: ll('b') },
      interactionFragments: { fr1: frag },
      gates: { g1: gate },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('xmi:type="uml:CombinedFragment"');
    expect(xmi).toContain('interactionOperator="alt"');
    expect(xmi).toContain('uml:InteractionOperand');
    expect(xmi).toContain('<body>x&gt;0</body>');
    expect(xmi).toContain('<cfragmentGate xmi:id="g1" name="in"/>');
  });

  it('serializes state invariants and interaction uses', () => {
    const si: IRStateInvariant = {
      id: 's1', kind: 'STATE_INVARIANT', name: 'ready', lifelineId: 'a', constraint: 'ready', afterSequenceNumber: 0,
    };
    const use: IRInteractionUse = {
      id: 'u1', kind: 'INTERACTION_USE', name: 'Login', coveredLifelineIds: ['a'],
      referencedDiagramId: 'diag-2', referencedName: 'Login', afterSequenceNumber: 0,
    };
    const model = makeModel({
      lifelines: { a: ll('a') },
      stateInvariants: { s1: si },
      interactionUses: { u1: use },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('xmi:type="uml:StateInvariant"');
    expect(xmi).toContain('<body>ready</body>');
    expect(xmi).toContain('xmi:type="uml:InteractionUse"');
    expect(xmi).toContain('refersTo="diag-2"');
  });

  it('excludes lifelines absent from the diagram view', () => {
    const model = makeModel({ lifelines: { a: ll('a'), b: ll('b') } });
    const view = { diagramId: 'd', nodes: [{ id: 'vn1', elementId: 'a', x: 0, y: 0 }], edges: [] };
    const xmi = buildSequenceDiagramXmi(model, view, 'Seq');
    expect((xmi.match(/<lifeline /g) ?? []).length).toBe(1);
    expect(xmi).toContain('xmi:id="a"');
    expect(xmi).not.toContain('xmi:id="b"');
  });
});
