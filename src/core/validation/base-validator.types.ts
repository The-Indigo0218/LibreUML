import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { ValidationResult } from '../registry/diagram-registry.types';

/**
 * Base validator interface
 */
export interface BaseValidator {
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string
  ): ValidationResult;
  
  validateNode(node: DomainNode): ValidationResult;
  
  validateEdge(
    edge: DomainEdge,
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult;
}
