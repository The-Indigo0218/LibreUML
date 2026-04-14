/**
 * DiagramIOService.integration.test.ts
 * 
 * Integration tests for DiagramIOService
 * Tests the complete export/import flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagramIOService } from '../DiagramIOService';
import { DiagramSerializer } from '../serialization/DiagramSerializer';
import { DiagramDeserializer } from '../serialization/DiagramDeserializer';
import { DiagramValidator } from '../validation/DiagramValidator';
import { ModelExtractor } from '../extraction/ModelExtractor';
import { FormatDetector } from '../serialization/FormatDetector';
import type { VFSStore } from '../../../store/project-vfs.store';
import type { ModelStore } from '../../../store/model.store';
import type { VFSFile, DiagramView, SemanticModel, LibreUMLProject } from '../../../core/domain/vfs/vfs.types';

describe('DiagramIOService - Integration', () => {
  let service: DiagramIOService;
  let mockVFSStore: Partial<VFSStore>;
  let mockModelStore: Partial<ModelStore>;

  const createMockProject = (): LibreUMLProject => ({
    id: 'project-1',
    projectName: 'Test Project',
    version: '1.0.0',
    domainModelId: 'model-1',
    nodes: {
      'file-1': {
        id: 'file-1',
        name: 'TestDiagram.luml',
        type: 'FILE',
        parentId: null,
        diagramType: 'CLASS_DIAGRAM',
        extension: '.luml',
        isExternal: false,
        content: {
          diagramId: 'file-1',
          nodes: [
            { id: 'node-1', elementId: 'class-1', x: 100, y: 200 },
            { id: 'node-2', elementId: 'class-2', x: 300, y: 200 },
          ],
          edges: [
            { id: 'edge-1', relationId: 'rel-1', waypoints: [] },
          ],
        } as DiagramView,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as VFSFile,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const createMockModel = (): SemanticModel => ({
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
    packageNames: ['com.example.domain'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  beforeEach(() => {
    // Setup mock stores
    mockVFSStore = {
      project: createMockProject(),
    };

    mockModelStore = {
      model: createMockModel(),
    };

    // Create service with real dependencies
    const serializer = new DiagramSerializer();
    const formatDetector = new FormatDetector();
    const deserializer = new DiagramDeserializer(formatDetector);
    const validator = new DiagramValidator();
    const extractor = new ModelExtractor();

    service = new DiagramIOService(
      serializer,
      deserializer,
      validator,
      extractor,
      () => mockVFSStore as VFSStore,
      () => mockModelStore as ModelStore,
    );

    // Mock browser APIs
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    document.createElement = vi.fn((tag) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          style: { display: '' },
          click: vi.fn(),
        } as any;
      }
      return {} as any;
    });
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
  });

  describe('Export Flow', () => {
    it('should export diagram successfully', async () => {
      await service.exportDiagram('file-1');

      // Verify download was triggered
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should extract only referenced elements', async () => {
      // Spy on ModelExtractor
      const extractSpy = vi.spyOn(ModelExtractor.prototype, 'extractPartialModel');

      await service.exportDiagram('file-1');

      expect(extractSpy).toHaveBeenCalled();
      const result = extractSpy.mock.results[0].value;

      // Should include class-1 and class-2 (referenced in diagram)
      expect(result.classes['class-1']).toBeDefined();
      expect(result.classes['class-2']).toBeDefined();

      // Should NOT include class-3 (not referenced)
      expect(result.classes['class-3']).toBeUndefined();
    });

    it('should validate diagram before export', async () => {
      const validateSpy = vi.spyOn(DiagramValidator.prototype, 'validate');

      await service.exportDiagram('file-1');

      expect(validateSpy).toHaveBeenCalled();
    });

    it('should throw error for invalid diagram', async () => {
      // Create invalid diagram (orphaned edge)
      const invalidProject = createMockProject();
      (invalidProject.nodes['file-1'] as VFSFile).content = {
        diagramId: 'file-1',
        nodes: [
          { id: 'node-1', elementId: 'class-1', x: 100, y: 200 },
        ],
        edges: [
          { id: 'edge-1', relationId: 'rel-999', waypoints: [] }, // Invalid relation
        ],
      } as DiagramView;

      mockVFSStore.project = invalidProject;

      await expect(service.exportDiagram('file-1')).rejects.toThrow('validation failed');
    });

    it('should throw error for non-existent file', async () => {
      await expect(service.exportDiagram('non-existent')).rejects.toThrow();
    });

    it('should throw error when no project is loaded', async () => {
      mockVFSStore.project = null;

      await expect(service.exportDiagram('file-1')).rejects.toThrow('No active project');
    });
  });

  describe('Import Flow', () => {
    it('should import diagram successfully', async () => {
      // Create a valid JSON file
      const payload = {
        _lumlVersion: '2.0',
        exportType: 'diagram',
        diagramId: 'imported-diagram',
        diagramName: 'Imported Diagram',
        model: {
          id: 'model-1',
          name: 'Imported Model',
          version: '1.0.0',
          packages: {},
          classes: {
            'class-1': {
              id: 'class-1',
              kind: 'CLASS',
              name: 'ImportedClass',
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
        },
        view: {
          diagramId: 'imported-diagram',
          nodes: [
            { id: 'node-1', elementId: 'class-1', x: 100, y: 200 },
          ],
          edges: [],
        },
      };

      const jsonContent = JSON.stringify(payload);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const file = new File([blob], 'imported.luml');

      const result = await service.importDiagram(file);

      expect(result.name).toBe('Imported Diagram');
      expect(result.view.nodes).toHaveLength(1);
      expect(result.model.classes['class-1']).toBeDefined();
    });

    it('should validate imported diagram', async () => {
      const validateSpy = vi.spyOn(DiagramValidator.prototype, 'validate');

      const payload = {
        _lumlVersion: '2.0',
        exportType: 'diagram',
        diagramId: 'test',
        diagramName: 'Test',
        model: createMockModel(),
        view: {
          diagramId: 'test',
          nodes: [{ id: 'node-1', elementId: 'class-1', x: 100, y: 200 }],
          edges: [],
        },
      };

      const jsonContent = JSON.stringify(payload);
      const blob = new Blob([jsonContent]);
      const file = new File([blob], 'test.luml');

      await service.importDiagram(file);

      expect(validateSpy).toHaveBeenCalled();
    });

    it('should throw error for invalid imported diagram', async () => {
      // Create invalid payload (orphaned node)
      const invalidPayload = {
        _lumlVersion: '2.0',
        exportType: 'diagram',
        diagramId: 'test',
        diagramName: 'Test',
        model: {
          id: 'model-1',
          name: 'Test',
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
        },
        view: {
          diagramId: 'test',
          nodes: [
            { id: 'node-1', elementId: 'class-999', x: 100, y: 200 }, // Invalid element
          ],
          edges: [],
        },
      };

      const jsonContent = JSON.stringify(invalidPayload);
      const blob = new Blob([jsonContent]);
      const file = new File([blob], 'invalid.luml');

      await expect(service.importDiagram(file)).rejects.toThrow('validation failed');
    });
  });

  describe('Round-trip (Export + Import)', () => {
    it('should preserve all data in round-trip', async () => {
      const RealBlob = global.Blob;
      let exportedContent = '';
      global.Blob = class MockBlob {
        constructor(parts: any[]) {
          exportedContent = parts[0];
        }
      } as any;

      // Export
      await service.exportDiagram('file-1');

      // Restore real Blob before import
      global.Blob = RealBlob;

      // Import
      const blob = new Blob([exportedContent], { type: 'application/json' });
      const file = new File([blob], 'roundtrip.luml');
      const imported = await service.importDiagram(file);

      // Verify data preservation
      expect(imported.name).toBe('TestDiagram');
      expect(imported.view.nodes).toHaveLength(2);
      expect(imported.view.edges).toHaveLength(1);
      expect(imported.model.classes['class-1']).toBeDefined();
      expect(imported.model.classes['class-2']).toBeDefined();
      expect(imported.model.relations['rel-1']).toBeDefined();

      // Verify visual properties
      expect(imported.view.nodes[0].x).toBe(100);
      expect(imported.view.nodes[0].y).toBe(200);
    });
  });
});
