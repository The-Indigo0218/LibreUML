import type { DomainEdge } from '../../../core/domain/models/edges';
import type { CSSProperties } from 'react';

/**
 * View Model for an edge - wraps domain ID with UI concerns.
 * This is what React Flow consumes.
 */
export interface EdgeView<TDomain extends DomainEdge = DomainEdge> {
  // Reference to domain entity (SSOT)
  domainId: string;
  
  // React Flow required properties
  id: string; // Same as domainId
  source: string; // View node ID (same as domain node ID)
  target: string; // View node ID (same as domain node ID)
  type?: string; // React Flow edge type (e.g., "umlEdge")
  
  // UI-specific properties
  sourceHandle?: string | null;
  targetHandle?: string | null;
  style?: CSSProperties;
  animated?: boolean;
  label?: string;
  
  // Optional UI state
  selected?: boolean;
  
  // React Flow marker configuration
  markerEnd?: string | {
    type: string;
    width?: number;
    height?: number;
    color?: string;
  };
  
  // React Flow internal
  data?: {
    domainId: string;
    isHovered?: boolean;
  };
}

/**
 * Type-safe view model for specific domain types
 */
export type AssociationEdgeView = EdgeView<Extract<DomainEdge, { type: 'ASSOCIATION' }>>;
export type InheritanceEdgeView = EdgeView<Extract<DomainEdge, { type: 'INHERITANCE' }>>;
