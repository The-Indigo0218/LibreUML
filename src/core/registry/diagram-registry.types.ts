import type { DiagramType } from '../domain/workspace/diagram-file.types';
import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';

/**
 * Tool type for UI rendering
 */
export type ToolType = 'NODE' | 'EDGE';

/**
 * Tool configuration for UI rendering in Sidebar
 */
export interface ToolConfig {
  id: string;
  type: ToolType;
  label: string;
  icon: string; // Lucide icon name
  color?: string; // CSS color value
  translationKey?: string; // i18n key for label
}

/**
 * Code generation action configuration
 */
export interface CodeGenerationAction {
  id: string;
  label: string;
  translationKey?: string;
  icon: string; // Lucide icon name
  enabled: boolean;
}

/**
 * Export action configuration
 */
export interface ExportAction {
  id: string;
  label: string;
  translationKey?: string;
  icon: string; // Lucide icon name
  enabled: boolean;
}

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
  
  // UI Tool configurations for Sidebar rendering
  tools: {
    nodes: ToolConfig[];
    edges: ToolConfig[];
  };
  
  // Code generation actions available for this diagram type
  codeGenerationActions: CodeGenerationAction[];
  
  // Export actions available for this diagram type
  exportActions: ExportAction[];
  
  // PHASE 3: React Flow component registry
  // Maps React Flow node/edge type strings to their React components
  nodeComponents: Record<string, React.ComponentType<any>>;
  edgeComponents: Record<string, React.ComponentType<any>>;
  
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
