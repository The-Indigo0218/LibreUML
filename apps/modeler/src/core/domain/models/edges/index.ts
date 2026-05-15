export * from './base.types';
export * from './class-diagram.types';
export * from './use-case.types';
export * from './domain-model.types';

import type { ClassDiagramEdge } from './class-diagram.types';
import type { UseCaseDiagramEdge } from './use-case.types';
import type { DomainModelDiagramEdge } from './domain-model.types';

export type DomainEdge =
  | ClassDiagramEdge
  | UseCaseDiagramEdge
  | DomainModelDiagramEdge;
