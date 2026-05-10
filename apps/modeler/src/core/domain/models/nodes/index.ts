export * from './base.types';
export * from './class-diagram.types';
export * from './use-case.types';
export * from './domain-model.types';

import type { ClassDiagramNode } from './class-diagram.types';
import type { UseCaseDiagramNode } from './use-case.types';
import type { DomainModelDiagramNode } from './domain-model.types';

export type DomainNode =
  | ClassDiagramNode
  | UseCaseDiagramNode
  | DomainModelDiagramNode;

export const isClassDiagramNode = (node: DomainNode): node is ClassDiagramNode => {
  return ['CLASS', 'INTERFACE', 'ABSTRACT_CLASS', 'ENUM', 'NOTE'].includes(node.type);
};

export const isUseCaseDiagramNode = (node: DomainNode): node is UseCaseDiagramNode => {
  return ['ACTOR', 'USE_CASE', 'SYSTEM_BOUNDARY'].includes(node.type);
};

export const isDomainModelDiagramNode = (node: DomainNode): node is DomainModelDiagramNode => {
  return node.type === 'DOMAIN_ENTITY';
};
