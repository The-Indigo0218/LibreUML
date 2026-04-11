/**
 * DiagramDeserializer.test.ts
 *
 * Unit tests for DiagramDeserializer service
 */

import { describe, it, expect, vi } from 'vitest';
import { DiagramDeserializer } from '../serialization/DiagramDeserializer';
import type { FormatDetector } from '../serialization/FormatDetector';
import type { DiagramPayload } from '../serialization/DiagramSerializer';

const createMockFormatDetector = (): FormatDetector =>
  ({
    detect: vi.fn(),
    detectFormat: vi.fn(),
    isJsonFormat: vi.fn(),
    isZipFormat: vi.fn(),
    detectWithInfo: vi.fn(),
  }) as unknown as FormatDetector;

describe('DiagramDeserializer', () => {
  describe('deserialize - JSON format', () => {
    it('should deserialize valid JSON payload', async () => {
      const payload: DiagramPayload = {
        _lumlVersion: '2.0',
        exportType: 'diagram',
        diagramId: 'test-123',
        diagramName: 'Test Diagram',
        model: {
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
        },
        view: {
          diagramId: 'test-123',
          nodes: [
            { id: 'node-1', elementId: 'class-1', x: 100, y: 200 },
          ],
          edges: [],
        },
      };

      const jsonContent = JSON.stringify(payload);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const file = new File([blob], 'test.luml');

      const formatDetector = createMockFormatDetector();
      const deserializer = new DiagramDeserializer(formatDetector);

      const result = await deserializer.deserialize(file, 'json');

      expect(result.diagramId).toBe('test-123');
      expect(result.diagramName).toBe('Test Diagram');
      expect(result.model).toBeDefined();
      expect(result.view).toBeDefined();
      expect(result.view.nodes).toHaveLength(1);
    });

    it('should throw error for invalid JSON', async () => {
      const invalidJson = '{ invalid json }';
      const blob = new Blob([invalidJson]);
      const file = new File([blob], 'test.luml');

      const formatDetector = createMockFormatDetector();
      const deserializer = new DiagramDeserializer(formatDetector);

      await expect(deserializer.deserialize(file, 'json')).rejects.toThrow();
    });

    it('should throw error for missing required fields', async () => {
      const incompletePayload = {
        _lumlVersion: '2.0',
        exportType: 'diagram',
        // Missing diagramId, diagramName, model, view
      };

      const jsonContent = JSON.stringify(incompletePayload);
      const blob = new Blob([jsonContent]);
      const file = new File([blob], 'test.luml');

      const formatDetector = createMockFormatDetector();
      const deserializer = new DiagramDeserializer(formatDetector);

      await expect(deserializer.deserialize(file, 'json')).rejects.toThrow();
    });

    it('should validate exportType is "diagram"', async () => {
      const wrongTypePayload = {
        _lumlVersion: '2.0',
        exportType: 'project',
        diagramId: 'test-123',
        diagramName: 'Test',
        model: {},
        view: { nodes: [], edges: [] },
      };

      const jsonContent = JSON.stringify(wrongTypePayload);
      const blob = new Blob([jsonContent]);
      const file = new File([blob], 'test.luml');

      const formatDetector = createMockFormatDetector();
      const deserializer = new DiagramDeserializer(formatDetector);

      await expect(deserializer.deserialize(file, 'json')).rejects.toThrow();
    });
  });

  describe('detectFormat', () => {
    it('should delegate to FormatDetector', async () => {
      const blob = new Blob(['test']);
      const file = new File([blob], 'test.luml');

      const formatDetector = createMockFormatDetector();
      vi.mocked(formatDetector.detectFormat).mockResolvedValue('json');

      const deserializer = new DiagramDeserializer(formatDetector);
      const format = await deserializer.detectFormat(file);

      expect(format).toBe('json');
      expect(formatDetector.detectFormat).toHaveBeenCalledWith(file);
    });
  });
});
