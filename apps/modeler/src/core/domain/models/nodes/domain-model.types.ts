import type { BaseDomainNode, Documentable } from './base.types';

export type DomainModelNodeType = 'DOMAIN_ENTITY';

export interface DomainEntityAttribute {
  id: string;
  name: string;
}

export interface DomainEntityNode extends BaseDomainNode, Documentable {
  type: 'DOMAIN_ENTITY';
  name: string;
  attributes: DomainEntityAttribute[];
}

export type DomainModelDiagramNode = DomainEntityNode;
