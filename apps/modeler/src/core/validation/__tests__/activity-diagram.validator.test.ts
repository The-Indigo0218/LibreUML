import { describe, it, expect } from 'vitest';
import { activityDiagramValidator } from '../activity-diagram.validator';
import type { DomainNode } from '../../domain/models/nodes';

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
});
