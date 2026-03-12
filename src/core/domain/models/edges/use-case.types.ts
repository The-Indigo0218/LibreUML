import type { BaseDomainEdge, Labelable } from './base.types';

/**
 * Use Case Diagram Edge Types (Discriminated Union)
 */
export type UseCaseDiagramEdgeType = 
  | 'ASSOCIATION' 
  | 'INCLUDE' 
  | 'EXTEND' 
  | 'GENERALIZATION';

/**
 * Association Edge (Actor ↔ Use Case)
 */
export interface UseCaseAssociationEdge extends BaseDomainEdge {
  type: 'ASSOCIATION';
}

/**
 * Include Edge (Use Case → Use Case)
 */
export interface IncludeEdge extends BaseDomainEdge {
  type: 'INCLUDE';
}

/**
 * Extend Edge (Use Case → Use Case)
 */
export interface ExtendEdge extends BaseDomainEdge, Labelable {
  type: 'EXTEND';
  condition?: string; // Extension condition
  extensionPoint?: string;
}

/**
 * Generalization Edge (Actor → Actor or Use Case → Use Case)
 */
export interface GeneralizationEdge extends BaseDomainEdge {
  type: 'GENERALIZATION';
}

/**
 * Discriminated Union of all Use Case Diagram edges
 */
export type UseCaseDiagramEdge = 
  | UseCaseAssociationEdge 
  | IncludeEdge 
  | ExtendEdge 
  | GeneralizationEdge;
