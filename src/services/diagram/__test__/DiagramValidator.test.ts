/**
 * DiagramValidator.test.ts
 * 
 * Unit tests for DiagramValidator service
 */

import { describe, it, expect } from 'vitest';
import { DiagramValidator } from '../validation/DiagramValidator';
import type { DiagramView, SemanticModel } from '../../../core/domain/vfs/vfs.types';

describe('DiagramValidator', () => {
  const validator = new DiagramValidator();

  const createValidModel = (): SemanticModel => ({
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
    relations: {
      'rel-1': {
        id: 'rel-1',
        kind: 'ASSOCIATION',
        sourceId: 'class-1',
        targetId: 'class-1',
      },
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  describe('validate', () => {
    it('should validate a correct diagram', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100 },
        ],
        edges: [
          { id: 'edge-1', relationId: 'rel-1', waypoints: [] },
        ],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing nodes array', () => {
      const view = {
        diagramId: 'test-diagram',
        edges: [],
      } as unknown as DiagramView;

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('View must have a nodes array');
    });

    it('should detect missing edges array', () => {
      const view = {
        diagramId: 'test-diagram',
        nodes: [],
      } as unknown as DiagramView;

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('View must have an edges array');
    });

    it('should detect orphaned nodes (elementId not in model)', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100 },
          { id: 'node-2', elementId: 'class-999', x: 200, y: 200 },
        ],
        edges: [],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Node node-2 references non-existent element class-999');
    });

    it('should detect orphaned edges (relationId not in model)', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100 },
        ],
        edges: [
          { id: 'edge-1', relationId: 'rel-999', waypoints: [] },
        ],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Edge edge-1 references non-existent relation rel-999');
    });

    it('should allow nodes without elementId (notes)', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: '', x: 100, y: 100, content: 'This is a note' },
        ],
        edges: [],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate node IDs', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100 },
          { id: 'node-1', elementId: 'class-1', x: 200, y: 200 },
        ],
        edges: [],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate node ID: node-1');
    });

    it('should detect duplicate edge IDs', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100 },
        ],
        edges: [
          { id: 'edge-1', relationId: 'rel-1', waypoints: [] },
          { id: 'edge-1', relationId: 'rel-1', waypoints: [] },
        ],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate edge ID: edge-1');
    });

    it('should warn about empty diagram', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [],
        edges: [],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Diagram is empty (no nodes)');
    });

    it('should validate nodes with package hierarchy', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'pkg-1', elementId: '', x: 0, y: 0, width: 500, height: 500, packageName: 'com.example' },
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100, parentPackageId: 'pkg-1' },
        ],
        edges: [],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid parentPackageId', () => {
      const view: DiagramView = {
        diagramId: 'test-diagram',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 100, parentPackageId: 'pkg-999' },
        ],
        edges: [],
      };

      const model = createValidModel();
      const result = validator.validate(view, model);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Node node-1 references non-existent parent package pkg-999');
    });
  });
});
