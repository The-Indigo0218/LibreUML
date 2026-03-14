import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { ValidationResult } from '../registry/diagram-registry.types';

/**
 * Base validator interface for UML diagram validation
 */
export interface BaseValidator {
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string,
    existingEdges?: DomainEdge[],
    allNodes?: Record<string, DomainNode>
  ): ValidationResult;
  
  validateNode(node: DomainNode): ValidationResult;
  
  validateEdge(
    edge: DomainEdge,
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult;
}
