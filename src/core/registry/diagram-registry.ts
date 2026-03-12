import type {
  DiagramTypeRegistry,
  DiagramRegistryMap,
} from './diagram-registry.types';
import type { DiagramType } from '../domain/workspace/diagram-file.types';
import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type {
  ClassNode,
  InterfaceNode,
  AbstractClassNode,
  EnumNode,
  NoteNode,
} from '../domain/models/nodes/class-diagram.types';
import type {
  ActorNode,
  UseCaseNode,
  SystemBoundaryNode,
} from '../domain/models/nodes/use-case.types';
import type {
  AssociationEdge,
  InheritanceEdge,
  ImplementationEdge,
  DependencyEdge,
  AggregationEdge,
  CompositionEdge,
  NoteLinkEdge,
} from '../domain/models/edges/class-diagram.types';
import type {
  UseCaseAssociationEdge,
  IncludeEdge,
  ExtendEdge,
  GeneralizationEdge,
} from '../domain/models/edges/use-case.types';
import { classDiagramValidator } from '../validation/class-diagram.validator';
import { useCaseDiagramValidator } from '../validation/use-case.validator';

/**
 * Factory function for creating Class Diagram nodes.
 */
function createClassDiagramNode(
  type: string,
  partial?: Partial<DomainNode>
): DomainNode {
  const now = Date.now();
  const baseNode = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...partial,
  };

  switch (type) {
    case 'CLASS':
      return {
        ...baseNode,
        type: 'CLASS',
        name: partial?.['name'] || 'NewClass',
        attributes: [],
        methods: [],
      } as ClassNode;

    case 'INTERFACE':
      return {
        ...baseNode,
        type: 'INTERFACE',
        name: partial?.['name'] || 'NewInterface',
        methods: [],
      } as InterfaceNode;

    case 'ABSTRACT_CLASS':
      return {
        ...baseNode,
        type: 'ABSTRACT_CLASS',
        name: partial?.['name'] || 'NewAbstractClass',
        attributes: [],
        methods: [],
      } as AbstractClassNode;

    case 'ENUM':
      return {
        ...baseNode,
        type: 'ENUM',
        name: partial?.['name'] || 'NewEnum',
        literals: [],
      } as EnumNode;

    case 'NOTE':
      return {
        ...baseNode,
        type: 'NOTE',
        content: partial?.['content'] || 'New note',
      } as NoteNode;

    default:
      throw new Error(`Unknown Class Diagram node type: ${type}`);
  }
}

/**
 * Factory function for creating Class Diagram edges.
 */
function createClassDiagramEdge(
  type: string,
  sourceId: string,
  targetId: string,
  partial?: Partial<DomainEdge>
): DomainEdge {
  const now = Date.now();
  const baseEdge = {
    id: crypto.randomUUID(),
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };

  switch (type) {
    case 'ASSOCIATION':
      return {
        ...baseEdge,
        type: 'ASSOCIATION',
      } as AssociationEdge;

    case 'INHERITANCE':
      return {
        ...baseEdge,
        type: 'INHERITANCE',
      } as InheritanceEdge;

    case 'IMPLEMENTATION':
      return {
        ...baseEdge,
        type: 'IMPLEMENTATION',
      } as ImplementationEdge;

    case 'DEPENDENCY':
      return {
        ...baseEdge,
        type: 'DEPENDENCY',
      } as DependencyEdge;

    case 'AGGREGATION':
      return {
        ...baseEdge,
        type: 'AGGREGATION',
      } as AggregationEdge;

    case 'COMPOSITION':
      return {
        ...baseEdge,
        type: 'COMPOSITION',
      } as CompositionEdge;

    case 'NOTE_LINK':
      return {
        ...baseEdge,
        type: 'NOTE_LINK',
      } as NoteLinkEdge;

    default:
      throw new Error(`Unknown Class Diagram edge type: ${type}`);
  }
}

/**
 * Factory function for creating Use Case Diagram nodes.
 */
function createUseCaseDiagramNode(
  type: string,
  partial?: Partial<DomainNode>
): DomainNode {
  const now = Date.now();
  const baseNode = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...partial,
  };

  switch (type) {
    case 'ACTOR':
      return {
        ...baseNode,
        type: 'ACTOR',
        name: partial?.['name'] || 'NewActor',
      } as ActorNode;

    case 'USE_CASE':
      return {
        ...baseNode,
        type: 'USE_CASE',
        name: partial?.['name'] || 'NewUseCase',
      } as UseCaseNode;

    case 'SYSTEM_BOUNDARY':
      return {
        ...baseNode,
        type: 'SYSTEM_BOUNDARY',
        name: partial?.['name'] || 'System',
        containedUseCaseIds: [],
      } as SystemBoundaryNode;

    default:
      throw new Error(`Unknown Use Case Diagram node type: ${type}`);
  }
}

/**
 * Factory function for creating Use Case Diagram edges.
 */
function createUseCaseDiagramEdge(
  type: string,
  sourceId: string,
  targetId: string,
  partial?: Partial<DomainEdge>
): DomainEdge {
  const now = Date.now();
  const baseEdge = {
    id: crypto.randomUUID(),
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };

  switch (type) {
    case 'ASSOCIATION':
      return {
        ...baseEdge,
        type: 'ASSOCIATION',
      } as UseCaseAssociationEdge;

    case 'INCLUDE':
      return {
        ...baseEdge,
        type: 'INCLUDE',
      } as IncludeEdge;

    case 'EXTEND':
      return {
        ...baseEdge,
        type: 'EXTEND',
      } as ExtendEdge;

    case 'GENERALIZATION':
      return {
        ...baseEdge,
        type: 'GENERALIZATION',
      } as GeneralizationEdge;

    default:
      throw new Error(`Unknown Use Case Diagram edge type: ${type}`);
  }
}

/**
 * Class Diagram Registry Entry
 */
const classDiagramRegistry: DiagramTypeRegistry = {
  type: 'CLASS_DIAGRAM',
  displayName: 'Class Diagram',
  icon: 'box',

  supportedNodeTypes: ['CLASS', 'INTERFACE', 'ABSTRACT_CLASS', 'ENUM', 'NOTE'],
  supportedEdgeTypes: [
    'ASSOCIATION',
    'INHERITANCE',
    'IMPLEMENTATION',
    'DEPENDENCY',
    'AGGREGATION',
    'COMPOSITION',
    'NOTE_LINK',
  ],

  defaultNodeType: 'CLASS',
  defaultEdgeType: 'ASSOCIATION',

  validator: classDiagramValidator,

  factories: {
    createNode: createClassDiagramNode,
    createEdge: createClassDiagramEdge,
  },
};

/**
 * Use Case Diagram Registry Entry
 */
const useCaseDiagramRegistry: DiagramTypeRegistry = {
  type: 'USE_CASE_DIAGRAM',
  displayName: 'Use Case Diagram',
  icon: 'users',

  supportedNodeTypes: ['ACTOR', 'USE_CASE', 'SYSTEM_BOUNDARY'],
  supportedEdgeTypes: ['ASSOCIATION', 'INCLUDE', 'EXTEND', 'GENERALIZATION'],

  defaultNodeType: 'USE_CASE',
  defaultEdgeType: 'ASSOCIATION',

  validator: useCaseDiagramValidator,

  factories: {
    createNode: createUseCaseDiagramNode,
    createEdge: createUseCaseDiagramEdge,
  },
};

/**
 * Global Diagram Registry (Singleton)
 * 
 * This is the central registry for all diagram types in the application.
 * Each diagram type registers its capabilities, validators, and factory functions.
 */
export const diagramRegistry: DiagramRegistryMap = {
  CLASS_DIAGRAM: classDiagramRegistry,
  USE_CASE_DIAGRAM: useCaseDiagramRegistry,
};

/**
 * Helper function to get a diagram registry entry by type.
 * Throws an error if the diagram type is not registered.
 */
export function getDiagramRegistry(diagramType: DiagramType): DiagramTypeRegistry {
  const registry = diagramRegistry[diagramType];
  
  if (!registry) {
    throw new Error(`Diagram type not registered: ${diagramType}`);
  }
  
  return registry;
}

/**
 * Helper function to check if a diagram type is registered.
 */
export function isDiagramTypeRegistered(diagramType: string): diagramType is DiagramType {
  return diagramType in diagramRegistry;
}

/**
 * Helper function to get all registered diagram types.
 */
export function getRegisteredDiagramTypes(): DiagramType[] {
  return Object.keys(diagramRegistry) as DiagramType[];
}
