/**
 * FormatDetector.test.ts
 * 
 * Unit tests for FormatDetector service
 */

import { describe, it, expect } from 'vitest';
import { FormatDetector } from '../serialization/FormatDetector';

describe('FormatDetector', () => {
  const detector = new FormatDetector();

  describe('detectFormat', () => {
    it('should detect JSON format', async () => {
      const jsonContent = JSON.stringify({
        _lumlVersion: '2.0',
        exportType: 'diagram',
        diagramId: 'test-123',
        diagramName: 'Test Diagram',
        model: {},
        view: { nodes: [], edges: [] },
      });

      const blob = new Blob([jsonContent], { type: 'application/json' });
      const file = new File([blob], 'test.luml', { type: 'application/json' });

      const format = await detector.detectFormat(file);

      expect(format).toBe('json');
    });

    it('should detect ZIP format', async () => {
      // Create a minimal ZIP file signature
      // ZIP files start with PK\x03\x04
      const zipSignature = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
      const blob = new Blob([zipSignature], { type: 'application/zip' });
      const file = new File([blob], 'test.luml', { type: 'application/zip' });

      const format = await detector.detectFormat(file);

      expect(format).toBe('zip');
    });

    it('should throw error for invalid format', async () => {
      const invalidContent = 'This is not JSON or ZIP';
      const blob = new Blob([invalidContent], { type: 'text/plain' });
      const file = new File([blob], 'test.txt', { type: 'text/plain' });

      await expect(detector.detectFormat(file)).rejects.toThrow();
    });

    it('should throw error for empty file', async () => {
      const blob = new Blob([], { type: 'application/octet-stream' });
      const file = new File([blob], 'empty.luml');

      await expect(detector.detectFormat(file)).rejects.toThrow();
    });
  });

  describe('isJsonFormat', () => {
    it('should return true for valid JSON', async () => {
      const jsonContent = JSON.stringify({ test: 'data' });
      const blob = new Blob([jsonContent]);
      const file = new File([blob], 'test.json');

      const result = await detector.isJsonFormat(file);

      expect(result).toBe(true);
    });

    it('should return false for invalid JSON', async () => {
      const invalidJson = '{ invalid json }';
      const blob = new Blob([invalidJson]);
      const file = new File([blob], 'test.json');

      const result = await detector.isJsonFormat(file);

      expect(result).toBe(false);
    });

    it('should return false for non-JSON content', async () => {
      const content = 'Plain text content';
      const blob = new Blob([content]);
      const file = new File([blob], 'test.txt');

      const result = await detector.isJsonFormat(file);

      expect(result).toBe(false);
    });
  });

  describe('isZipFormat', () => {
    it('should return true for ZIP signature', async () => {
      const zipSignature = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
      const blob = new Blob([zipSignature]);
      const file = new File([blob], 'test.zip');

      const result = await detector.isZipFormat(file);

      expect(result).toBe(true);
    });

    it('should return false for non-ZIP content', async () => {
      const content = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const blob = new Blob([content]);
      const file = new File([blob], 'test.bin');

      const result = await detector.isZipFormat(file);

      expect(result).toBe(false);
    });

    it('should return false for file smaller than 4 bytes', async () => {
      const content = new Uint8Array([0x50, 0x4B]);
      const blob = new Blob([content]);
      const file = new File([blob], 'test.bin');

      const result = await detector.isZipFormat(file);

      expect(result).toBe(false);
    });
  });
});
