/**
 * DiagramSerializer.ts
 * 
 * Serializes a diagram to flat JSON format v2.0
 * 
 * Responsibilities:
 * - Convert DiagramPayload to JSON string
 * - Apply consistent formatting (2 spaces)
 * - Preserve ALL visual information (x, y, width, height, parentPackageId)
 * - Maintain flat and readable structure
 * - Validate that payload has all required fields
 * 
 * Output format:
 * {
 *   "_lumlVersion": "2.0",
 *   "exportType": "diagram",
 *   "diagramId": "...",
 *   "diagramName": "...",
 *   "model": { ... },
 *   "view": { ... }
 * }
 */

import type { DiagramView } from '../../../core/domain/vfs/vfs.types';
import type { PartialSemanticModel } from '../extraction/ModelExtractor';

/**
 * LUML format version
 */
export const LUML_FORMAT_VERSION = '2.0' as const;

/**
 * Export payload structure
 */
export interface DiagramPayload {
  _lumlVersion: typeof LUML_FORMAT_VERSION;
  exportType: 'diagram';
  diagramId: string;
  diagramName: string;
  model: PartialSemanticModel;
  view: DiagramView;
}

/**
 * Serialization error
 */
export class SerializationError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SerializationError';
    this.cause = cause;
  }
}

export class DiagramSerializer {
  /**
   * Serializes a diagram payload to JSON string
   * 
   * @param payload - Diagram data to serialize
   * @returns string - JSON formatted with 2 spaces
   * @throws SerializationError if payload is invalid
   * 
   * @example
   * ```typescript
   * const serializer = new DiagramSerializer();
   * const json = serializer.serialize(payload);
   * // json is a formatted JSON string
   * ```
   */
  serialize(payload: DiagramPayload): string {
    // Validate that payload has all required fields
    this.validatePayload(payload);
    
    try {
      // Serialize with consistent formatting (2 spaces)
      return JSON.stringify(payload, null, 2);
    } catch (error) {
      throw new SerializationError(
        'Failed to serialize diagram payload',
        error
      );
    }
  }

  /**
   * Validates that payload has all required fields
   * 
   * @throws SerializationError if any required field is missing
   */
  private validatePayload(payload: DiagramPayload): void {
    const errors: string[] = [];

    if (!payload._lumlVersion) {
      errors.push('Missing _lumlVersion');
    } else if (payload._lumlVersion !== LUML_FORMAT_VERSION) {
      errors.push(`Invalid _lumlVersion: expected "${LUML_FORMAT_VERSION}", got "${payload._lumlVersion}"`);
    }

    if (!payload.exportType) {
      errors.push('Missing exportType');
    } else if (payload.exportType !== 'diagram') {
      errors.push(`Invalid exportType: expected "diagram", got "${payload.exportType}"`);
    }

    if (!payload.diagramId) {
      errors.push('Missing diagramId');
    }

    if (!payload.diagramName) {
      errors.push('Missing diagramName');
    }

    if (!payload.model) {
      errors.push('Missing model');
    } else {
      // Validate basic model structure
      if (typeof payload.model !== 'object') {
        errors.push('model must be an object');
      } else {
        if (!payload.model.id) errors.push('model.id is required');
        if (!payload.model.name) errors.push('model.name is required');
        if (!payload.model.version) errors.push('model.version is required');
        if (!payload.model.classes) errors.push('model.classes is required');
        if (!payload.model.interfaces) errors.push('model.interfaces is required');
        if (!payload.model.enums) errors.push('model.enums is required');
        if (!payload.model.relations) errors.push('model.relations is required');
      }
    }

    if (!payload.view) {
      errors.push('Missing view');
    } else {
      // Validate basic view structure
      if (typeof payload.view !== 'object') {
        errors.push('view must be an object');
      } else {
        if (!Array.isArray(payload.view.nodes)) {
          errors.push('view.nodes must be an array');
        }
        if (!Array.isArray(payload.view.edges)) {
          errors.push('view.edges must be an array');
        }
      }
    }

    if (errors.length > 0) {
      throw new SerializationError(
        `Invalid diagram payload:\n${errors.map(e => `  - ${e}`).join('\n')}`
      );
    }
  }

  /**
   * Creates a valid payload from individual data
   * 
   * Helper to facilitate payload creation
   * 
   * @param params - Payload parameters
   * @returns DiagramPayload - Valid payload
   */
  static createPayload(params: {
    diagramId: string;
    diagramName: string;
    model: PartialSemanticModel;
    view: DiagramView;
  }): DiagramPayload {
    return {
      _lumlVersion: LUML_FORMAT_VERSION,
      exportType: 'diagram',
      diagramId: params.diagramId,
      diagramName: params.diagramName,
      model: params.model,
      view: params.view,
    };
  }
}
