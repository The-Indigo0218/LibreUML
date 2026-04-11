/**
 * DiagramSerializer.test.ts
 * 
 * Unit tests for DiagramSerializer service
 */

import { describe, it, expect } from 'vitest';
import { DiagramSerializer, LUML_FORMAT_VERSION } from '../serialization/DiagramSerializer';
import type { DiagramPayload } from '../serialization/DiagramSerializer';
import type { DiagramView, SemanticModel } from '../../../core/domain/vfs/vfs.types';

describe('DiagramSerializer', () => {
  const serializer = new DiagramSerializer();

  const createTestPayload = (): DiagramPayload => {
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const view: DiagramView = {
      diagramId: 'diagram-1',
      nodes: [
        { id: 'node-1', elementId: 'class-1', x: 100, y: 200 },
      ],
      edges: [],
    };

    return DiagramSerializer.createPayload({
      diagramId: 'diagram-1',
      diagramName: 'Test Diagram',
      model,
      view,
    });
  };

  describe('createPayload', () => {
    it('should create a valid payload', () => {
      const payload = createTestPayload();

      expect(payload._lumlVersion).toBe(LUML_FORMAT_VERSION);
      expect(payload.exportType).toBe('diagram');
      expect(payload.diagramId).toBe('diagram-1');
      expect(payload.diagramName).toBe('Test Diagram');
      expect(payload.model).toBeDefined();
      expect(payload.view).toBeDefined();
    });

    it('should include all required fields', () => {
      const payload = createTestPayload();

      expect(payload).toHaveProperty('_lumlVersion');
      expect(payload).toHaveProperty('exportType');
      expect(payload).toHaveProperty('diagramId');
      expect(payload).toHaveProperty('diagramName');
      expect(payload).toHaveProperty('model');
      expect(payload).toHaveProperty('view');
    });
  });

  describe('serialize', () => {
    it('should serialize payload to JSON string', () => {
      const payload = createTestPayload();
      const json = serializer.serialize(payload);

      expect(typeof json).toBe('string');
      expect(json.length).toBeGreaterThan(0);
    });

    it('should produce valid JSON', () => {
      const payload = createTestPayload();
      const json = serializer.serialize(payload);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should preserve all data when serialized and parsed', () => {
      const payload = createTestPayload();
      const json = serializer.serialize(payload);
      const parsed = JSON.parse(json);

      expect(parsed._lumlVersion).toBe(payload._lumlVersion);
      expect(parsed.exportType).toBe(payload.exportType);
      expect(parsed.diagramId).toBe(payload.diagramId);
      expect(parsed.diagramName).toBe(payload.diagramName);
      expect(parsed.model.classes['class-1'].name).toBe('User');
      expect(parsed.view.nodes[0].x).toBe(100);
      expect(parsed.view.nodes[0].y).toBe(200);
    });

    it('should format JSON with indentation', () => {
      const payload = createTestPayload();
      const json = serializer.serialize(payload);

      // Should contain newlines (formatted)
      expect(json).toContain('\n');
      // Should contain indentation
      expect(json).toMatch(/\n  /);
    });

    it('should handle complex model structures', () => {
      const complexModel: SemanticModel = {
        id: 'model-1',
        name: 'Complex Model',
        version: '1.0.0',
        packages: {},
        classes: {
          'class-1': {
            id: 'class-1',
            kind: 'CLASS',
            name: 'User',
            packageName: 'com.example.domain',
            attributeIds: ['attr-1'],
            operationIds: ['op-1'],
            visibility: 'public',
            isAbstract: false,
          },
        },
        interfaces: {
          'interface-1': {
            id: 'interface-1',
            kind: 'INTERFACE',
            name: 'IRepository',
            operationIds: ['op-2'],
            visibility: 'public',
          },
        },
        enums: {
          'enum-1': {
            id: 'enum-1',
            kind: 'ENUM',
            name: 'Status',
            literals: [{ name: 'ACTIVE' }, { name: 'INACTIVE' }],
            visibility: 'public',
          },
        },
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
          'op-2': {
            id: 'op-2',
            kind: 'OPERATION',
            name: 'save',
            returnType: 'void',
            visibility: 'public',
            parameters: [{ name: 'entity', type: 'Object', isArray: false }],
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
            kind: 'REALIZATION',
            sourceId: 'class-1',
            targetId: 'interface-1',
          },
        },
        packageNames: ['com.example.domain'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const view: DiagramView = {
        diagramId: 'diagram-1',
        nodes: [
          { id: 'pkg-1', elementId: '', x: 0, y: 0, width: 500, height: 500, packageName: 'com.example.domain' },
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100, parentPackageId: 'pkg-1' },
          { id: 'node-2', elementId: 'interface-1', x: 300, y: 100 },
          { id: 'node-3', elementId: 'enum-1', x: 100, y: 300 },
        ],
        edges: [
          { id: 'edge-1', relationId: 'rel-1', waypoints: [] },
        ],
      };

      const payload = DiagramSerializer.createPayload({
        diagramId: 'diagram-1',
        diagramName: 'Complex Diagram',
        model: complexModel,
        view,
      });

      const json = serializer.serialize(payload);
      const parsed = JSON.parse(json);

      expect(parsed.model.classes['class-1'].packageName).toBe('com.example.domain');
      expect(parsed.model.interfaces['interface-1'].name).toBe('IRepository');
      expect(parsed.model.enums['enum-1'].literals).toHaveLength(2);
      expect(parsed.view.nodes).toHaveLength(4);
      expect(parsed.view.nodes[1].parentPackageId).toBe('pkg-1');
    });
  });
});
