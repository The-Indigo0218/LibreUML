/**
 * diagram/index.ts
 * 
 * Main entry point for the diagram I/O module
 * 
 * Exports:
 * - DiagramIOService (main service)
 * - getDiagramIOService (helper to get instance)
 * - Types and errors
 */

// Main service
export { DiagramIOService } from './DiagramIOService';
export type { ParsedDiagram } from './DiagramIOService';
export { DiagramExportError, DiagramImportError } from './DiagramIOService';

// Factory
export { getDiagramIOService, diagramIOServiceFactory } from './DiagramIOServiceFactory';

// Serialization
export { DiagramSerializer, LUML_FORMAT_VERSION } from './serialization/DiagramSerializer';
export type { DiagramPayload } from './serialization/DiagramSerializer';
export { SerializationError } from './serialization/DiagramSerializer';

export { DiagramDeserializer } from './serialization/DiagramDeserializer';
export { DeserializationError } from './serialization/DiagramDeserializer';

export { FormatDetector } from './serialization/FormatDetector';
export type { DiagramFormat, DetectedFormatInfo } from './serialization/FormatDetector';
export { FormatDetectionError } from './serialization/FormatDetector';

// Validation
export { DiagramValidator } from './validation/DiagramValidator';
export type { ValidationResult } from './validation/DiagramValidator';

// Extraction
export { ModelExtractor } from './extraction/ModelExtractor';
export type { PartialSemanticModel } from './extraction/ModelExtractor';
