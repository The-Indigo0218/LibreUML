import { describe, it, expect } from 'vitest';
import {
  diagramRegistry,
  getDiagramRegistry,
  isDiagramTypeRegistered,
  getRegisteredDiagramTypes,
} from '../diagram-registry';

describe('Diagram Registry', () => {
  describe('Registry Structure', () => {
    it('should have CLASS_DIAGRAM registered', () => {
      expect(diagramRegistry.CLASS_DIAGRAM).toBeDefined();
      expect(diagramRegistry.CLASS_DIAGRAM.type).toBe('CLASS_DIAGRAM');
      expect(diagramRegistry.CLASS_DIAGRAM.displayName).toBe('Class Diagram');
    });

    it('should have USE_CASE_DIAGRAM registered', () => {
      expect(diagramRegistry.USE_CASE_DIAGRAM).toBeDefined();
      expect(diagramRegistry.USE_CASE_DIAGRAM.type).toBe('USE_CASE_DIAGRAM');
      expect(diagramRegistry.USE_CASE_DIAGRAM.displayName).toBe('Use Case Diagram');
    });
  });

  describe('Class Diagram Registry', () => {
    const registry = diagramRegistry.CLASS_DIAGRAM;

    it('should have correct supported node types', () => {
      expect(registry.supportedNodeTypes).toEqual([
        'CLASS',
        'INTERFACE',
        'ABSTRACT_CLASS',
        'ENUM',
        'NOTE',
      ]);
    });

    it('should have correct supported edge types', () => {
      expect(registry.supportedEdgeTypes).toEqual([
        'ASSOCIATION',
        'INHERITANCE',
        'IMPLEMENTATION',
        'DEPENDENCY',
        'AGGREGATION',
        'COMPOSITION',
        'NOTE_LINK',
        'PACKAGE_IMPORT',
        'PACKAGE_ACCESS',
        'PACKAGE_MERGE',
      ]);
    });

    it('should have default node type as CLASS', () => {
      expect(registry.defaultNodeType).toBe('CLASS');
    });

    it('should have default edge type as ASSOCIATION', () => {
      expect(registry.defaultEdgeType).toBe('ASSOCIATION');
    });

    it('should have validator attached', () => {
      expect(registry.validator).toBeDefined();
      expect(registry.validator.validateConnection).toBeDefined();
      expect(registry.validator.validateNode).toBeDefined();
      expect(registry.validator.validateEdge).toBeDefined();
    });

    it('should have factory functions', () => {
      expect(registry.factories.createNode).toBeDefined();
      expect(registry.factories.createEdge).toBeDefined();
    });
  });

  describe('Use Case Diagram Registry', () => {
    const registry = diagramRegistry.USE_CASE_DIAGRAM;

    it('should have correct supported node types', () => {
      expect(registry.supportedNodeTypes).toEqual([
        'ACTOR',
        'USE_CASE',
        'SYSTEM_BOUNDARY',
      ]);
    });

    it('should have correct supported edge types', () => {
      expect(registry.supportedEdgeTypes).toEqual([
        'ASSOCIATION',
        'INCLUDE',
        'EXTEND',
        'GENERALIZATION',
      ]);
    });

    it('should have default node type as USE_CASE', () => {
      expect(registry.defaultNodeType).toBe('USE_CASE');
    });

    it('should have validator attached', () => {
      expect(registry.validator).toBeDefined();
    });
  });

  describe('Factory Functions - Class Diagram', () => {
    const { createNode, createEdge } = diagramRegistry.CLASS_DIAGRAM.factories;

    it('should create a CLASS node with default values', () => {
      const node = createNode('CLASS');
      
      expect(node.type).toBe('CLASS');
      expect(node.id).toBeDefined();
      expect(node.createdAt).toBeDefined();
      expect(node.updatedAt).toBeDefined();
      expect('name' in node && node.name).toBe('NewClass');
      expect('attributes' in node && node.attributes).toEqual([]);
      expect('methods' in node && node.methods).toEqual([]);
    });

    it('should create a CLASS node with custom name', () => {
      const node = createNode('CLASS', { name: 'CustomClass' });
      
      expect('name' in node && node.name).toBe('CustomClass');
    });

    it('should create an INTERFACE node', () => {
      const node = createNode('INTERFACE');
      
      expect(node.type).toBe('INTERFACE');
      expect('name' in node && node.name).toBe('NewInterface');
      expect('methods' in node && node.methods).toEqual([]);
    });

    it('should create an ENUM node', () => {
      const node = createNode('ENUM');
      
      expect(node.type).toBe('ENUM');
      expect('name' in node && node.name).toBe('NewEnum');
      expect('literals' in node && node.literals).toEqual([]);
    });

    it('should create a NOTE node', () => {
      const node = createNode('NOTE');
      
      expect(node.type).toBe('NOTE');
      expect('content' in node && node.content).toBe('New note');
    });

    it('should create an ASSOCIATION edge', () => {
      const edge = createEdge('ASSOCIATION', 'node-1', 'node-2');
      
      expect(edge.type).toBe('ASSOCIATION');
      expect(edge.id).toBeDefined();
      expect(edge.sourceNodeId).toBe('node-1');
      expect(edge.targetNodeId).toBe('node-2');
      expect(edge.createdAt).toBeDefined();
    });

    it('should create an INHERITANCE edge', () => {
      const edge = createEdge('INHERITANCE', 'child', 'parent');
      
      expect(edge.type).toBe('INHERITANCE');
      expect(edge.sourceNodeId).toBe('child');
      expect(edge.targetNodeId).toBe('parent');
    });

    it('should throw error for unknown node type', () => {
      expect(() => createNode('UNKNOWN_TYPE')).toThrow('Unknown Class Diagram node type');
    });

    it('should throw error for unknown edge type', () => {
      expect(() => createEdge('UNKNOWN_TYPE', 'a', 'b')).toThrow('Unknown Class Diagram edge type');
    });
  });

  describe('Factory Functions - Use Case Diagram', () => {
    const { createNode, createEdge } = diagramRegistry.USE_CASE_DIAGRAM.factories;

    it('should create an ACTOR node', () => {
      const node = createNode('ACTOR');
      
      expect(node.type).toBe('ACTOR');
      expect('name' in node && node.name).toBe('NewActor');
    });

    it('should create a USE_CASE node', () => {
      const node = createNode('USE_CASE');
      
      expect(node.type).toBe('USE_CASE');
      expect('name' in node && node.name).toBe('NewUseCase');
    });

    it('should create a SYSTEM_BOUNDARY node', () => {
      const node = createNode('SYSTEM_BOUNDARY');
      
      expect(node.type).toBe('SYSTEM_BOUNDARY');
      expect('name' in node && node.name).toBe('System');
      expect('containedUseCaseIds' in node && node.containedUseCaseIds).toEqual([]);
    });

    it('should create an INCLUDE edge', () => {
      const edge = createEdge('INCLUDE', 'usecase-1', 'usecase-2');
      
      expect(edge.type).toBe('INCLUDE');
      expect(edge.sourceNodeId).toBe('usecase-1');
      expect(edge.targetNodeId).toBe('usecase-2');
    });

    it('should create an EXTEND edge', () => {
      const edge = createEdge('EXTEND', 'usecase-1', 'usecase-2');
      
      expect(edge.type).toBe('EXTEND');
    });
  });

  describe('Helper Functions', () => {
    it('should get diagram registry by type', () => {
      const registry = getDiagramRegistry('CLASS_DIAGRAM');
      expect(registry.type).toBe('CLASS_DIAGRAM');
    });

    it('should throw error for unregistered diagram type', () => {
      expect(() => getDiagramRegistry('UNKNOWN' as any)).toThrow('Diagram type not registered');
    });

    it('should check if diagram type is registered', () => {
      expect(isDiagramTypeRegistered('CLASS_DIAGRAM')).toBe(true);
      expect(isDiagramTypeRegistered('USE_CASE_DIAGRAM')).toBe(true);
      expect(isDiagramTypeRegistered('UNKNOWN')).toBe(false);
    });

    it('should get all registered diagram types', () => {
      const types = getRegisteredDiagramTypes();
      expect(types).toContain('CLASS_DIAGRAM');
      expect(types).toContain('USE_CASE_DIAGRAM');
      expect(types).toHaveLength(2);
    });
  });
});
