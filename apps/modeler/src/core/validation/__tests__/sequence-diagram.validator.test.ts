import { describe, it, expect } from 'vitest';
import { sequenceDiagramValidator } from '../sequence-diagram.validator';
import type { LifelineNode } from '../../domain/models/nodes/sequence-diagram.types';
import type { DomainNode } from '../../domain/models/nodes';
import type {
  SemanticModel,
  IRMessage,
  IRLifeline,
  IRClass,
  IRInteractionFragment,
} from '../../domain/vfs/vfs.types';

function makeLifeline(partial: Partial<LifelineNode> = {}): LifelineNode {
  return {
    id: 'll-1',
    type: 'LIFELINE',
    name: 'Test',
    participantKind: 'ANONYMOUS',
    alias: 'Test',
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('SequenceDiagramValidator.validateNode', () => {
  it('passes anonymous lifeline with alias', () => {
    const r = sequenceDiagramValidator.validateNode(makeLifeline());
    expect(r.isValid).toBe(true);
  });

  it('rejects anonymous lifeline without alias', () => {
    const r = sequenceDiagramValidator.validateNode(
      makeLifeline({ alias: '' }),
    );
    expect(r.isValid).toBe(false);
    expect(r.errors?.[0]).toMatch(/alias/i);
  });

  it('rejects typed lifeline without represents', () => {
    const r = sequenceDiagramValidator.validateNode(
      makeLifeline({ participantKind: 'CLASS', alias: undefined, represents: undefined }),
    );
    expect(r.isValid).toBe(false);
    expect(r.errors?.[0]).toMatch(/represents/);
  });

  it('passes typed lifeline with represents', () => {
    const r = sequenceDiagramValidator.validateNode(
      makeLifeline({ participantKind: 'CLASS', represents: 'cls-1' }),
    );
    expect(r.isValid).toBe(true);
  });
});

describe('SequenceDiagramValidator.validateConnection', () => {
  const ll1 = makeLifeline({ id: 'll1' });
  const ll2 = makeLifeline({ id: 'll2' });
  const fakeOther = { id: 'x', type: 'NOTE', createdAt: 0, updatedAt: 0 } as DomainNode;

  it('accepts MESSAGE_SYNC between two lifelines', () => {
    const r = sequenceDiagramValidator.validateConnection(ll1, ll2, 'MESSAGE_SYNC');
    expect(r.isValid).toBe(true);
  });

  it('rejects message from non-lifeline source', () => {
    const r = sequenceDiagramValidator.validateConnection(fakeOther, ll1, 'MESSAGE_SYNC');
    expect(r.isValid).toBe(false);
    expect(r.errors?.[0]).toMatch(/source/);
  });

  it('rejects unknown edge type', () => {
    const r = sequenceDiagramValidator.validateConnection(ll1, ll2, 'BOGUS');
    expect(r.isValid).toBe(false);
  });
});

// ─── validateMessage ──────────────────────────────────────────────────────────

function makeIRLifeline(id: string, represents?: string): IRLifeline {
  return {
    id,
    kind: 'LIFELINE',
    name: id,
    participantKind: represents ? 'CLASS' : 'ANONYMOUS',
    alias: id,
    ...(represents ? { represents } : {}),
  };
}

function makeIRClass(id: string, operationIds: string[]): IRClass {
  return {
    id,
    kind: 'CLASS',
    name: id,
    attributeIds: [],
    operationIds,
  };
}

function makeIRMessage(overrides: Partial<IRMessage>): IRMessage {
  return {
    id: 'm1',
    kind: 'MESSAGE',
    name: 'op',
    messageKind: 'SYNC',
    sourceLifelineId: 'll1',
    targetLifelineId: 'll2',
    sequenceNumber: 1,
    ...overrides,
  };
}

function makeModelWith(parts: Partial<SemanticModel>): SemanticModel {
  return {
    id: 'm', name: 't', version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activityNodes: {}, objectInstances: {}, components: {}, nodes: {},
    artifacts: {}, relations: {},
    createdAt: 0, updatedAt: 0,
    ...parts,
  } as SemanticModel;
}

describe('SequenceDiagramValidator.validateMessage', () => {
  it('passes a message without operationId (nothing to check)', () => {
    const model = makeModelWith({
      lifelines: { ll1: makeIRLifeline('ll1'), ll2: makeIRLifeline('ll2') },
    });
    const r = sequenceDiagramValidator.validateMessage(
      makeIRMessage({}),
      model,
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings).toBeUndefined();
  });

  it('warns when operationId is set but target lifeline has no classifier', () => {
    const model = makeModelWith({
      lifelines: { ll1: makeIRLifeline('ll1'), ll2: makeIRLifeline('ll2') }, // ll2 is ANONYMOUS
    });
    const r = sequenceDiagramValidator.validateMessage(
      makeIRMessage({ operationId: 'op-missing' }),
      model,
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings?.[0]).toMatch(/no resolvable classifier/i);
  });

  it('warns when operationId is not declared on the target classifier', () => {
    const cls = makeIRClass('Cls', ['op-known']);
    const model = makeModelWith({
      classes: { Cls: cls },
      lifelines: {
        ll1: makeIRLifeline('ll1'),
        ll2: makeIRLifeline('ll2', 'Cls'),
      },
    });
    const r = sequenceDiagramValidator.validateMessage(
      makeIRMessage({ operationId: 'op-other' }),
      model,
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings?.[0]).toMatch(/not declared on the target classifier/);
  });

  it('passes when operationId matches a real operation on the target classifier', () => {
    const cls = makeIRClass('Cls', ['op-1']);
    const model = makeModelWith({
      classes: { Cls: cls },
      lifelines: {
        ll1: makeIRLifeline('ll1'),
        ll2: makeIRLifeline('ll2', 'Cls'),
      },
    });
    const r = sequenceDiagramValidator.validateMessage(
      makeIRMessage({ operationId: 'op-1' }),
      model,
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings).toBeUndefined();
  });

  it('warns about REPLY without inReplyTo', () => {
    const model = makeModelWith({
      lifelines: { ll1: makeIRLifeline('ll1'), ll2: makeIRLifeline('ll2') },
    });
    const r = sequenceDiagramValidator.validateMessage(
      makeIRMessage({ messageKind: 'REPLY' }),
      model,
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings?.[0]).toMatch(/REPLY.*inReplyTo/);
  });

  it('returns valid (no warnings) when target lifeline is missing — caller handles dangling refs', () => {
    const model = makeModelWith({
      lifelines: { ll1: makeIRLifeline('ll1') }, // no ll2
    });
    const r = sequenceDiagramValidator.validateMessage(
      makeIRMessage({ operationId: 'op-x' }),
      model,
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings).toBeUndefined();
  });

  it('warns when message references a fragment that does not cover both endpoints', () => {
    const frag: IRInteractionFragment = {
      id: 'f1', kind: 'FRAGMENT', name: 'alt',
      fragmentKind: 'ALT',
      coveredLifelineIds: ['ll1'], // ll2 NOT covered
      operands: [{ id: 'op1', messageIds: [], fragmentIds: [] }],
    };
    const model = makeModelWith({
      lifelines: { ll1: makeIRLifeline('ll1'), ll2: makeIRLifeline('ll2') },
      interactionFragments: { f1: frag },
    });
    const r = sequenceDiagramValidator.validateMessage(
      makeIRMessage({ fragmentId: 'f1' }),
      model,
    );
    expect(r.warnings?.[0]).toMatch(/doesn't cover both endpoints/);
  });

  it('warns when message references a missing fragment', () => {
    const model = makeModelWith({
      lifelines: { ll1: makeIRLifeline('ll1'), ll2: makeIRLifeline('ll2') },
    });
    const r = sequenceDiagramValidator.validateMessage(
      makeIRMessage({ fragmentId: 'f-missing' }),
      model,
    );
    expect(r.warnings?.[0]).toMatch(/missing fragment/);
  });
});

// ─── validateFragment ─────────────────────────────────────────────────────────

function makeFragment(partial: Partial<IRInteractionFragment> = {}): IRInteractionFragment {
  return {
    id: 'f1', kind: 'FRAGMENT', name: 'alt-1',
    fragmentKind: 'ALT',
    coveredLifelineIds: ['ll1'],
    operands: [{ id: 'op1', messageIds: [], fragmentIds: [] }],
    ...partial,
  };
}

describe('SequenceDiagramValidator.validateFragment', () => {
  it('rejects fragment with no covered lifelines', () => {
    const model = makeModelWith({ lifelines: { ll1: makeIRLifeline('ll1') } });
    const r = sequenceDiagramValidator.validateFragment(
      makeFragment({ coveredLifelineIds: [] }),
      model,
    );
    expect(r.isValid).toBe(false);
    expect(r.errors?.[0]).toMatch(/at least one lifeline/);
  });

  it('rejects fragment whose covered lifelines do not exist', () => {
    const model = makeModelWith({ lifelines: { ll1: makeIRLifeline('ll1') } });
    const r = sequenceDiagramValidator.validateFragment(
      makeFragment({ coveredLifelineIds: ['ll1', 'ghost'] }),
      model,
    );
    expect(r.isValid).toBe(false);
    expect(r.errors?.[0]).toMatch(/missing lifelines/);
  });

  it('warns when LOOP has no guard', () => {
    const model = makeModelWith({ lifelines: { ll1: makeIRLifeline('ll1') } });
    const r = sequenceDiagramValidator.validateFragment(
      makeFragment({ fragmentKind: 'LOOP', operands: [{ id: 'op', messageIds: [], fragmentIds: [] }] }),
      model,
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings?.[0]).toMatch(/LOOP.*without a guard/);
  });

  it('warns when OPT has more than one operand', () => {
    const model = makeModelWith({ lifelines: { ll1: makeIRLifeline('ll1') } });
    const r = sequenceDiagramValidator.validateFragment(
      makeFragment({
        fragmentKind: 'OPT',
        operands: [
          { id: 'op1', messageIds: [], fragmentIds: [] },
          { id: 'op2', messageIds: [], fragmentIds: [] },
        ],
      }),
      model,
    );
    expect(r.warnings?.[0]).toMatch(/OPT.*exactly one operand/);
  });

  it('warns when parentFragmentId does not resolve', () => {
    const model = makeModelWith({ lifelines: { ll1: makeIRLifeline('ll1') } });
    const r = sequenceDiagramValidator.validateFragment(
      makeFragment({ parentFragmentId: 'missing' }),
      model,
    );
    expect(r.warnings?.[0]).toMatch(/parentFragmentId.*does not resolve/);
  });

  it('passes a well-formed ALT with covered lifelines', () => {
    const model = makeModelWith({
      lifelines: { ll1: makeIRLifeline('ll1'), ll2: makeIRLifeline('ll2') },
    });
    const r = sequenceDiagramValidator.validateFragment(
      makeFragment({ coveredLifelineIds: ['ll1', 'll2'] }),
      model,
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings).toBeUndefined();
  });
});
