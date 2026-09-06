/**
 * A4 — the three cascade cleanups ADR-0010 requires (§5, §12 test matrix):
 * deleting the traced operation/use case/class-or-actor must not leave a
 * dangling id behind on the activity side of the trace.
 *
 * These are pure-function tests against `activityModelOps.ts` directly —
 * the single place both store surfaces call into (see that file's header).
 * Store-level wiring (setElementMembers, deleteClass) is covered in
 * `activityTraceability.store.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import {
  clearCallsOperationRefs,
  clearRealizesUseCaseRef,
  clearRepresentsRef,
  clearObjectNodeClassifierRefs,
  resolveObjectNodeClassifierLabel,
} from '../activityModelOps';
import type { SemanticModel } from '../../core/domain/vfs/vfs.types';

function emptyModel(): SemanticModel {
  return {
    packages: {},
    classes: {},
    interfaces: {},
    enums: {},
    dataTypes: {},
    attributes: {},
    operations: {},
    actors: {},
    useCases: {},
    activities: {},
    activityNodes: {},
    activityPartitions: {},
    objectInstances: {},
    components: {},
    nodes: {},
    artifacts: {},
    relations: {},
    domainModelId: 'dm-1',
    updatedAt: Date.now(),
  } as unknown as SemanticModel;
}

describe('clearCallsOperationRefs', () => {
  it('clears callsOperationId on every node that called a deleted operation', () => {
    const model = emptyModel();
    model.activityNodes['n1'] = { id: 'n1', kind: 'ACTIVITY_NODE', activityType: 'CALL_OPERATION', activityId: 'a1', name: 'Pay', callsOperationId: 'op1' };
    model.activityNodes['n2'] = { id: 'n2', kind: 'ACTIVITY_NODE', activityType: 'CALL_OPERATION', activityId: 'a1', name: 'Ship', callsOperationId: 'op2' };

    clearCallsOperationRefs(model, new Set(['op1']));

    expect(model.activityNodes['n1'].callsOperationId).toBeUndefined();
    expect(model.activityNodes['n2'].callsOperationId).toBe('op2');
  });

  it('is a no-op when nothing references the deleted operation', () => {
    const model = emptyModel();
    model.activityNodes['n1'] = { id: 'n1', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1', name: 'Pay' };

    expect(() => clearCallsOperationRefs(model, new Set(['op-ghost']))).not.toThrow();
    expect(model.activityNodes['n1'].callsOperationId).toBeUndefined();
  });

  it('short-circuits on an empty id set instead of scanning every node', () => {
    const model = emptyModel();
    model.activityNodes['n1'] = { id: 'n1', kind: 'ACTIVITY_NODE', activityType: 'CALL_OPERATION', activityId: 'a1', name: 'Pay', callsOperationId: 'op1' };

    clearCallsOperationRefs(model, new Set());

    expect(model.activityNodes['n1'].callsOperationId).toBe('op1');
  });
});

describe('clearRealizesUseCaseRef', () => {
  it('clears realizesUseCaseId on every activity that realized the deleted use case', () => {
    const model = emptyModel();
    model.activities!['a1'] = { id: 'a1', kind: 'ACTIVITY', name: 'Checkout', realizesUseCaseId: 'uc1' };
    model.activities!['a2'] = { id: 'a2', kind: 'ACTIVITY', name: 'Refund', realizesUseCaseId: 'uc2' };

    clearRealizesUseCaseRef(model, 'uc1');

    expect(model.activities!['a1'].realizesUseCaseId).toBeUndefined();
    expect(model.activities!['a2'].realizesUseCaseId).toBe('uc2');
  });
});

describe('clearRepresentsRef', () => {
  it('clears representsId on every lane whose responsible class/actor was deleted', () => {
    const model = emptyModel();
    model.activityPartitions!['p1'] = { id: 'p1', kind: 'ACTIVITY_PARTITION', activityId: 'a1', index: 0, name: 'Sales', representsId: 'class1' };
    model.activityPartitions!['p2'] = { id: 'p2', kind: 'ACTIVITY_PARTITION', activityId: 'a1', index: 1, name: 'Customer', representsId: 'actor1' };

    clearRepresentsRef(model, 'class1');

    expect(model.activityPartitions!['p1'].representsId).toBeUndefined();
    expect(model.activityPartitions!['p2'].representsId).toBe('actor1');
  });
});

// A6/v1.1 — the classifier trace on object nodes (ADR-0010), same cascade
// shape as clearRepresentsRef, scoped the same way (see that function's own
// comment: interfaces/enums/data types have no delete-cascade of their own
// references either, so classes are the only source this clears against).
describe('clearObjectNodeClassifierRefs', () => {
  it('clears classifierId on every object node whose classifier was deleted', () => {
    const model = emptyModel();
    model.activityNodes['n1'] = { id: 'n1', kind: 'ACTIVITY_NODE', activityType: 'OBJECT_NODE', activityId: 'a1', name: 'order', classifierId: 'class1' };
    model.activityNodes['n2'] = { id: 'n2', kind: 'ACTIVITY_NODE', activityType: 'OBJECT_NODE', activityId: 'a1', name: 'invoice', classifierId: 'class2' };

    clearObjectNodeClassifierRefs(model, 'class1');

    expect(model.activityNodes['n1'].classifierId).toBeUndefined();
    expect(model.activityNodes['n2'].classifierId).toBe('class2');
  });

  it('is a no-op when nothing references the deleted classifier', () => {
    const model = emptyModel();
    model.activityNodes['n1'] = { id: 'n1', kind: 'ACTIVITY_NODE', activityType: 'OBJECT_NODE', activityId: 'a1', name: 'order' };

    expect(() => clearObjectNodeClassifierRefs(model, 'class-ghost')).not.toThrow();
    expect(model.activityNodes['n1'].classifierId).toBeUndefined();
  });
});

describe('resolveObjectNodeClassifierLabel', () => {
  it('resolves a class', () => {
    const model = emptyModel();
    model.classes['c1'] = { id: 'c1', kind: 'CLASS', name: 'Order', attributeIds: [], operationIds: [] } as never;
    expect(resolveObjectNodeClassifierLabel(model, 'c1')).toBe('Order');
  });

  it('resolves an interface, enum or data type', () => {
    const model = emptyModel();
    model.interfaces['i1'] = { id: 'i1', kind: 'INTERFACE', name: 'Payable', operationIds: [] } as never;
    model.enums['e1'] = { id: 'e1', kind: 'ENUM', name: 'Status', values: [] } as never;
    model.dataTypes['d1'] = { id: 'd1', kind: 'DATA_TYPE', name: 'Money' } as never;

    expect(resolveObjectNodeClassifierLabel(model, 'i1')).toBe('Payable');
    expect(resolveObjectNodeClassifierLabel(model, 'e1')).toBe('Status');
    expect(resolveObjectNodeClassifierLabel(model, 'd1')).toBe('Money');
  });

  it('returns undefined when the classifier does not resolve', () => {
    const model = emptyModel();
    expect(resolveObjectNodeClassifierLabel(model, 'ghost')).toBeUndefined();
  });
});
