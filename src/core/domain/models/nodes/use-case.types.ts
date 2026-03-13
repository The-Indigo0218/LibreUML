import type { BaseDomainNode, Documentable } from './base.types';

/**
 * Use Case Diagram Node Types (Discriminated Union)
 */
export type UseCaseDiagramNodeType = 
  | 'ACTOR' 
  | 'USE_CASE' 
  | 'SYSTEM_BOUNDARY';

/**
 * Actor Node (SSOT Domain Model)
 */
export interface ActorNode extends BaseDomainNode, Documentable {
  type: 'ACTOR';
  name: string;
  isPrimary?: boolean; // Primary vs Secondary actor
}

/**
 * Use Case Node (SSOT Domain Model)
 */
export interface UseCaseNode extends BaseDomainNode, Documentable {
  type: 'USE_CASE';
  name: string;
  description?: string;
  extensionPoints?: string[];
}

/**
 * System Boundary Node (SSOT Domain Model)
 */
export interface SystemBoundaryNode extends BaseDomainNode, Documentable {
  type: 'SYSTEM_BOUNDARY';
  name: string;
  containedUseCaseIds: string[]; // References to use cases inside boundary
}

/**
 * Discriminated Union of all Use Case Diagram nodes
 */
export type UseCaseDiagramNode = 
  | ActorNode 
  | UseCaseNode 
  | SystemBoundaryNode;
