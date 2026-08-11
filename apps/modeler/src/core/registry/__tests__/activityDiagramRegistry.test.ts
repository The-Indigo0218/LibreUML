import { describe, it, expect } from 'vitest';
import { getDiagramRegistry } from '../diagram-registry';
import { resolveSemanticElement } from '../../../features/diagram/hooks/controllers/sharedNodeBuilders';
import type { SemanticModel } from '../../domain/vfs/vfs.types';

const registry = () => getDiagramRegistry('ACTIVITY_DIAGRAM');

function modelWith(over: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activities: {}, activityNodes: {}, activityPartitions: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    relations: {}, createdAt: 1, updatedAt: 1,
    ...over,
  } as SemanticModel;
}

describe('activityDiagramRegistry', () => {
  it('is registered under ACTIVITY_DIAGRAM', () => {
    expect(registry().type).toBe('ACTIVITY_DIAGRAM');
  });

  it('declares control flow as its default edge and action as its default node', () => {
    expect(registry().defaultNodeType).toBe('ACTION');
    expect(registry().defaultEdgeType).toBe('CONTROL_FLOW');
    expect(registry().supportedEdgeTypes).toEqual(['CONTROL_FLOW', 'OBJECT_FLOW']);
  });

  it('supports every node type its tools offer', () => {
    // A tool the diagram cannot actually place would fail only at drop time.
    const toolTypes = registry().tools.nodes.map((t) => t.id.toUpperCase());
    for (const type of toolTypes) {
      expect(registry().supportedNodeTypes, `tool ${type}`).toContain(type);
    }
  });

  it('gives every tool a translation key', () => {
    for (const tool of [...registry().tools.nodes, ...registry().tools.edges]) {
      expect(tool.translationKey, `tool ${tool.id}`).toBeTruthy();
    }
  });

  it('hides foreign tools — a class node inside a flow is meaningless', () => {
    expect(registry().hideForeignTools).toBe(true);
  });
});

describe('activityDiagramRegistry.factories', () => {
  it('creates an action with a default name', () => {
    const node = registry().factories.createNode('ACTION');
    expect(node.type).toBe('ACTION');
    expect((node as { name: string }).name).toBe('Action');
  });

  it('leaves control nodes unnamed — the glyph is the label', () => {
    const initial = registry().factories.createNode('INITIAL_NODE');
    expect(initial.type).toBe('INITIAL_NODE');
    expect((initial as { name?: string }).name).toBeUndefined();
  });

  it('defaults fork and join bars to horizontal', () => {
    const fork = registry().factories.createNode('FORK');
    expect((fork as { barOrientation?: string }).barOrientation).toBe('HORIZONTAL');
  });

  it('rejects a node type it does not own', () => {
    expect(() => registry().factories.createNode('LIFELINE')).toThrow(/Unknown Activity/);
  });

  it('creates control and object flows', () => {
    expect(registry().factories.createEdge('CONTROL_FLOW', 'a', 'b').type).toBe('CONTROL_FLOW');
    expect(registry().factories.createEdge('OBJECT_FLOW', 'a', 'b').type).toBe('OBJECT_FLOW');
  });

  it('rejects an edge type it does not own', () => {
    expect(() => registry().factories.createEdge('MESSAGE_SYNC', 'a', 'b')).toThrow(/Unknown Activity/);
  });
});

describe('activityDiagramRegistry.semanticLookup', () => {
  it('resolves an activity node', () => {
    const model = modelWith({
      activityNodes: {
        n1: {
          id: 'n1', kind: 'ACTIVITY_NODE', name: 'Pay',
          activityType: 'ACTION', activityId: 'a1',
        },
      } as never,
    });

    expect(registry().semanticLookup(model, 'n1')).toEqual({
      element: model.activityNodes.n1,
      kind: 'ACTIVITY_NODE',
    });
  });

  it('resolves a partition', () => {
    const model = modelWith({
      activityPartitions: {
        p1: { id: 'p1', kind: 'ACTIVITY_PARTITION', name: 'Customer', activityId: 'a1', index: 0 },
      },
    });

    expect(registry().semanticLookup(model, 'p1')?.kind).toBe('ACTIVITY_PARTITION');
  });

  it('returns null for an id it does not own', () => {
    expect(registry().semanticLookup(modelWith(), 'nope')).toBeNull();
  });

  /**
   * resolveSemanticElement iterates every registry's semanticLookup, so
   * declaring the entry is the whole integration — no shotgun edit needed.
   */
  it('is reachable through resolveSemanticElement', () => {
    const model = modelWith({
      activityNodes: {
        n1: {
          id: 'n1', kind: 'ACTIVITY_NODE', name: 'Pay',
          activityType: 'ACTION', activityId: 'a1',
        },
      } as never,
    });

    expect(resolveSemanticElement(model, 'n1').kind).toBe('ACTIVITY_NODE');
  });
});
