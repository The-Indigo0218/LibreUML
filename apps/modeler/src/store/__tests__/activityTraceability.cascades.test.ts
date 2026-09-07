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
  getPinParameterCandidates,
  resolvePinParameterLabel,
  applyDeleteActivityNode,
  PIN_RETURN_VALUE,
} from '../activityModelOps';
import type { SemanticModel, IRActivityNode } from '../../core/domain/vfs/vfs.types';

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

// A6.2/v1.1 — pins traced to a parameter of their owner action's linked
// operation (ADR-0010). By name, not id: `IRParameter` carries no id.
describe('getPinParameterCandidates', () => {
  function modelWithOwner(): { model: SemanticModel } {
    const model = emptyModel();
    model.operations!['op1'] = {
      id: 'op1',
      kind: 'OPERATION',
      name: 'pay',
      returnType: 'Receipt',
      parameters: [
        { name: 'amount', type: 'number', direction: 'in' },
        { name: 'account', type: 'Account' },
        { name: 'log', type: 'Logger', direction: 'out' },
        { name: 'ledger', type: 'Ledger', direction: 'inout' },
        { name: 'legacy', type: 'string', direction: 'return' },
      ],
    };
    model.activityNodes['action1'] = {
      id: 'action1', kind: 'ACTIVITY_NODE', activityType: 'CALL_OPERATION',
      activityId: 'a1', name: 'Pay', callsOperationId: 'op1',
    };
    return { model };
  }

  it('lists in/inout parameters (and the undefined-direction default) for an input pin', () => {
    const { model } = modelWithOwner();
    const values = getPinParameterCandidates(model, 'action1', 'INPUT_PIN').map((c) => c.value);
    expect(values).toEqual(['amount', 'account', 'ledger']);
  });

  it('lists out/inout parameters plus a synthetic return entry for an output pin', () => {
    const { model } = modelWithOwner();
    const values = getPinParameterCandidates(model, 'action1', 'OUTPUT_PIN').map((c) => c.value);
    expect(values).toEqual(['log', 'ledger', PIN_RETURN_VALUE]);
  });

  it('omits the return entry when the operation has no return type', () => {
    const { model } = modelWithOwner();
    model.operations!['op1'].returnType = undefined;
    const values = getPinParameterCandidates(model, 'action1', 'OUTPUT_PIN').map((c) => c.value);
    expect(values).not.toContain(PIN_RETURN_VALUE);
  });

  it('returns nothing when the owner has no linked operation', () => {
    const model = emptyModel();
    model.activityNodes['action1'] = {
      id: 'action1', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1', name: 'Pay',
    };
    expect(getPinParameterCandidates(model, 'action1', 'INPUT_PIN')).toEqual([]);
  });

  it('returns nothing when there is no owner at all', () => {
    const model = emptyModel();
    expect(getPinParameterCandidates(model, undefined, 'INPUT_PIN')).toEqual([]);
  });
});

describe('resolvePinParameterLabel', () => {
  function modelWithOwner(): SemanticModel {
    const model = emptyModel();
    model.operations!['op1'] = {
      id: 'op1', kind: 'OPERATION', name: 'pay', returnType: 'Receipt',
      parameters: [{ name: 'amount', type: 'number', direction: 'in' }],
    };
    model.activityNodes['action1'] = {
      id: 'action1', kind: 'ACTIVITY_NODE', activityType: 'CALL_OPERATION',
      activityId: 'a1', name: 'Pay', callsOperationId: 'op1',
    };
    return model;
  }

  it('resolves a linked parameter to "name: type"', () => {
    const model = modelWithOwner();
    const pin: IRActivityNode = {
      id: 'p1', kind: 'ACTIVITY_NODE', activityType: 'INPUT_PIN', activityId: 'a1',
      name: '', ownerActionId: 'action1', parameterName: 'amount',
    };
    expect(resolvePinParameterLabel(model, pin)).toBe('amount: number');
  });

  it('resolves the return sentinel against the operation\'s return type', () => {
    const model = modelWithOwner();
    const pin: IRActivityNode = {
      id: 'p1', kind: 'ACTIVITY_NODE', activityType: 'OUTPUT_PIN', activityId: 'a1',
      name: '', ownerActionId: 'action1', parameterName: PIN_RETURN_VALUE,
    };
    expect(resolvePinParameterLabel(model, pin)).toBe('(return): Receipt');
  });

  it('stops resolving once the parameter it traced is gone — self-healing, not cascaded', () => {
    const model = modelWithOwner();
    model.operations!['op1'].parameters = [];
    const pin: IRActivityNode = {
      id: 'p1', kind: 'ACTIVITY_NODE', activityType: 'INPUT_PIN', activityId: 'a1',
      name: '', ownerActionId: 'action1', parameterName: 'amount',
    };
    expect(resolvePinParameterLabel(model, pin)).toBeUndefined();
  });

  it('returns undefined when the pin has no trace set', () => {
    const model = modelWithOwner();
    const pin: IRActivityNode = {
      id: 'p1', kind: 'ACTIVITY_NODE', activityType: 'INPUT_PIN', activityId: 'a1',
      name: '', ownerActionId: 'action1',
    };
    expect(resolvePinParameterLabel(model, pin)).toBeUndefined();
  });
});

describe('applyDeleteActivityNode — pin cascade (A6.2)', () => {
  it('deletes every pin owned by the action being deleted', () => {
    const model = emptyModel();
    model.activityNodes['action1'] = {
      id: 'action1', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1', name: 'Pay',
    };
    model.activityNodes['pin1'] = {
      id: 'pin1', kind: 'ACTIVITY_NODE', activityType: 'INPUT_PIN', activityId: 'a1',
      name: '', ownerActionId: 'action1',
    };
    model.activityNodes['pin2'] = {
      id: 'pin2', kind: 'ACTIVITY_NODE', activityType: 'OUTPUT_PIN', activityId: 'a1',
      name: '', ownerActionId: 'action1',
    };
    model.activityNodes['other'] = {
      id: 'other', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1', name: 'Ship',
    };

    applyDeleteActivityNode(model, 'action1');

    expect(model.activityNodes['action1']).toBeUndefined();
    expect(model.activityNodes['pin1']).toBeUndefined();
    expect(model.activityNodes['pin2']).toBeUndefined();
    expect(model.activityNodes['other']).toBeDefined();
  });

  it('deleting a pin directly does not touch its owner or siblings', () => {
    const model = emptyModel();
    model.activityNodes['action1'] = {
      id: 'action1', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1', name: 'Pay',
    };
    model.activityNodes['pin1'] = {
      id: 'pin1', kind: 'ACTIVITY_NODE', activityType: 'INPUT_PIN', activityId: 'a1',
      name: '', ownerActionId: 'action1',
    };

    applyDeleteActivityNode(model, 'pin1');

    expect(model.activityNodes['pin1']).toBeUndefined();
    expect(model.activityNodes['action1']).toBeDefined();
  });
});

describe('applyDeleteActivityNode — structured node ungroups its children (v1.1)', () => {
  it('clears containerId on every member instead of deleting them', () => {
    const model = emptyModel();
    model.activityNodes['loop1'] = {
      id: 'loop1', kind: 'ACTIVITY_NODE', activityType: 'LOOP_NODE', activityId: 'a1', name: 'Retry',
    };
    model.activityNodes['member1'] = {
      id: 'member1', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1',
      name: 'Step', containerId: 'loop1',
    };
    model.activityNodes['member2'] = {
      id: 'member2', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1',
      name: 'Step 2', containerId: 'loop1',
    };
    model.activityNodes['unrelated'] = {
      id: 'unrelated', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1', name: 'Ship',
    };

    applyDeleteActivityNode(model, 'loop1');

    expect(model.activityNodes['loop1']).toBeUndefined();
    expect(model.activityNodes['member1']).toBeDefined();
    expect(model.activityNodes['member1'].containerId).toBeUndefined();
    expect(model.activityNodes['member2'].containerId).toBeUndefined();
    expect(model.activityNodes['unrelated'].containerId).toBeUndefined();
  });

  it('deleting a member directly does not touch its container or siblings', () => {
    const model = emptyModel();
    model.activityNodes['loop1'] = {
      id: 'loop1', kind: 'ACTIVITY_NODE', activityType: 'LOOP_NODE', activityId: 'a1', name: 'Retry',
    };
    model.activityNodes['member1'] = {
      id: 'member1', kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'a1',
      name: 'Step', containerId: 'loop1',
    };

    applyDeleteActivityNode(model, 'member1');

    expect(model.activityNodes['member1']).toBeUndefined();
    expect(model.activityNodes['loop1']).toBeDefined();
  });
});
