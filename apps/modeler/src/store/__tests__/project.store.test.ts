import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../project.store';
import type { ClassNode } from '../../core/domain/models/nodes/class-diagram.types';
import type { AssociationEdge } from '../../core/domain/models/edges/class-diagram.types';

describe('Project Store', () => {
  beforeEach(() => {
    // Clear the store before each test
    useProjectStore.getState().clearAll();
  });

  describe('Node Operations', () => {
    it('should add a node to the store', () => {
      const node: ClassNode = {
        id: 'node-1',
        type: 'CLASS',
        name: 'TestClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addNode(node);

      const storedNode = useProjectStore.getState().getNode('node-1');
      expect(storedNode).toEqual(node);
    });

    it('should update a node', () => {
      const node: ClassNode = {
        id: 'node-1',
        type: 'CLASS',
        name: 'OriginalName',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addNode(node);
      useProjectStore.getState().updateNode('node-1', { name: 'UpdatedName' });

      const updatedNode = useProjectStore.getState().getNode('node-1') as ClassNode;
      expect(updatedNode.name).toBe('UpdatedName');
      expect(updatedNode.updatedAt).toBeGreaterThan(node.updatedAt);
    });

    it('should remove a node', () => {
      const node: ClassNode = {
        id: 'node-1',
        type: 'CLASS',
        name: 'TestClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addNode(node);
      useProjectStore.getState().removeNode('node-1');

      const storedNode = useProjectStore.getState().getNode('node-1');
      expect(storedNode).toBeUndefined();
    });

    it('should get multiple nodes by IDs', () => {
      const node1: ClassNode = {
        id: 'node-1',
        type: 'CLASS',
        name: 'Class1',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const node2: ClassNode = {
        id: 'node-2',
        type: 'CLASS',
        name: 'Class2',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addNode(node1);
      useProjectStore.getState().addNode(node2);

      const nodes = useProjectStore.getState().getNodes(['node-1', 'node-2']);
      expect(nodes).toHaveLength(2);
      expect(nodes[0].id).toBe('node-1');
      expect(nodes[1].id).toBe('node-2');
    });

    it('should filter out non-existent node IDs', () => {
      const node: ClassNode = {
        id: 'node-1',
        type: 'CLASS',
        name: 'Class1',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addNode(node);

      const nodes = useProjectStore.getState().getNodes(['node-1', 'non-existent']);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('node-1');
    });
  });

  describe('Edge Operations', () => {
    it('should add an edge to the store', () => {
      const edge: AssociationEdge = {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addEdge(edge);

      const storedEdge = useProjectStore.getState().getEdge('edge-1');
      expect(storedEdge).toEqual(edge);
    });

    it('should update an edge', () => {
      const edge: AssociationEdge = {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        sourceMultiplicity: '1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addEdge(edge);
      useProjectStore.getState().updateEdge('edge-1', { sourceMultiplicity: '*' });

      const updatedEdge = useProjectStore.getState().getEdge('edge-1') as AssociationEdge;
      expect(updatedEdge.sourceMultiplicity).toBe('*');
    });

    it('should remove an edge', () => {
      const edge: AssociationEdge = {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addEdge(edge);
      useProjectStore.getState().removeEdge('edge-1');

      const storedEdge = useProjectStore.getState().getEdge('edge-1');
      expect(storedEdge).toBeUndefined();
    });

    it('should get edges for a specific node', () => {
      const edge1: AssociationEdge = {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const edge2: AssociationEdge = {
        id: 'edge-2',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-2',
        targetNodeId: 'node-3',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const edge3: AssociationEdge = {
        id: 'edge-3',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-3',
        targetNodeId: 'node-4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addEdge(edge1);
      useProjectStore.getState().addEdge(edge2);
      useProjectStore.getState().addEdge(edge3);

      const edgesForNode2 = useProjectStore.getState().getEdgesForNode('node-2');
      expect(edgesForNode2).toHaveLength(2);
      expect(edgesForNode2.map(e => e.id)).toContain('edge-1');
      expect(edgesForNode2.map(e => e.id)).toContain('edge-2');
    });
  });

  describe('Bulk Operations', () => {
    it('should add multiple nodes at once', () => {
      const nodes: ClassNode[] = [
        {
          id: 'node-1',
          type: 'CLASS',
          name: 'Class1',
          attributes: [],
          methods: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'node-2',
          type: 'CLASS',
          name: 'Class2',
          attributes: [],
          methods: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      useProjectStore.getState().addNodes(nodes);

      expect(useProjectStore.getState().getNode('node-1')).toBeDefined();
      expect(useProjectStore.getState().getNode('node-2')).toBeDefined();
    });

    it('should remove multiple nodes at once', () => {
      const nodes: ClassNode[] = [
        {
          id: 'node-1',
          type: 'CLASS',
          name: 'Class1',
          attributes: [],
          methods: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'node-2',
          type: 'CLASS',
          name: 'Class2',
          attributes: [],
          methods: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      useProjectStore.getState().addNodes(nodes);
      useProjectStore.getState().removeNodes(['node-1', 'node-2']);

      expect(useProjectStore.getState().getNode('node-1')).toBeUndefined();
      expect(useProjectStore.getState().getNode('node-2')).toBeUndefined();
    });
  });

  describe('Clear All', () => {
    it('should clear all nodes and edges', () => {
      const node: ClassNode = {
        id: 'node-1',
        type: 'CLASS',
        name: 'TestClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const edge: AssociationEdge = {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.getState().addNode(node);
      useProjectStore.getState().addEdge(edge);
      useProjectStore.getState().clearAll();

      expect(Object.keys(useProjectStore.getState().nodes)).toHaveLength(0);
      expect(Object.keys(useProjectStore.getState().edges)).toHaveLength(0);
    });
  });
});
