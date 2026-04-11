/**
 * ModelExtractor.test.ts
 * 
 * Unit tests for ModelExtractor service
 */

import { describe, it, expect } from 'vitest';
import { ModelExtractor } from '../extraction/ModelExtractor';
import type { DiagramView, SemanticModel } from '../../../core/domain/vfs/vfs.types';

describe('ModelExtractor', () => {
  const extractor = new ModelExtractor();

  describe('extractPartialModel', () => {
    it('should extract only elements referenced in the diagram', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100 },
          { id: 'node-2', elementId: 'class-2', x: 200, y: 200 },
        ],
        edges: [
          { id: 'edge-1', relationId: 'rel-1', waypoints: [] },
        ],
      };

      const model: SemanticModel = {
        id: 'model-1',
        name: 'Test Model',
        version: '1.0.0',
        packages: {},
        classes: {
          'class-1': {
            id: 'class-1',
            kind: 'CLASS',
            name: 'User',
            attributeIds: ['attr-1'],
            operationIds: ['op-1'],
            visibility: 'public',
            isAbstract: false,
          },
          'class-2': {
            id: 'class-2',
            kind: 'CLASS',
            name: 'Order',
            attributeIds: [],
            operationIds: [],
            visibility: 'public',
            isAbstract: false,
          },
          'class-3': {
            id: 'class-3',
            kind: 'CLASS',
            name: 'Product',
            attributeIds: [],
            operationIds: [],
            visibility: 'public',
            isAbstract: false,
          },
        },
        interfaces: {},
        enums: {},
        dataTypes: {},
        attributes: {
          'attr-1': {
            id: 'attr-1',
            kind: 'ATTRIBUTE',
            name: 'name',
            type: 'string',
            visibility: 'private',
          },
        },
        operations: {
          'op-1': {
            id: 'op-1',
            kind: 'OPERATION',
            name: 'getName',
            returnType: 'string',
            visibility: 'public',
            parameters: [],
            isReturnArray: false,
            isStatic: false,
          },
        },
        actors: {},
        useCases: {},
        activityNodes: {},
        objectInstances: {},
        components: {},
        nodes: {},
        artifacts: {},
        relations: {
          'rel-1': {
            id: 'rel-1',
            kind: 'ASSOCIATION',
            sourceId: 'class-1',
            targetId: 'class-2',
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = extractor.extractPartialModel(view, model);

      // Should include class-1 and class-2 (referenced in nodes)
      expect(result.classes['class-1']).toBeDefined();
      expect(result.classes['class-2']).toBeDefined();
      
      // Should NOT include class-3 (not referenced)
      expect(result.classes['class-3']).toBeUndefined();

      // Should include attr-1 and op-1 (members of class-1)
      expect(result.attributes['attr-1']).toBeDefined();
      expect(result.operations['op-1']).toBeDefined();

      // Should include rel-1 (referenced in edges)
      expect(result.relations['rel-1']).toBeDefined();
    });

    it('should handle interfaces', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'interface-1', x: 100, y: 100 },
        ],
        edges: [],
      };

      const model: SemanticModel = {
        id: 'model-1',
        name: 'Test Model',
        version: '1.0.0',
        packages: {},
        classes: {},
        interfaces: {
          'interface-1': {
            id: 'interface-1',
            kind: 'INTERFACE',
            name: 'IRepository',
            operationIds: ['op-1'],
            visibility: 'public',
          },
        },
        enums: {},
        dataTypes: {},
        attributes: {},
        operations: {
          'op-1': {
            id: 'op-1',
            kind: 'OPERATION',
            name: 'save',
            returnType: 'void',
            visibility: 'public',
            parameters: [],
            isReturnArray: false,
            isStatic: false,
          },
        },
        actors: {},
        useCases: {},
        activityNodes: {},
        objectInstances: {},
        components: {},
        nodes: {},
        artifacts: {},
        relations: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = extractor.extractPartialModel(view, model);

      expect(result.interfaces['interface-1']).toBeDefined();
      expect(result.operations['op-1']).toBeDefined();
    });

    it('should handle enums', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'enum-1', x: 100, y: 100 },
        ],
        edges: [],
      };

      const model: SemanticModel = {
        id: 'model-1',
        name: 'Test Model',
        version: '1.0.0',
        packages: {},
        classes: {},
        interfaces: {},
        enums: {
          'enum-1': {
            id: 'enum-1',
            kind: 'ENUM',
            name: 'Status',
            literals: [
              { name: 'ACTIVE' },
              { name: 'INACTIVE' },
            ],
            visibility: 'public',
          },
        },
        dataTypes: {},
        attributes: {},
        operations: {},
        actors: {},
        useCases: {},
        activityNodes: {},
        objectInstances: {},
        components: {},
        nodes: {},
        artifacts: {},
        relations: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = extractor.extractPartialModel(view, model);

      expect(result.enums['enum-1']).toBeDefined();
      expect(result.enums['enum-1'].literals).toHaveLength(2);
    });

    it('should handle nodes without elementId (notes)', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: '', x: 100, y: 100, content: 'This is a note' },
        ],
        edges: [],
      };

      const model: SemanticModel = {
        id: 'model-1',
        name: 'Test Model',
        version: '1.0.0',
        packages: {},
        classes: {},
        interfaces: {},
        enums: {},
        dataTypes: {},
        attributes: {},
        operations: {},
        actors: {},
        useCases: {},
        activityNodes: {},
        objectInstances: {},
        components: {},
        nodes: {},
        artifacts: {},
        relations: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = extractor.extractPartialModel(view, model);

      // Should not throw, should return empty model
      expect(Object.keys(result.classes)).toHaveLength(0);
      expect(Object.keys(result.interfaces)).toHaveLength(0);
      expect(Object.keys(result.enums)).toHaveLength(0);
    });

    it('should extract package names from elements', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100 },
          { id: 'node-2', elementId: 'class-2', x: 200, y: 200 },
        ],
        edges: [],
      };

      const model: SemanticModel = {
        id: 'model-1',
        name: 'Test Model',
        version: '1.0.0',
        packages: {},
        classes: {
          'class-1': {
            id: 'class-1',
            kind: 'CLASS',
            name: 'User',
            packageName: 'com.example.domain',
            attributeIds: [],
            operationIds: [],
            visibility: 'public',
            isAbstract: false,
          },
          'class-2': {
            id: 'class-2',
            kind: 'CLASS',
            name: 'Order',
            packageName: 'com.example.orders',
            attributeIds: [],
            operationIds: [],
            visibility: 'public',
            isAbstract: false,
          },
        },
        interfaces: {},
        enums: {},
        dataTypes: {},
        attributes: {},
        operations: {},
        actors: {},
        useCases: {},
        activityNodes: {},
        objectInstances: {},
        components: {},
        nodes: {},
        artifacts: {},
        relations: {},
        packageNames: ['com.example.domain', 'com.example.orders', 'com.example.unused'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = extractor.extractPartialModel(view, model);

      // Should include package names from referenced elements
      expect(result.packageNames).toContain('com.example.domain');
      expect(result.packageNames).toContain('com.example.orders');
      
      // Should NOT include unused package
      expect(result.packageNames).not.toContain('com.example.unused');
    });
  });
});
