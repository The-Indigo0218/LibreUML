import { describe, it, expect } from 'vitest';
import {
  diagramRegistry,
  getDiagramRegistry,
  isDiagramTypeRegistered,
  getRegisteredDiagramTypes,
  getAllTools,
  getNativeNodeToolIds,
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
        'UC_MODULE',
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
      expect(isDiagramTypeRegistered('DOMAIN_MODEL_DIAGRAM')).toBe(true);
      expect(isDiagramTypeRegistered('UNKNOWN')).toBe(false);
    });

    it('should get all registered diagram types', () => {
      const types = getRegisteredDiagramTypes();
      expect(types).toContain('CLASS_DIAGRAM');
      expect(types).toContain('USE_CASE_DIAGRAM');
      expect(types).toContain('DOMAIN_MODEL_DIAGRAM');
      expect(types).toContain('SEQUENCE_DIAGRAM');
      expect(types).toHaveLength(4);
    });
  });

  // #1 — all-tools palette + cross-diagram drop guard
  describe('getAllTools / getNativeNodeToolIds', () => {
    it('aggregates node tools from every registry without duplicates', () => {
      const { nodes } = getAllTools();
      const ids = nodes.map((t) => t.id);

      // Tools native to different diagram types all appear in the merged list.
      expect(ids).toEqual(expect.arrayContaining(['class', 'actor', 'domain_entity', 'lifeline']));
      // De-duplicated: 'note' is declared by both Class and Sequence registries.
      expect(ids.filter((id) => id === 'note')).toHaveLength(1);
      // No duplicate ids overall.
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('aggregates edge tools and de-duplicates the shared "association" tool', () => {
      const { edges } = getAllTools();
      const ids = edges.map((t) => t.id);
      // 'association' is shared by Class/UseCase/Domain edge tools → collapsed to one.
      expect(ids.filter((id) => id === 'association')).toHaveLength(1);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('returns the native node-tool ids for a diagram type', () => {
      expect(getNativeNodeToolIds('CLASS_DIAGRAM')).toEqual(
        new Set(['class', 'interface', 'abstract', 'enum', 'note']),
      );
      expect(getNativeNodeToolIds('DOMAIN_MODEL_DIAGRAM')).toEqual(new Set(['domain_entity']));
    });

    it('marks cross-diagram tools as non-native (the drop-guard condition)', () => {
      const classNative = getNativeNodeToolIds('CLASS_DIAGRAM');
      // 'actor' belongs to UseCase, not Class → guard fires.
      expect(classNative.has('actor')).toBe(false);
      // 'class' is native → no guard.
      expect(classNative.has('class')).toBe(true);
    });

    it('returns an empty set for an unregistered diagram type', () => {
      expect(getNativeNodeToolIds('UNKNOWN' as never).size).toBe(0);
    });
  });

  describe('Domain Model Diagram Registry', () => {
    const registry = diagramRegistry.DOMAIN_MODEL_DIAGRAM;

    it('should be registered with correct type and displayName', () => {
      expect(registry).toBeDefined();
      expect(registry.type).toBe('DOMAIN_MODEL_DIAGRAM');
      expect(registry.displayName).toBe('Domain Model');
    });

    it('should support only DOMAIN_ENTITY nodes', () => {
      expect(registry.supportedNodeTypes).toEqual(['DOMAIN_ENTITY']);
    });

    it('should support only ASSOCIATION edges', () => {
      expect(registry.supportedEdgeTypes).toEqual(['ASSOCIATION']);
    });

    it('should have DOMAIN_ENTITY as default node type', () => {
      expect(registry.defaultNodeType).toBe('DOMAIN_ENTITY');
    });

    it('should have ASSOCIATION as default edge type', () => {
      expect(registry.defaultEdgeType).toBe('ASSOCIATION');
    });

    it('should have no code generation actions', () => {
      expect(registry.codeGenerationActions).toEqual([]);
    });

    it('should have image and xmi export actions', () => {
      const ids = registry.exportActions.map((a) => a.id);
      expect(ids).toContain('export-image');
      expect(ids).toContain('export-xmi');
    });

    it('should have validator with all three methods', () => {
      expect(registry.validator.validateConnection).toBeDefined();
      expect(registry.validator.validateNode).toBeDefined();
      expect(registry.validator.validateEdge).toBeDefined();
    });

    it('should have factory functions', () => {
      expect(registry.factories.createNode).toBeDefined();
      expect(registry.factories.createEdge).toBeDefined();
    });

    it('should retrieve via getDiagramRegistry', () => {
      const r = getDiagramRegistry('DOMAIN_MODEL_DIAGRAM');
      expect(r.type).toBe('DOMAIN_MODEL_DIAGRAM');
    });
  });

  describe('Factory Functions - Domain Model Diagram', () => {
    const { createNode, createEdge } = diagramRegistry.DOMAIN_MODEL_DIAGRAM.factories;

    it('creates a DOMAIN_ENTITY node with defaults', () => {
      const node = createNode('DOMAIN_ENTITY');
      expect(node.type).toBe('DOMAIN_ENTITY');
      expect(node.id).toBeDefined();
      expect(node.createdAt).toBeDefined();
      expect('name' in node && node.name).toBe('Entity');
      expect('attributes' in node && node.attributes).toEqual([]);
    });

    it('creates a DOMAIN_ENTITY node with custom name', () => {
      const node = createNode('DOMAIN_ENTITY', { name: 'Customer' });
      expect('name' in node && node.name).toBe('Customer');
    });

    it('creates an ASSOCIATION edge with empty label by default', () => {
      const edge = createEdge('ASSOCIATION', 'e1', 'e2');
      expect(edge.type).toBe('ASSOCIATION');
      expect(edge.sourceNodeId).toBe('e1');
      expect(edge.targetNodeId).toBe('e2');
      expect('label' in edge && edge.label).toBe('');
    });

    it('creates an ASSOCIATION edge with provided label', () => {
      const edge = createEdge('ASSOCIATION', 'e1', 'e2', { label: 'places' } as any);
      expect('label' in edge && edge.label).toBe('places');
    });

    it('throws for unknown node type', () => {
      expect(() => createNode('CLASS')).toThrow('Unknown Domain Model Diagram node type');
    });

    it('throws for unknown edge type', () => {
      expect(() => createEdge('INHERITANCE', 'e1', 'e2')).toThrow('Unknown Domain Model Diagram edge type');
    });
  });
});
