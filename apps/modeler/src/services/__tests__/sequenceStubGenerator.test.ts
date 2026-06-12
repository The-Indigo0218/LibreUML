import { describe, it, expect } from 'vitest';
import { deriveOperationStubs, applyOperationStubs } from '../sequenceStubGenerator';
import type {
  SemanticModel,
  IRClass,
  IRLifeline,
  IRMessage,
  IROperation,
  IRAttribute,
} from '../../core/domain/vfs/vfs.types';

function makeModel(overrides: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activityNodes: {}, objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, relations: {},
    createdAt: 0, updatedAt: 0,
    ...overrides,
  } as SemanticModel;
}

const cls = (id: string, partial: Partial<IRClass> = {}): IRClass => ({
  id, kind: 'CLASS', name: id, attributeIds: [], operationIds: [], ...partial,
});

const ll = (id: string, represents: string): IRLifeline => ({
  id, kind: 'LIFELINE', name: id, participantKind: 'CLASS', represents,
});

const msg = (id: string, name: string, target: string, seq: number, partial: Partial<IRMessage> = {}): IRMessage => ({
  id, kind: 'MESSAGE', name, messageKind: 'SYNC', sourceLifelineId: 'llA', targetLifelineId: target, sequenceNumber: seq, ...partial,
});

describe('deriveOperationStubs', () => {
  it('derives an operation on the target classifier from a named SYNC message', () => {
    const model = makeModel({
      classes: { C: cls('C') },
      lifelines: { llA: ll('llA', 'A'), llC: ll('llC', 'C') },
      messages: { m1: msg('m1', 'fetchUser', 'llC', 1, { arguments: 'id, name: String' }) },
    });
    const plans = deriveOperationStubs(model, null);
    expect(plans).toHaveLength(1);
    expect(plans[0].classifierId).toBe('C');
    expect(plans[0].operations).toHaveLength(1);
    const op = plans[0].operations[0];
    expect(op.name).toBe('fetchUser');
    expect(op.returnType).toBe('void');
    expect(op.parameters.map((p) => p.name)).toEqual(['id', 'name']);
    expect(op.parameters[1].type).toBe('String');
  });

  it('skips reply/found/lost/unnamed/already-linked messages', () => {
    const model = makeModel({
      classes: { C: cls('C') },
      lifelines: { llA: ll('llA', 'A'), llC: ll('llC', 'C') },
      messages: {
        reply:  msg('reply', 'r', 'llC', 1, { messageKind: 'REPLY' }),
        found:  msg('found', 'f', 'llC', 2, { messageKind: 'ASYNC', sourceLifelineId: '', isFound: true }),
        lost:   msg('lost', 'l', '', 3, { messageKind: 'ASYNC', isLost: true }),
        blank:  msg('blank', '', 'llC', 4),
        linked: msg('linked', 'already', 'llC', 5, { operationId: 'op-existing' }),
      },
    });
    expect(deriveOperationStubs(model, null)).toHaveLength(0);
  });

  it('does not duplicate an operation the classifier already declares', () => {
    const existing: IROperation = { id: 'opX', kind: 'OPERATION', name: 'save', parameters: [] };
    const model = makeModel({
      classes: { C: cls('C', { operationIds: ['opX'] }) },
      operations: { opX: existing },
      lifelines: { llA: ll('llA', 'A'), llC: ll('llC', 'C') },
      messages: { m1: msg('m1', 'save', 'llC', 1) },
    });
    expect(deriveOperationStubs(model, null)).toHaveLength(0);
  });

  it('collapses repeated calls of the same operation into one stub', () => {
    const model = makeModel({
      classes: { C: cls('C') },
      lifelines: { llA: ll('llA', 'A'), llC: ll('llC', 'C') },
      messages: {
        m1: msg('m1', 'ping', 'llC', 1),
        m2: msg('m2', 'ping', 'llC', 2),
      },
    });
    const plans = deriveOperationStubs(model, null);
    expect(plans[0].operations).toHaveLength(1);
  });

  it('ignores messages whose target lifeline is absent from the diagram view', () => {
    const model = makeModel({
      classes: { C: cls('C') },
      lifelines: { llA: ll('llA', 'A'), llC: ll('llC', 'C') },
      messages: { m1: msg('m1', 'fetch', 'llC', 1) },
    });
    const view = { diagramId: 'd', nodes: [{ id: 'v', elementId: 'llA', x: 0, y: 0 }], edges: [] };
    expect(deriveOperationStubs(model, view)).toHaveLength(0);
  });
});

describe('applyOperationStubs', () => {
  it('appends derived operations via setElementMembers, preserving existing members', () => {
    const existing: IROperation = { id: 'opX', kind: 'OPERATION', name: 'old', parameters: [] };
    const attr: IRAttribute = { id: 'a1', kind: 'ATTRIBUTE', name: 'field', type: 'int' };
    const model = makeModel({
      classes: { C: cls('C', { attributeIds: ['a1'], operationIds: ['opX'] }) },
      attributes: { a1: attr },
      operations: { opX: existing },
      lifelines: { llA: ll('llA', 'A'), llC: ll('llC', 'C') },
      messages: { m1: msg('m1', 'newOp', 'llC', 1) },
    });
    const plans = deriveOperationStubs(model, null);

    let capturedAttrs: IRAttribute[] = [];
    let capturedOps: IROperation[] = [];
    const count = applyOperationStubs(model, plans, (_id, attrs, opsList) => {
      capturedAttrs = attrs;
      capturedOps = opsList;
    });

    expect(count).toBe(1);
    expect(capturedAttrs.map((a) => a.name)).toEqual(['field']);
    expect(capturedOps.map((o) => o.name)).toEqual(['old', 'newOp']);
  });
});
