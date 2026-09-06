import { describe, it, expect } from 'vitest';
import { activityDiagramValidator } from '../activity-diagram.validator';
import type { DomainNode } from '../../domain/models/nodes';
import type { SemanticModel } from '../../domain/vfs/vfs.types';

const node = (type: string, over: Record<string, unknown> = {}) =>
  ({
    id: over.id ?? `${type}-1`,
    type,
    activityId: 'a1',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as unknown as DomainNode;

const v = activityDiagramValidator;

describe('ActivityDiagramValidator.validateConnection', () => {
  it('accepts a control flow between two actions', () => {
    const result = v.validateConnection(
      node('ACTION', { id: 'a' }),
      node('ACTION', { id: 'b' }),
      'CONTROL_FLOW',
    );
    expect(result.isValid).toBe(true);
  });

  it('accepts initial → action → final', () => {
    expect(
      v.validateConnection(node('INITIAL_NODE', { id: 'i' }), node('ACTION', { id: 'a' }), 'CONTROL_FLOW').isValid,
    ).toBe(true);
    expect(
      v.validateConnection(node('ACTION', { id: 'a' }), node('ACTIVITY_FINAL', { id: 'f' }), 'CONTROL_FLOW').isValid,
    ).toBe(true);
  });

  it('refuses a flow leaving a final node', () => {
    const result = v.validateConnection(
      node('ACTIVITY_FINAL', { id: 'f' }),
      node('ACTION', { id: 'a' }),
      'CONTROL_FLOW',
    );
    expect(result.isValid).toBe(false);
    expect(result.errors?.[0]).toMatch(/final node ends the flow/i);
  });

  it('refuses a flow entering an initial node', () => {
    const result = v.validateConnection(
      node('ACTION', { id: 'a' }),
      node('INITIAL_NODE', { id: 'i' }),
      'CONTROL_FLOW',
    );
    expect(result.isValid).toBe(false);
    expect(result.errors?.[0]).toMatch(/initial node starts the flow/i);
  });

  it('refuses a node flowing into itself', () => {
    const self = node('ACTION', { id: 'same' });
    const result = v.validateConnection(self, self, 'CONTROL_FLOW');
    expect(result.isValid).toBe(false);
  });

  it('refuses a flow to or from something that is not an activity node', () => {
    expect(
      v.validateConnection(node('CLASS', { id: 'c' }), node('ACTION', { id: 'a' }), 'CONTROL_FLOW').isValid,
    ).toBe(false);
    expect(
      v.validateConnection(node('ACTION', { id: 'a' }), node('LIFELINE', { id: 'l' }), 'CONTROL_FLOW').isValid,
    ).toBe(false);
  });

  it('refuses an edge type this diagram does not own', () => {
    const result = v.validateConnection(
      node('ACTION', { id: 'a' }),
      node('ACTION', { id: 'b' }),
      'MESSAGE_SYNC',
    );
    expect(result.isValid).toBe(false);
  });

  it('warns, but allows, an object flow with no object node at either end', () => {
    const result = v.validateConnection(
      node('ACTION', { id: 'a' }),
      node('ACTION', { id: 'b' }),
      'OBJECT_FLOW',
    );
    // Sketching is legitimate; this is a nudge, not a block.
    expect(result.isValid).toBe(true);
    expect(result.warnings?.[0]).toMatch(/object node/i);
  });

  it('accepts an object flow that has an object node at one end', () => {
    const result = v.validateConnection(
      node('OBJECT_NODE', { id: 'o', name: 'Order' }),
      node('ACTION', { id: 'a' }),
      'OBJECT_FLOW',
    );
    expect(result.warnings).toBeUndefined();
  });

  // A6.2 — pins as object-flow endpoints.
  it('accepts an object flow between two pins with no "usually has an object node" nudge', () => {
    const result = v.validateConnection(
      node('OUTPUT_PIN', { id: 'op' }),
      node('INPUT_PIN', { id: 'ip' }),
      'OBJECT_FLOW',
    );
    expect(result.warnings).toBeUndefined();
  });

  it('warns about a flow leaving an input pin — it only receives', () => {
    const result = v.validateConnection(
      node('INPUT_PIN', { id: 'ip' }),
      node('ACTION', { id: 'a' }),
      'OBJECT_FLOW',
    );
    expect(result.isValid).toBe(true);
    expect(result.warnings?.[0]).toMatch(/input pin receives/i);
  });

  it('warns about a flow entering an output pin — it only produces', () => {
    const result = v.validateConnection(
      node('ACTION', { id: 'a' }),
      node('OUTPUT_PIN', { id: 'op' }),
      'OBJECT_FLOW',
    );
    expect(result.isValid).toBe(true);
    expect(result.warnings?.[0]).toMatch(/output pin produces/i);
  });
});

describe('ActivityDiagramValidator.validateNode', () => {
  it('warns about an unnamed action', () => {
    const result = v.validateNode(node('ACTION', { name: '   ' }));
    expect(result.isValid).toBe(true);
    expect(result.warnings?.[0]).toMatch(/no name/i);
  });

  it('does not ask control nodes for a name', () => {
    expect(v.validateNode(node('INITIAL_NODE')).warnings).toBeUndefined();
    expect(v.validateNode(node('ACTIVITY_FINAL')).warnings).toBeUndefined();
    expect(v.validateNode(node('FORK')).warnings).toBeUndefined();
  });

  it('warns about a call action that references no operation', () => {
    const result = v.validateNode(node('CALL_OPERATION', { name: 'Charge card' }));
    expect(result.warnings?.[0]).toMatch(/does not reference an operation/i);
  });

  it('is quiet about a call action wired to an operation', () => {
    const result = v.validateNode(
      node('CALL_OPERATION', { name: 'Charge card', callsOperationId: 'op-1' }),
    );
    expect(result.warnings).toBeUndefined();
  });

  it('ignores nodes belonging to other diagram types', () => {
    expect(v.validateNode(node('CLASS', { name: '' })).isValid).toBe(true);
    expect(v.validateNode(node('CLASS', { name: '' })).warnings).toBeUndefined();
  });

  // A6.2 — a pin's identity is its owner + trace, not a required name.
  it('does not ask a pin for a name', () => {
    expect(v.validateNode(node('INPUT_PIN', { ownerActionId: 'a1' })).warnings).toBeUndefined();
  });

  it('warns about a pin with no owning action', () => {
    const result = v.validateNode(node('OUTPUT_PIN', {}));
    expect(result.warnings?.[0]).toMatch(/no owning action/i);
  });

  it('is quiet about a pin with an owning action', () => {
    expect(v.validateNode(node('INPUT_PIN', { ownerActionId: 'a1' })).warnings).toBeUndefined();
  });
});

// ─── validateActivityStructure (A2) ───────────────────────────────────────────

const actNode = (id: string, activityType: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'ACTIVITY_NODE', name: id, activityType, activityId: 'a1', ...over,
});

const flow = (id: string, sourceId: string, targetId: string, kind = 'CONTROL_FLOW') => ({
  id, kind, sourceId, targetId,
});

function model(
  activityNodes: Record<string, unknown>,
  relations: Record<string, unknown> = {},
): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activities: { a1: { id: 'a1', kind: 'ACTIVITY', name: 'A' } },
    activityNodes, activityPartitions: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    relations, createdAt: 1, updatedAt: 1,
  } as unknown as SemanticModel;
}

describe('ActivityDiagramValidator.validateActivityStructure', () => {
  it('warns about a decision with only one outgoing flow', () => {
    const m = model(
      { d: actNode('d', 'DECISION'), a: actNode('a', 'ACTION') },
      { f1: flow('f1', 'd', 'a') },
    );
    const result = v.validateActivityStructure('a1', m);
    expect(result.isValid).toBe(true);
    expect(result.warnings?.[0]).toMatch(/decision.*only one outgoing/i);
  });

  it('is quiet about a decision with two outgoing flows', () => {
    const m = model(
      { d: actNode('d', 'DECISION'), a: actNode('a', 'ACTION'), b: actNode('b', 'ACTION') },
      { f1: flow('f1', 'd', 'a'), f2: flow('f2', 'd', 'b') },
    );
    expect(v.validateActivityStructure('a1', m).warnings).toBeUndefined();
  });

  it('warns about a merge with only one incoming flow', () => {
    const m = model(
      { mg: actNode('mg', 'MERGE'), a: actNode('a', 'ACTION') },
      { f1: flow('f1', 'a', 'mg') },
    );
    expect(v.validateActivityStructure('a1', m).warnings?.[0]).toMatch(/merge.*only one incoming/i);
  });

  it('is quiet about a merge with two incoming flows', () => {
    const m = model(
      { mg: actNode('mg', 'MERGE'), a: actNode('a', 'ACTION'), b: actNode('b', 'ACTION') },
      { f1: flow('f1', 'a', 'mg'), f2: flow('f2', 'b', 'mg') },
    );
    expect(v.validateActivityStructure('a1', m).warnings).toBeUndefined();
  });

  it('warns about a fork with only one outgoing flow', () => {
    const m = model(
      { fk: actNode('fk', 'FORK'), jn: actNode('jn', 'JOIN'), a: actNode('a', 'ACTION') },
      { f1: flow('f1', 'fk', 'a') },
    );
    expect(v.validateActivityStructure('a1', m).warnings?.[0]).toMatch(/fork.*only one outgoing/i);
  });

  it('warns about a join with only one incoming flow', () => {
    const m = model(
      { fk: actNode('fk', 'FORK'), jn: actNode('jn', 'JOIN'), a: actNode('a', 'ACTION') },
      { f1: flow('f1', 'a', 'jn') },
    );
    expect(v.validateActivityStructure('a1', m).warnings?.some((w) => /join.*only one incoming/i.test(w))).toBe(true);
  });

  it('is quiet about a fork/join pair with matching fan-out/fan-in', () => {
    const m = model(
      {
        fk: actNode('fk', 'FORK'), jn: actNode('jn', 'JOIN'),
        a: actNode('a', 'ACTION'), b: actNode('b', 'ACTION'),
      },
      {
        f1: flow('f1', 'fk', 'a'), f2: flow('f2', 'fk', 'b'),
        f3: flow('f3', 'a', 'jn'), f4: flow('f4', 'b', 'jn'),
      },
    );
    expect(v.validateActivityStructure('a1', m).warnings).toBeUndefined();
  });

  it('warns when an activity forks but never joins', () => {
    const m = model(
      { fk: actNode('fk', 'FORK'), a: actNode('a', 'ACTION'), b: actNode('b', 'ACTION') },
      { f1: flow('f1', 'fk', 'a'), f2: flow('f2', 'fk', 'b') },
    );
    expect(
      v.validateActivityStructure('a1', m).warnings?.some((w) => /forks.*never joins/i.test(w)),
    ).toBe(true);
  });

  it('does not ask for a join when there is no fork to begin with', () => {
    const m = model(
      { a: actNode('a', 'ACTION'), b: actNode('b', 'ACTION') },
      { f1: flow('f1', 'a', 'b') },
    );
    expect(v.validateActivityStructure('a1', m).warnings).toBeUndefined();
  });

  it('ignores nodes and flows belonging to a different activity', () => {
    const m = model(
      { d: actNode('d', 'DECISION', { activityId: 'other' }), a: actNode('a', 'ACTION', { activityId: 'other' }) },
      { f1: flow('f1', 'd', 'a') },
    );
    // No nodes belong to a1, so nothing to warn about.
    expect(v.validateActivityStructure('a1', m).isValid).toBe(true);
    expect(v.validateActivityStructure('a1', m).warnings).toBeUndefined();
  });
});
