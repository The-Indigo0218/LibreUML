import type { DiagramType } from '../domain/workspace/diagram-file.types';
import type { DiagramValidator } from './diagram-registry.types';

/**
 * Validation registry for diagram-specific validators
 */
export interface ValidationRegistry {
  [diagramType: string]: DiagramValidator;
}
