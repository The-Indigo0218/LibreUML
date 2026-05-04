export * from './base.types';
export * from './class-diagram.types';
export * from './use-case.types';

import type { ClassDiagramNode } from './class-diagram.types';
import type { UseCaseDiagramNode } from './use-case.types';

/**
 * Universal Domain Node (all diagram types)
 */
export type DomainNode = 
  | ClassDiagramNode 
  | UseCaseDiagramNode;

/**
 * Type guard utilities
 */
export const isClassDiagramNode = (node: DomainNode): node is ClassDiagramNode => {
  return ['CLASS', 'INTERFACE', 'ABSTRACT_CLASS', 'ENUM', 'NOTE'].includes(node.type);
};

export const isUseCaseDiagramNode = (node: DomainNode): node is UseCaseDiagramNode => {
  return ['ACTOR', 'USE_CASE', 'SYSTEM_BOUNDARY'].includes(node.type);
};
