export * from './base.types';
export * from './class-diagram.types';
export * from './use-case.types';

import type { ClassDiagramEdge } from './class-diagram.types';
import type { UseCaseDiagramEdge } from './use-case.types';

/**
 * Universal Domain Edge (all diagram types)
 */
export type DomainEdge = 
  | ClassDiagramEdge 
  | UseCaseDiagramEdge;
