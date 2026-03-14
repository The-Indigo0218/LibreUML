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
        name: (partial && 'name' in partial ? partial.name : undefined) || 'NewClass',
        attributes: [],
        methods: [],
      } as ClassNode;

    case 'INTERFACE':
      return {
        ...baseNode,
        type: 'INTERFACE',
        name: (partial && 'name' in partial ? partial.name : undefined) || 'NewInterface',
        methods: [],
      } as InterfaceNode;

    case 'ABSTRACT_CLASS':
      return {
        ...baseNode,
        type: 'ABSTRACT_CLASS',
        name: (partial && 'name' in partial ? partial.name : undefined) || 'NewAbstractClass',
        attributes: [],
        methods: [],
      } as AbstractClassNode;

    case 'ENUM':
      return {
        ...baseNode,
        type: 'ENUM',
        name: (partial && 'name' in partial ? partial.name : undefined) || 'NewEnum',
        literals: [],
      } as EnumNode;

    case 'NOTE':
      return {
        ...baseNode,
        type: 'NOTE',
        content: (partial && 'content' in partial ? partial.content : undefined) || 'New note',
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
        name: (partial && 'name' in partial ? partial.name : undefined) || 'NewActor',
      } as ActorNode;

    case 'USE_CASE':
      return {
        ...baseNode,
        type: 'USE_CASE',
        name: (partial && 'name' in partial ? partial.name : undefined) || 'NewUseCase',
      } as UseCaseNode;

    case 'SYSTEM_BOUNDARY':
      return {
        ...baseNode,
        type: 'SYSTEM_BOUNDARY',
        name: (partial && 'name' in partial ? partial.name : undefined) || 'System',
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

  tools: {
    nodes: [
      {
        id: 'class',
        type: 'NODE',
        label: 'Class',
        icon: 'Box',
        color: 'var(--color-uml-class-border)',
        translationKey: 'sidebar.nodes.class',
      },
      {
        id: 'interface',
        type: 'NODE',
        label: 'Interface',
        icon: 'CircleDot',
        color: 'var(--color-uml-interface-border)',
        translationKey: 'sidebar.nodes.interface',
      },
      {
        id: 'abstract',
        type: 'NODE',
        label: 'Abstract Class',
        icon: 'BoxSelect',
        color: 'var(--color-uml-abstract-border)',
        translationKey: 'sidebar.nodes.abstract',
      },
      {
        id: 'enum',
        type: 'NODE',
        label: 'Enum',
        icon: 'List',
        color: '#A855F7',
        translationKey: 'sidebar.nodes.enum',
      },
      {
        id: 'note',
        type: 'NODE',
        label: 'Note',
        icon: 'StickyNote',
        color: 'var(--color-uml-note-border)',
        translationKey: 'sidebar.nodes.note',
      },
    ],
    edges: [
      {
        id: 'association',
        type: 'EDGE',
        label: 'Association',
        icon: 'MoveRight',
        translationKey: 'sidebar.connections.association',
      },
      {
        id: 'inheritance',
        type: 'EDGE',
        label: 'Inheritance',
        icon: 'ArrowUp',
        translationKey: 'sidebar.connections.inheritance',
      },
      {
        id: 'implementation',
        type: 'EDGE',
        label: 'Implementation',
        icon: 'ArrowUpRight',
        translationKey: 'sidebar.connections.implementation',
      },
      {
        id: 'dependency',
        type: 'EDGE',
        label: 'Dependency',
        icon: 'GitCommitHorizontal',
        translationKey: 'sidebar.connections.dependency',
      },
      {
        id: 'aggregation',
        type: 'EDGE',
        label: 'Aggregation',
        icon: 'Diamond',
        translationKey: 'sidebar.connections.aggregation',
      },
      {
        id: 'composition',
        type: 'EDGE',
        label: 'Composition',
        icon: 'Diamond',
        translationKey: 'sidebar.connections.composition',
      },
    ],
  },

  codeGenerationActions: [
    {
      id: 'generate-class',
      label: 'Generate Java Class',
      translationKey: 'menubar.code.generateClass',
      icon: 'FileCode',
      enabled: true,
    },
    {
      id: 'generate-project',
      label: 'Generate Project',
      translationKey: 'menubar.code.generateProject',
      icon: 'Package',
      enabled: true,
    },
    {
      id: 'import-java',
      label: 'Import Java Code',
      translationKey: 'menubar.code.importJava',
      icon: 'Upload',
      enabled: true,
    },
  ],

  exportActions: [
    {
      id: 'export-image',
      label: 'Export Image',
      translationKey: 'menubar.export.image',
      icon: 'ImageIcon',
      enabled: true,
    },
    {
      id: 'export-xmi',
      label: 'Export XMI',
      translationKey: 'menubar.export.xmi',
      icon: 'FileCode2',
      enabled: true,
    },
  ],

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

  tools: {
    nodes: [
      {
        id: 'actor',
        type: 'NODE',
        label: 'Actor',
        icon: 'User',
        color: '#10B981',
        translationKey: 'sidebar.nodes.actor',
      },
      {
        id: 'use_case',
        type: 'NODE',
        label: 'Use Case',
        icon: 'Circle',
        color: '#3B82F6',
        translationKey: 'sidebar.nodes.useCase',
      },
      {
        id: 'system_boundary',
        type: 'NODE',
        label: 'System Boundary',
        icon: 'Square',
        color: '#8B5CF6',
        translationKey: 'sidebar.nodes.systemBoundary',
      },
    ],
    edges: [
      {
        id: 'association',
        type: 'EDGE',
        label: 'Association',
        icon: 'MoveRight',
        translationKey: 'sidebar.connections.association',
      },
      {
        id: 'include',
        type: 'EDGE',
        label: 'Include',
        icon: 'ArrowRight',
        translationKey: 'sidebar.connections.include',
      },
      {
        id: 'extend',
        type: 'EDGE',
        label: 'Extend',
        icon: 'ArrowUpRight',
        translationKey: 'sidebar.connections.extend',
      },
      {
        id: 'generalization',
        type: 'EDGE',
        label: 'Generalization',
        icon: 'ArrowUp',
        translationKey: 'sidebar.connections.generalization',
      },
    ],
  },

  codeGenerationActions: [],

  exportActions: [
    {
      id: 'export-image',
      label: 'Export Image',
      translationKey: 'menubar.export.image',
      icon: 'ImageIcon',
      enabled: true,
    },
  ],

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
