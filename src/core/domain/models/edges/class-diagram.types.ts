import type { BaseDomainEdge, Multiplicable, Labelable } from './base.types';

/**
 * Class Diagram Edge Types (Discriminated Union)
 */
export type ClassDiagramEdgeType = 
  | 'ASSOCIATION' 
  | 'INHERITANCE' 
  | 'IMPLEMENTATION' 
  | 'DEPENDENCY' 
  | 'AGGREGATION' 
  | 'COMPOSITION'
  | 'NOTE_LINK';

/**
 * Association Edge (SSOT Domain Model)
 */
export interface AssociationEdge extends BaseDomainEdge, Multiplicable, Labelable {
  type: 'ASSOCIATION';
  isNavigable?: boolean;
  isBidirectional?: boolean;
}

/**
 * Inheritance Edge (SSOT Domain Model)
 */
export interface InheritanceEdge extends BaseDomainEdge {
  type: 'INHERITANCE';
}

/**
 * Implementation Edge (SSOT Domain Model)
 */
export interface ImplementationEdge extends BaseDomainEdge {
  type: 'IMPLEMENTATION';
}

/**
 * Dependency Edge (SSOT Domain Model)
 */
export interface DependencyEdge extends BaseDomainEdge, Labelable {
  type: 'DEPENDENCY';
  stereotype?: string; // e.g., «use», «call», «instantiate»
}

/**
 * Aggregation Edge (SSOT Domain Model)
 */
export interface AggregationEdge extends BaseDomainEdge, Multiplicable, Labelable {
  type: 'AGGREGATION';
}

/**
 * Composition Edge (SSOT Domain Model)
 */
export interface CompositionEdge extends BaseDomainEdge, Multiplicable, Labelable {
  type: 'COMPOSITION';
}

/**
 * Note Link Edge (SSOT Domain Model)
 */
export interface NoteLinkEdge extends BaseDomainEdge {
  type: 'NOTE_LINK';
}

/**
 * Discriminated Union of all Class Diagram edges
 */
export type ClassDiagramEdge = 
  | AssociationEdge 
  | InheritanceEdge 
  | ImplementationEdge 
  | DependencyEdge 
  | AggregationEdge 
  | CompositionEdge
  | NoteLinkEdge;
