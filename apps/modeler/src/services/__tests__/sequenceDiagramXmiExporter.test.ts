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

  it('serializes IGNORE/CONSIDER as a ConsiderIgnoreFragment with message refs + set comment', () => {
    const login: IRMessage = {
      id: 'mlogin', kind: 'MESSAGE', name: 'login', messageKind: 'SYNC',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 1,
    };
    const frag: IRInteractionFragment = {
      id: 'fr2', kind: 'FRAGMENT', name: 'ignore', fragmentKind: 'IGNORE',
      coveredLifelineIds: ['a', 'b'],
      operands: [{ id: 'op1', messageIds: [], fragmentIds: [] }],
      messageSet: ['login', 'logout'],
    };
    const model = makeModel({
      lifelines: { a: ll('a'), b: ll('b') },
      messages: { mlogin: login },
      interactionFragments: { fr2: frag },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('xmi:type="uml:ConsiderIgnoreFragment"');
    expect(xmi).toContain('interactionOperator="ignore"');
    // 'login' resolves to the message id; 'logout' has no message → not referenced.
    expect(xmi).toContain('message="mlogin"');
    // The literal set is preserved as a comment for round-trip fidelity.
    expect(xmi).toContain('<body>{login, logout}</body>');
    // Well-formed XML.
    const doc = new DOMParser().parseFromString(xmi, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
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

  it('folds a per-message guard into the message name (C8)', () => {
    const guarded: IRMessage = {
      id: 'm1', kind: 'MESSAGE', name: 'pay', messageKind: 'SYNC', guard: 'amount>0',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 1,
    };
    const noName: IRMessage = {
      id: 'm2', kind: 'MESSAGE', name: '', messageKind: 'ASYNC', guard: 'ok',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 2,
    };
    const model = makeModel({
      lifelines: { a: ll('a'), b: ll('b') },
      messages: { m1: guarded, m2: noName },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('name="[amount&gt;0] pay"');
    expect(xmi).toContain('name="[ok]"');
  });

  it('serializes continuations and coregions (C3/C4)', () => {
    const model = makeModel({
      lifelines: { a: ll('a'), b: ll('b') },
      continuations: {
        c1: { id: 'c1', kind: 'CONTINUATION', name: 'Retry', coveredLifelineIds: ['a', 'b'], afterSequenceNumber: 1 },
      },
      coregions: {
        co1: { id: 'co1', kind: 'COREGION', name: '', lifelineId: 'a', fromSequence: 0, toSequence: 2 },
      },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('xmi:type="uml:Continuation"');
    expect(xmi).toContain('name="Retry"');
    // Coregion → single-lifeline par CombinedFragment.
    expect(xmi).toContain('xmi:id="co1" interactionOperator="par" covered="a"');
  });

  it('serializes a decomposed lifeline as a PartDecomposition (C5)', () => {
    const model = makeModel({
      lifelines: { a: ll('a', { decomposedAs: 'sub-diag', decomposedName: 'Inner' }), b: ll('b') },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('decomposedAs="decomp_a"');
    expect(xmi).toContain('xmi:type="uml:PartDecomposition"');
    expect(xmi).toContain('refersTo="sub-diag"');
    expect(xmi).toContain('name="Inner"');
  });

  it('serializes general orderings between occurrence ends (C6)', () => {
    const m1: IRMessage = {
      id: 'm1', kind: 'MESSAGE', name: 'a', messageKind: 'SYNC',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 1,
    };
    const m2: IRMessage = {
      id: 'm2', kind: 'MESSAGE', name: 'b', messageKind: 'SYNC',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 2,
    };
    const model = makeModel({
      lifelines: { a: ll('a'), b: ll('b') },
      messages: { m1, m2 },
      generalOrderings: {
        g1: { id: 'g1', kind: 'GENERAL_ORDERING', name: '', beforeMessageId: 'm1', beforeEnd: 'RECEIVE', afterMessageId: 'm2', afterEnd: 'SEND' },
      },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('xmi:type="uml:GeneralOrdering"');
    expect(xmi).toContain('before="m1_recv"');
    expect(xmi).toContain('after="m2_send"');
  });

  it('skips a general ordering whose message is absent', () => {
    const m1: IRMessage = {
      id: 'm1', kind: 'MESSAGE', name: 'a', messageKind: 'SYNC',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 1,
    };
    const model = makeModel({
      lifelines: { a: ll('a'), b: ll('b') },
      messages: { m1 },
      generalOrderings: {
        g1: { id: 'g1', kind: 'GENERAL_ORDERING', name: '', beforeMessageId: 'm1', beforeEnd: 'RECEIVE', afterMessageId: 'gone', afterEnd: 'SEND' },
      },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).not.toContain('uml:GeneralOrdering');
  });

  it('serializes duration and time constraints (C1/C2)', () => {
    const m1: IRMessage = {
      id: 'm1', kind: 'MESSAGE', name: 'a', messageKind: 'SYNC',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 1,
    };
    const m2: IRMessage = {
      id: 'm2', kind: 'MESSAGE', name: 'b', messageKind: 'SYNC',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 2,
    };
    const model = makeModel({
      lifelines: { a: ll('a'), b: ll('b') },
      messages: { m1, m2 },
      timeConstraints: {
        d1: { id: 'd1', kind: 'TIME_CONSTRAINT', name: '', constraintKind: 'DURATION', fromMessageId: 'm1', fromEnd: 'SEND', toMessageId: 'm2', toEnd: 'RECEIVE', expression: '0..3s' },
        t1: { id: 't1', kind: 'TIME_CONSTRAINT', name: '', constraintKind: 'TIME', fromMessageId: 'm1', fromEnd: 'SEND', expression: 't=now' },
      },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).toContain('xmi:type="uml:DurationConstraint"');
    expect(xmi).toContain('constrainedElement="m1_send m2_recv"');
    expect(xmi).toContain('<body>0..3s</body>');
    expect(xmi).toContain('xmi:type="uml:TimeConstraint"');
    expect(xmi).toContain('<body>t=now</body>');
  });

  it('skips a duration constraint missing its second anchor', () => {
    const m1: IRMessage = {
      id: 'm1', kind: 'MESSAGE', name: 'a', messageKind: 'SYNC',
      sourceLifelineId: 'a', targetLifelineId: 'b', sequenceNumber: 1,
    };
    const model = makeModel({
      lifelines: { a: ll('a'), b: ll('b') },
      messages: { m1 },
      timeConstraints: {
        d1: { id: 'd1', kind: 'TIME_CONSTRAINT', name: '', constraintKind: 'DURATION', fromMessageId: 'm1', fromEnd: 'SEND', expression: '0..3s' },
      },
    });
    const xmi = buildSequenceDiagramXmi(model, null, 'Seq');
    expect(xmi).not.toContain('uml:DurationConstraint');
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
