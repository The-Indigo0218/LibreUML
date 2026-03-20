import type { DiagramValidator } from './diagram-registry.types';

/**
 * Validation registry for diagram-specific validators
 */
export interface ValidationRegistry {
  [diagramType: string]: DiagramValidator;
}
