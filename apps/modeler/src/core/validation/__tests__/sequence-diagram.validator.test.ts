import { describe, it, expect } from 'vitest';
import { sequenceDiagramValidator } from '../sequence-diagram.validator';
import type { LifelineNode } from '../../domain/models/nodes/sequence-diagram.types';
import type { DomainNode } from '../../domain/models/nodes';

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
