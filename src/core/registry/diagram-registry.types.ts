import type { DiagramType } from '../domain/workspace/diagram-file.types';
import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';

/**
 * Registry entry for a diagram type.
 * Each diagram type registers its capabilities.
 */
export interface DiagramTypeRegistry {
  type: DiagramType;
  displayName: string;
  icon?: string;
  
  // Node types this diagram supports
  supportedNodeTypes: string[];
  
  // Edge types this diagram supports
  supportedEdgeTypes: string[];
  
  // Default node type when creating new nodes
  defaultNodeType: string;
  
  // Default edge type when creating new edges
  defaultEdgeType: string;
  
  // Validation rules
  validator: DiagramValidator;
  
  // Factory functions
  factories: {
    createNode: (type: string, partial?: Partial<DomainNode>) => DomainNode;
    createEdge: (type: string, sourceId: string, targetId: string, partial?: Partial<DomainEdge>) => DomainEdge;
  };
}

/**
 * Validator interface for diagram-specific rules
 */
export interface DiagramValidator {
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string,
    existingEdges?: DomainEdge[],
    allNodes?: Record<string, DomainNode>
  ): ValidationResult;
  
  validateNode(node: DomainNode): ValidationResult;
  
  validateEdge(edge: DomainEdge, sourceNode: DomainNode, targetNode: DomainNode): ValidationResult;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Global diagram registry (singleton)
 */
export interface DiagramRegistryMap {
  [key: string]: DiagramTypeRegistry;
}
