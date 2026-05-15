import type { BaseDomainEdge, Multiplicable } from './base.types';

export type DomainModelEdgeType = 'ASSOCIATION';

export interface DomainAssociationEdge extends BaseDomainEdge, Multiplicable {
  type: 'ASSOCIATION';
  label: string;
}

export type DomainModelDiagramEdge = DomainAssociationEdge;
