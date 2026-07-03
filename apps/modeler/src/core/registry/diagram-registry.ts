import type {
  DiagramTypeRegistry,
  DiagramRegistryMap,
  ToolConfig,
} from './diagram-registry.types';
import type { DiagramType, SemanticModel, ResolvedElement } from '../domain/vfs/vfs.types';
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
  UCModuleNode,
} from '../domain/models/nodes/use-case.types';
import type {
  AssociationEdge,
  InheritanceEdge,
  ImplementationEdge,
  DependencyEdge,
  AggregationEdge,
  CompositionEdge,
  NoteLinkEdge,
  PackageImportEdge,
  PackageAccessEdge,
  PackageMergeEdge,
} from '../domain/models/edges/class-diagram.types';
import type {
  UseCaseAssociationEdge,
  IncludeEdge,
  ExtendEdge,
  GeneralizationEdge,
} from '../domain/models/edges/use-case.types';
import type { DomainEntityNode } from '../domain/models/nodes/domain-model.types';
import type { DomainAssociationEdge } from '../domain/models/edges/domain-model.types';
import type {
  LifelineNode,
} from '../domain/models/nodes/sequence-diagram.types';
import type {
  SyncMessageEdge,
  AsyncMessageEdge,
  ReplyMessageEdge,
  CreateMessageEdge,
  DestroyMessageEdge,
} from '../domain/models/edges/sequence-diagram.types';
import { classDiagramValidator } from '../validation/class-diagram.validator';
import { useCaseDiagramValidator } from '../validation/use-case.validator';
import { domainModelDiagramValidator } from '../validation/domain-model.validator';
import { sequenceDiagramValidator } from '../validation/sequence-diagram.validator';


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

    case 'PACKAGE_IMPORT':
      return {
        ...baseEdge,
        type: 'PACKAGE_IMPORT',
      } as PackageImportEdge;

    case 'PACKAGE_ACCESS':
      return {
        ...baseEdge,
        type: 'PACKAGE_ACCESS',
      } as PackageAccessEdge;

    case 'PACKAGE_MERGE':
      return {
        ...baseEdge,
        type: 'PACKAGE_MERGE',
      } as PackageMergeEdge;

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

    case 'UC_MODULE':
      return {
        ...baseNode,
        type: 'UC_MODULE',
        name: (partial && 'name' in partial ? partial.name : undefined) || 'Module',
      } as UCModuleNode;

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
    'PACKAGE_IMPORT',
    'PACKAGE_ACCESS',
    'PACKAGE_MERGE',
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

  nodeComponents: {},
  edgeComponents: {},

  validator: classDiagramValidator,

  factories: {
    createNode: createClassDiagramNode,
    createEdge: createClassDiagramEdge,
  },

  semanticLookup: (model: SemanticModel, id: string): ResolvedElement | null => {
    const cls = model.classes[id];
    if (cls) return { element: cls, kind: cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS' };
    const iface = model.interfaces[id];
    if (iface) return { element: iface, kind: 'INTERFACE' };
    const enm = model.enums[id];
    if (enm) return { element: enm, kind: 'ENUM' };
    const pkg = model.packages[id];
    if (pkg) return { element: pkg, kind: 'PACKAGE' };
    return null;
  },
};

/**
 * Use Case Diagram Registry Entry
 */
const useCaseDiagramRegistry: DiagramTypeRegistry = {
  type: 'USE_CASE_DIAGRAM',
  displayName: 'Use Case Diagram',
  icon: 'users',

  supportedNodeTypes: ['ACTOR', 'USE_CASE', 'SYSTEM_BOUNDARY', 'UC_MODULE'],
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
      {
        id: 'uc_module',
        type: 'NODE',
        label: 'Module',
        icon: 'Package',
        color: '#0d9488',
        translationKey: 'sidebar.nodes.ucModule',
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
    {
      id: 'export-xmi',
      label: 'Export XMI',
      translationKey: 'menubar.export.xmi',
      icon: 'FileCode2',
      enabled: true,
    },
  ],

  nodeComponents: {},
  edgeComponents: {},

  validator: useCaseDiagramValidator,

  factories: {
    createNode: createUseCaseDiagramNode,
    createEdge: createUseCaseDiagramEdge,
  },

  semanticLookup: (model: SemanticModel, id: string): ResolvedElement | null => {
    const actor = model.actors?.[id];
    if (actor) return { element: actor, kind: 'ACTOR' };
    const uc = model.useCases?.[id];
    if (uc) return { element: uc, kind: 'USECASE' };
    const sb = model.systemBoundaries?.[id];
    if (sb) return { element: sb, kind: 'SYSTEM_BOUNDARY' };
    const ucm = model.ucModules?.[id];
    if (ucm) return { element: ucm, kind: 'UC_MODULE' };
    return null;
  },
};

/**
 * Factory function for creating Domain Model Diagram nodes.
 */
function createDomainModelDiagramNode(
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
    case 'DOMAIN_ENTITY':
      return {
        ...baseNode,
        type: 'DOMAIN_ENTITY',
        name: (partial && 'name' in partial ? partial.name : undefined) || 'Entity',
        attributes: [],
      } as DomainEntityNode;

    default:
      throw new Error(`Unknown Domain Model Diagram node type: ${type}`);
  }
}

/**
 * Factory function for creating Domain Model Diagram edges.
 */
function createDomainModelDiagramEdge(
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
        label: (partial && 'label' in partial ? (partial as Partial<DomainAssociationEdge>).label : undefined) || '',
      } as DomainAssociationEdge;

    default:
      throw new Error(`Unknown Domain Model Diagram edge type: ${type}`);
  }
}

/**
 * Domain Model Diagram Registry Entry
 */
const domainModelDiagramRegistry: DiagramTypeRegistry = {
  type: 'DOMAIN_MODEL_DIAGRAM',
  displayName: 'Domain Model',
  icon: 'network',

  supportedNodeTypes: ['DOMAIN_ENTITY'],
  supportedEdgeTypes: ['ASSOCIATION'],

  defaultNodeType: 'DOMAIN_ENTITY',
  defaultEdgeType: 'ASSOCIATION',

  tools: {
    nodes: [
      {
        id: 'domain_entity',
        type: 'NODE',
        label: 'Entity',
        icon: 'Box',
        color: '#F59E0B',
        translationKey: 'sidebar.nodes.domainEntity',
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
        id: 'generalization',
        type: 'EDGE',
        label: 'Generalization',
        icon: 'ArrowUp',
        translationKey: 'sidebar.connections.generalization',
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

  codeGenerationActions: [],

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

  nodeComponents: {},
  edgeComponents: {},

  validator: domainModelDiagramValidator,

  factories: {
    createNode: createDomainModelDiagramNode,
    createEdge: createDomainModelDiagramEdge,
  },

  semanticLookup: (model: SemanticModel, id: string): ResolvedElement | null => {
    const de = model.domainEntities?.[id];
    if (de) return { element: de, kind: 'DOMAIN_ENTITY' };
    return null;
  },
};

/**
 * Factory function for creating Sequence Diagram nodes.
 */
function createSequenceDiagramNode(
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
    case 'LIFELINE':
      return {
        ...baseNode,
        type: 'LIFELINE',
        name: (partial && 'name' in partial ? partial.name : undefined) || 'Lifeline',
        participantKind:
          (partial && 'participantKind' in partial
            ? (partial as Partial<LifelineNode>).participantKind
            : undefined) || 'ANONYMOUS',
      } as LifelineNode;

    case 'NOTE':
      return {
        ...baseNode,
        type: 'NOTE',
        content: (partial && 'content' in partial ? partial.content : undefined) || 'New note',
      } as NoteNode;

    default:
      throw new Error(`Unknown Sequence Diagram node type: ${type}`);
  }
}

function createSequenceDiagramEdge(
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
    case 'MESSAGE_SYNC':
      return { ...baseEdge, type: 'MESSAGE_SYNC' } as SyncMessageEdge;
    case 'MESSAGE_ASYNC':
      return { ...baseEdge, type: 'MESSAGE_ASYNC' } as AsyncMessageEdge;
    case 'MESSAGE_REPLY':
      return { ...baseEdge, type: 'MESSAGE_REPLY' } as ReplyMessageEdge;
    case 'MESSAGE_CREATE':
      return { ...baseEdge, type: 'MESSAGE_CREATE' } as CreateMessageEdge;
    case 'MESSAGE_DESTROY':
      return { ...baseEdge, type: 'MESSAGE_DESTROY' } as DestroyMessageEdge;
    default:
      throw new Error(`Unknown Sequence Diagram edge type: ${type}`);
  }
}

/**
 * Sequence Diagram Registry Entry
 */
const sequenceDiagramRegistry: DiagramTypeRegistry = {
  type: 'SEQUENCE_DIAGRAM',
  displayName: 'Sequence Diagram',
  icon: 'arrow-right-left',

  supportedNodeTypes: ['LIFELINE', 'NOTE'],
  supportedEdgeTypes: [
    'MESSAGE_SYNC',
    'MESSAGE_ASYNC',
    'MESSAGE_REPLY',
    'MESSAGE_CREATE',
    'MESSAGE_DESTROY',
  ],

  defaultNodeType: 'LIFELINE',
  defaultEdgeType: 'MESSAGE_SYNC',

  // Class/use-case/domain tools are never meaningful inside an interaction.
  hideForeignTools: true,

  tools: {
    nodes: [
      {
        id: 'lifeline',
        type: 'NODE',
        label: 'Lifeline',
        icon: 'User',
        color: '#6366F1',
        translationKey: 'sidebar.nodes.lifeline',
      },
      {
        id: 'actor_lifeline',
        type: 'NODE',
        label: 'Actor',
        icon: 'PersonStanding',
        color: '#6366F1',
        translationKey: 'sidebar.nodes.actorLifeline',
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
        id: 'message_sync',
        type: 'EDGE',
        label: 'Sync Message',
        icon: 'ArrowRight',
        translationKey: 'sidebar.connections.messageSync',
      },
      {
        id: 'message_async',
        type: 'EDGE',
        label: 'Async Message',
        icon: 'MoveRight',
        translationKey: 'sidebar.connections.messageAsync',
      },
      {
        id: 'message_reply',
        type: 'EDGE',
        label: 'Reply',
        icon: 'CornerDownLeft',
        translationKey: 'sidebar.connections.messageReply',
      },
      {
        id: 'message_create',
        type: 'EDGE',
        label: 'Create Message',
        icon: 'PlusCircle',
        translationKey: 'sidebar.connections.messageCreate',
      },
      {
        id: 'message_destroy',
        type: 'EDGE',
        label: 'Destroy Message',
        icon: 'XCircle',
        translationKey: 'sidebar.connections.messageDestroy',
      },
    ],
    // Combined-fragment operators (UML 2.5 §17.6). Click-to-insert; the common
    // three lead, the remaining nine sit under the "advanced" disclosure. The
    // label is the canonical operator keyword (language-neutral, as in EA/StarUML).
    fragments: [
      { id: 'frag-alt',      type: 'FRAGMENT', fragmentKind: 'ALT',      category: 'common',   label: 'alt',      icon: 'GitBranch',           color: '#6366F1' },
      { id: 'frag-opt',      type: 'FRAGMENT', fragmentKind: 'OPT',      category: 'common',   label: 'opt',      icon: 'CircleHelp',          color: '#6366F1' },
      { id: 'frag-loop',     type: 'FRAGMENT', fragmentKind: 'LOOP',     category: 'common',   label: 'loop',     icon: 'Repeat',              color: '#6366F1' },
      { id: 'frag-par',      type: 'FRAGMENT', fragmentKind: 'PAR',      category: 'advanced', label: 'par',      icon: 'Columns2',            color: '#818CF8' },
      { id: 'frag-seq',      type: 'FRAGMENT', fragmentKind: 'SEQ',      category: 'advanced', label: 'seq',      icon: 'ListOrdered',         color: '#818CF8' },
      { id: 'frag-strict',   type: 'FRAGMENT', fragmentKind: 'STRICT',   category: 'advanced', label: 'strict',   icon: 'ArrowDownNarrowWide', color: '#818CF8' },
      { id: 'frag-break',    type: 'FRAGMENT', fragmentKind: 'BREAK',    category: 'advanced', label: 'break',    icon: 'Scissors',            color: '#818CF8' },
      { id: 'frag-critical', type: 'FRAGMENT', fragmentKind: 'CRITICAL', category: 'advanced', label: 'critical', icon: 'ShieldAlert',         color: '#818CF8' },
      { id: 'frag-neg',      type: 'FRAGMENT', fragmentKind: 'NEG',      category: 'advanced', label: 'neg',      icon: 'Ban',                 color: '#818CF8' },
      { id: 'frag-assert',   type: 'FRAGMENT', fragmentKind: 'ASSERT',   category: 'advanced', label: 'assert',   icon: 'BadgeCheck',          color: '#818CF8' },
      { id: 'frag-ignore',   type: 'FRAGMENT', fragmentKind: 'IGNORE',   category: 'advanced', label: 'ignore',   icon: 'EyeOff',              color: '#818CF8' },
      { id: 'frag-consider', type: 'FRAGMENT', fragmentKind: 'CONSIDER', category: 'advanced', label: 'consider', icon: 'Eye',                 color: '#818CF8' },
    ],
    // Click-to-insert structural extras. `ref` reuses another interaction;
    // found/lost are endpoint messages (open outside the interaction) and sit
    // under "advanced" since they default to the first lifeline.
    structure: [
      { id: 'ref',         type: 'STRUCTURE', category: 'common',   label: 'ref',   icon: 'Frame',       color: '#6366F1' },
      { id: 'msg-found',   type: 'STRUCTURE', category: 'advanced', label: 'found', icon: 'LogIn',       color: '#818CF8' },
      { id: 'msg-lost',    type: 'STRUCTURE', category: 'advanced', label: 'lost',  icon: 'LogOut',      color: '#818CF8' },
      { id: 'gen-ordering', type: 'STRUCTURE', category: 'advanced', label: 'order',    icon: 'ArrowDownUp', color: '#818CF8' },
      { id: 'duration',     type: 'STRUCTURE', category: 'advanced', label: 'duration', icon: 'Timer',       color: '#818CF8' },
      { id: 'time',         type: 'STRUCTURE', category: 'advanced', label: 'time',     icon: 'Clock',       color: '#818CF8' },
      { id: 'coregion',     type: 'STRUCTURE', category: 'advanced', label: 'coregion', icon: 'Brackets',    color: '#818CF8' },
      { id: 'continuation', type: 'STRUCTURE', category: 'advanced', label: 'continuation', icon: 'Flag',    color: '#818CF8' },
    ],
  },

  codeGenerationActions: [
    {
      id: 'generate-stubs',
      label: 'Generate Operation Stubs',
      translationKey: 'menubar.code.generateStubs',
      icon: 'FileCode',
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

  nodeComponents: {},
  edgeComponents: {},

  validator: sequenceDiagramValidator,

  factories: {
    createNode: createSequenceDiagramNode,
    createEdge: createSequenceDiagramEdge,
  },

  semanticLookup: (model: SemanticModel, id: string): ResolvedElement | null => {
    const ll = model.lifelines?.[id];
    if (ll) return { element: ll, kind: 'LIFELINE' };
    return null;
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
  DOMAIN_MODEL_DIAGRAM: domainModelDiagramRegistry,
  SEQUENCE_DIAGRAM: sequenceDiagramRegistry,
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

/** Aggregated, de-duplicated tool lists across every registered diagram type. */
export interface AggregatedTools {
  nodes: ToolConfig[];
  edges: ToolConfig[];
}

/**
 * Merges the `tools.nodes`/`tools.edges` of every registered diagram type into a
 * single de-duplicated palette (first occurrence of each tool id wins). Lets the
 * ToolPalette expose every tool regardless of the active diagram type; the drop
 * guard (useKonvaDnD) decides what to do when a tool the active diagram doesn't
 * own is dropped onto the canvas.
 */
export function getAllTools(): AggregatedTools {
  const nodes = new Map<string, ToolConfig>();
  const edges = new Map<string, ToolConfig>();
  for (const type of getRegisteredDiagramTypes()) {
    const reg = diagramRegistry[type];
    for (const tool of reg.tools.nodes) if (!nodes.has(tool.id)) nodes.set(tool.id, tool);
    for (const tool of reg.tools.edges) if (!edges.has(tool.id)) edges.set(tool.id, tool);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/**
 * The set of node-tool ids that the given diagram type natively owns. Used by the
 * palette to mark "foreign" tools and by the drop guard to decide whether a
 * dropped stereotype belongs to the active diagram. Unknown/unregistered types
 * yield an empty set.
 */
export function getNativeNodeToolIds(diagramType: DiagramType): Set<string> {
  const reg = diagramRegistry[diagramType];
  return new Set(reg ? reg.tools.nodes.map((t) => t.id) : []);
}

/**
 * The subset of DiagramType values that have a registry entry (i.e. are
 * implemented). Use this instead of the full DiagramType union wherever the
 * code must only handle diagram types that are actually available.
 */
export type RegisteredDiagramType = keyof typeof diagramRegistry;
