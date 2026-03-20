import { describe, it, expect } from 'vitest';
import {
  mapDomainNodeToView,
  mapDomainEdgeToView,
  mapDomainNodesToViews,
  mapDomainEdgesToViews,
  extractPositionMap,
} from '../index';
import type { ClassNode, AssociationEdge } from '../../../../core/domain/models';

describe('Mapper Integration', () => {
  it('should export all mapper functions from index', () => {
    expect(mapDomainNodeToView).toBeDefined();
    expect(mapDomainEdgeToView).toBeDefined();
    expect(mapDomainNodesToViews).toBeDefined();
    expect(mapDomainEdgesToViews).toBeDefined();
    expect(extractPositionMap).toBeDefined();
  });

  it('should transform a complete diagram from domain to view', () => {
    // Create domain entities
    const domainNodes: ClassNode[] = [
      {
        id: 'class-1',
        type: 'CLASS',
        name: 'Patient',
        attributes: [
          {
            id: 'attr-1',
            name: 'name',
            type: 'String',
            visibility: '+',
            isArray: false,
          },
        ],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'class-2',
        type: 'CLASS',
        name: 'Doctor',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const domainEdges: AssociationEdge[] = [
      {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'class-1',
        targetNodeId: 'class-2',
        sourceMultiplicity: '1',
        targetMultiplicity: '*',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const positionMap = {
      'class-1': { x: 100, y: 100 },
      'class-2': { x: 400, y: 100 },
    };

    // Transform to view models
    const viewNodes = mapDomainNodesToViews(domainNodes, positionMap);
    const viewEdges = mapDomainEdgesToViews(domainEdges);

    // Verify transformation
    expect(viewNodes).toHaveLength(2);
    expect(viewEdges).toHaveLength(1);

    expect(viewNodes[0].domainId).toBe('class-1');
    expect(viewNodes[0].position).toEqual({ x: 100, y: 100 });
    expect(viewNodes[0].type).toBe('umlClass');

    expect(viewEdges[0].domainId).toBe('edge-1');
    expect(viewEdges[0].source).toBe('class-1');
    expect(viewEdges[0].target).toBe('class-2');

    // Verify we can extract positions back
    const extractedPositions = extractPositionMap(viewNodes);
    expect(extractedPositions).toEqual(positionMap);
  });

  it('should maintain referential integrity between nodes and edges', () => {
    const domainNodes: ClassNode[] = [
      {
        id: 'node-a',
        type: 'CLASS',
        name: 'A',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'node-b',
        type: 'CLASS',
        name: 'B',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const domainEdges: AssociationEdge[] = [
      {
        id: 'edge-ab',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const positionMap = {
      'node-a': { x: 0, y: 0 },
      'node-b': { x: 200, y: 0 },
    };

    const viewNodes = mapDomainNodesToViews(domainNodes, positionMap);
    const viewEdges = mapDomainEdgesToViews(domainEdges);

    // Verify edge references match node IDs
    const nodeIds = new Set(viewNodes.map((n) => n.id));
    viewEdges.forEach((edge) => {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    });
  });
});
