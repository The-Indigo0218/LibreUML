import type { DomainNode } from '../../../core/domain/models/nodes';

/**
 * View Model for a node - wraps domain ID with UI concerns.
 * This is what React Flow consumes.
 * 
 * CRITICAL: The domain data is NOT duplicated here.
 * We only store the ID and UI-specific properties.
 */
export interface NodeView<_TDomain extends DomainNode = DomainNode> {
  // Reference to domain entity (SSOT)
  domainId: string;
  
  // React Flow required properties
  id: string; // Same as domainId for simplicity
  type: string; // React Flow node type (e.g., "classNode", "actorNode")
  
  // UI-specific properties (NOT in domain)
  position: {
    x: number;
    y: number;
  };
  
  // Optional UI state
  selected?: boolean;
  dragging?: boolean;
  width?: number;
  height?: number;
  
  // React Flow internal (managed by library)
  data?: {
    domainId: string; // Redundant but required by React Flow
  };
}

/**
 * Type-safe view model for specific domain types
 */
export type ClassNodeView = NodeView<Extract<DomainNode, { type: 'CLASS' }>>;
export type InterfaceNodeView = NodeView<Extract<DomainNode, { type: 'INTERFACE' }>>;
export type ActorNodeView = NodeView<Extract<DomainNode, { type: 'ACTOR' }>>;
export type UseCaseNodeView = NodeView<Extract<DomainNode, { type: 'USE_CASE' }>>;
