export type VFSNodeType = 'FOLDER' | 'FILE';

export type FileExtension = '.luml' | '.xmi' | '.md' | '.model' | '.json';

export type DiagramType =
  | 'CLASS_DIAGRAM'
  | 'USE_CASE_DIAGRAM'
  | 'DOMAIN_MODEL_DIAGRAM'
  | 'SEQUENCE_DIAGRAM'
  | 'ACTIVITY_DIAGRAM'
  | 'STATE_MACHINE_DIAGRAM'
  | 'COMPONENT_DIAGRAM'
  | 'DEPLOYMENT_DIAGRAM'
  | 'PACKAGE_DIAGRAM'
  | 'OBJECT_DIAGRAM'
  | 'ER_DIAGRAM'
  | 'UNSPECIFIED';

export interface VFSBaseNode {
  id: string;
  name: string;
  type: VFSNodeType;
  parentId: string | null;
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface VFSFolder extends VFSBaseNode {
  type: 'FOLDER';
}

export interface VFSFile extends VFSBaseNode {
  type: 'FILE';
  diagramType: DiagramType;
  extension: FileExtension;
  isExternal: boolean;
  isReadOnly?: boolean;
  /** When true this diagram is isolated from the global shared model workspace. */
  standalone?: boolean;
  content: unknown | null;
  /**
   * Per-file isolated SemanticModel for standalone diagrams.
   * Populated only when standalone === true. All element creation/mutation
   * in a standalone canvas writes here — never to the global useModelStore.
   */
  localModel?: SemanticModel | null;
}

export interface ViewNode {
  id: string;
  elementId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex?: number;
  color?: string;
  /** Per-node border width override. Undefined = shape default. */
  borderWidth?: number;
  /** Per-node border line style override. Undefined = solid. */
  borderStyle?: NodeBorderStyle;
  /** Per-node font family override for sans text. Undefined = shape default. */
  fontFamily?: string;
  /** Per-node base font size (px) for the node's title; other text scales with it. */
  fontSize?: number;
  /** Persisted text content for Note nodes (no IR backing element). */
  content?: string;
  /** Persisted title for Note nodes. */
  noteTitle?: string;
  parentPackageId?: string | null;
  collapsed?: boolean;
  /** Package name for package container nodes. */
  packageName?: string;
}

/**
 * How an edge's line body is routed between its two anchors.
 *   'straight'    Direct line; bends only where the user adds waypoints (default).
 *   'orthogonal'  L-shaped 90° path with obstacle avoidance.
 *   'curved'      Smooth cubic Bezier.
 * Undefined is treated as 'straight' so edges are free-form (StarUML-style) by default.
 */
export type EdgeRoutingMode = 'straight' | 'orthogonal' | 'curved';

/** Per-node border line style. */
export type NodeBorderStyle = 'solid' | 'dashed' | 'dotted';

export interface ViewEdge {
  id: string;
  relationId: string;
  waypoints: Array<{ x: number; y: number }>;
  sourceHandle?: string;
  targetHandle?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  sourceRole?: string;
  targetRole?: string;
  anchorLocked?: boolean;
  /**
   * P4 — free continuous anchor: position of the endpoint on the node's border,
   * relative to its bounding box (nx, ny ∈ [0,1]). Resolved per-endpoint and
   * takes priority over locked handles / floating. Undefined → fall back to the
   * existing chain (handle → floating → closest-pair). The 8 handles act as a
   * magnet when capturing, but the stored value is continuous.
   */
  sourceAnchor?: { nx: number; ny: number };
  targetAnchor?: { nx: number; ny: number };
  /** Line routing style. Undefined = 'straight'. */
  routingMode?: EdgeRoutingMode;
  /** Per-edge color override. Undefined = kind/base color. */
  color?: string;
  /** Per-edge line width override. Undefined = default (2px). */
  lineWidth?: number;
  /** Per-edge line style override. Undefined = kind default. */
  lineStyle?: NodeBorderStyle;
  /** Per-edge label font family override. Undefined = default. */
  fontFamily?: string;
  /** Per-edge label font size override (px). Undefined = default (11px). */
  fontSize?: number;
}

export interface DiagramView {
  diagramId: string;
  nodes: ViewNode[];
  edges: ViewEdge[];
}

export interface DiagramDescriptor {
  id: string;
  name: string;
  diagramType: DiagramType;
  modelId: string;
  elementIds: string[];
  relationIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type ProjectKind = 'SOFTWARE_ARCHITECTURE' | 'FREE';

export interface LibreUMLProject {
  id: string;
  projectName: string;
  description?: string;
  author?: string;
  version: string;
  projectKind?: ProjectKind;
  targetLanguage?: string;
  basePackage?: string;
  domainModelId: string;
  modelIds?: string[];
  semanticModel?: SemanticModel;
  nodes: Record<string, VFSFolder | VFSFile>;
  createdAt: number;
  updatedAt: number;
}

export type Visibility = 'public' | 'private' | 'protected' | 'package';

export interface TaggedValue {
  key: string;
  value: string;
}

export interface Annotation {
  name: string;
  attributes?: Record<string, string>;
}

export interface SourceRef {
  filePath?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface IRElement {
  id: string;
  name: string;
  visibility?: Visibility;
  isAbstract?: boolean;
  isStatic?: boolean;
  documentation?: string;
  stereotypes?: string[];
  taggedValues?: TaggedValue[];
  annotations?: Annotation[];
  sourceRef?: SourceRef;
}

export interface IRPackage extends IRElement {
  kind: 'PACKAGE';
  packageIds: string[];
  classIds: string[];
  interfaceIds: string[];
  enumIds: string[];
  dataTypeIds: string[];
}

export interface IRAttribute extends IRElement {
  kind: 'ATTRIBUTE';
  type: string;
  multiplicity?: string;
  defaultValue?: string;
  isDerived?: boolean;
  isReadOnly?: boolean;
}

export interface IRParameter {
  name: string;
  type: string;
  direction?: 'in' | 'out' | 'inout' | 'return';
  defaultValue?: string;
  isArray?: boolean;
}

export interface IROperation extends IRElement {
  kind: 'OPERATION';
  returnType?: string;
  parameters: IRParameter[];
  isReturnArray?: boolean;
  isQuery?: boolean;
  exceptions?: string[];
}

export interface IRClass extends IRElement {
  kind: 'CLASS';
  packageId?: string;
  packageName?: string;
  attributeIds: string[];
  operationIds: string[];
  isFinal?: boolean;
  isActive?: boolean;
  isExternal?: boolean;
  /** Generic type parameters, stored with angle brackets (e.g. "<T>"). */
  generics?: string;
}

export interface IRInterface extends IRElement {
  kind: 'INTERFACE';
  packageId?: string;
  packageName?: string;
  /** UML 2.5.1 §10.4: interfaces may own attributes as well as operations. Defaults to [] when absent (backward compat). */
  attributeIds?: string[];
  operationIds: string[];
  isExternal?: boolean;
  /** Generic type parameters, stored with angle brackets (e.g. "<T>"). */
  generics?: string;
}

export interface IREnumLiteral {
  name: string;
  value?: string;
}

export interface IREnum extends IRElement {
  kind: 'ENUM';
  packageId?: string;
  packageName?: string;
  literals: IREnumLiteral[];
  isExternal?: boolean;
}

export interface IRDataType extends IRElement {
  kind: 'DATATYPE';
  packageId?: string;
  isPrimitive?: boolean;
}

export interface IRActor extends IRElement {
  kind: 'ACTOR';
  isAbstract?: boolean;
  briefDescription?: string;
  actorType?: 'human' | 'system' | 'timer';
}

export interface UseCaseFlowStep {
  id: string;
  stepNumber: number;
  description: string;
}

export interface UseCaseAltFlow {
  id: string;
  name: string;
  trigger: string;
  steps: UseCaseFlowStep[];
}

export interface IRUseCase extends IRElement {
  kind: 'USECASE';
  extensionPoints?: string[];
  briefDescription?: string;
  preconditions?: string;
  postconditions?: string;
  trigger?: string;
  basicFlow?: UseCaseFlowStep[];
  alternativeFlows?: UseCaseAltFlow[];
}

export interface IRSystemBoundary extends IRElement {
  kind: 'SYSTEM_BOUNDARY';
}

export interface IRUCModule extends IRElement {
  kind: 'UC_MODULE';
}

export interface IRDomainAttribute extends Pick<IRElement, 'id' | 'name' | 'documentation'> {
  kind: 'DOMAIN_ATTRIBUTE';
}

export interface IRDomainEntity extends IRElement {
  kind: 'DOMAIN_ENTITY';
  attributeIds: string[];
}

export interface IRActivityNode extends IRElement {
  kind: 'ACTIVITY_NODE';
  activityType: 'ACTION' | 'DECISION' | 'MERGE' | 'FORK' | 'JOIN' | 'INITIAL' | 'FINAL';
}

export interface IRObjectInstance extends IRElement {
  kind: 'OBJECT_INSTANCE';
  classifierId: string;
  slots: Record<string, string>;
}

export interface IRComponent extends IRElement {
  kind: 'COMPONENT';
  providedInterfaces: string[];
  requiredInterfaces: string[];
}

export interface IRNode extends IRElement {
  kind: 'NODE';
  deployedComponents: string[];
}

export interface IRArtifact extends IRElement {
  kind: 'ARTIFACT';
  fileName?: string;
}

// ─── Sequence Diagram IR ──────────────────────────────────────────────────────

export type LifelineParticipantKind =
  | 'CLASS'
  | 'INTERFACE'
  | 'ACTOR'
  | 'OBJECT'
  | 'ANONYMOUS';

export interface IRLifeline extends IRElement {
  kind: 'LIFELINE';
  participantKind: LifelineParticipantKind;
  /** elementId of the IRClass / IRInterface / IRActor / IRObjectInstance this lifeline represents. */
  represents?: string;
  /** Display name when participantKind === 'ANONYMOUS' (or override for named participants). */
  alias?: string;
  isExternal?: boolean;
}

export type MessageKind =
  | 'SYNC'      // solid line, closed triangle arrowhead
  | 'ASYNC'     // solid line, open arrowhead
  | 'REPLY'     // dashed line, open arrowhead
  | 'CREATE'    // instantiates target lifeline
  | 'DESTROY';  // terminates target lifeline

export interface IRMessage extends IRElement {
  kind: 'MESSAGE';
  messageKind: MessageKind;
  sourceLifelineId: string;
  targetLifelineId: string;
  /** Chronological order within the parent fragment (or root-level). */
  sequenceNumber: number;
  /** Parent combined fragment id, or undefined when at the diagram root. */
  fragmentId?: string;
  /** Optional reference to an IROperation owned by the target's classifier. */
  operationId?: string;
  /** Free-form argument string (e.g. "id, name") for MVP. */
  arguments?: string;
  /** For REPLY messages, references the invoking message. */
  inReplyTo?: string;
  /**
   * UML 2.5 found message: the source is an unknown participant outside the
   * interaction. `sourceLifelineId` is empty; the target is a real lifeline.
   */
  isFound?: boolean;
  /**
   * UML 2.5 lost message: the target is an unknown participant outside the
   * interaction. `targetLifelineId` is empty; the source is a real lifeline.
   */
  isLost?: boolean;
  /**
   * When set, the source end of this message connects to a Gate on a fragment
   * boundary instead of a lifeline. Additive — `sourceLifelineId` is retained
   * so clearing the gate restores the original routing.
   */
  sourceGateId?: string;
  /** When set, the target end connects to a Gate (see `sourceGateId`). */
  targetGateId?: string;
}

/**
 * UML 2.5 §17.4 Gate — a connection point on a combined fragment's boundary
 * that relates a message inside the fragment to one outside it.
 */
export interface IRGate extends IRElement {
  kind: 'GATE';
  /** The combined fragment whose boundary this gate sits on. */
  ownerFragmentId: string;
  /** Which vertical edge of the owner the gate sits on. */
  side: 'LEFT' | 'RIGHT';
  /** Temporal anchor: the gate's Y, in message-slot units (mirrors invariants). */
  afterSequenceNumber: number;
}

export interface IRActivation extends IRElement {
  kind: 'ACTIVATION';
  /** Lifeline that owns this activation bar. */
  lifelineId: string;
  /** Message id that opened this activation (typically a SYNC entering the lifeline). */
  startMessageId: string;
  /** Message id that closed this activation (typically the REPLY pairing); undefined while open. */
  endMessageId?: string;
  /** When set, nests this activation inside a parent (re-entrancy). */
  parentActivationId?: string;
}

export type FragmentKind =
  | 'ALT'      // alternative (if/else) with multiple guarded operands
  | 'OPT'      // optional (single guarded operand)
  | 'LOOP'     // iteration with guard
  | 'PAR'      // parallel
  | 'SEQ'      // weak sequencing
  | 'BREAK'    // break
  | 'CRITICAL'; // critical region

export interface IRInteractionOperand {
  id: string;
  guard?: string;
  /** Messages contained in this operand (in `sequenceNumber` order). */
  messageIds: string[];
  /** Sub-fragments nested inside this operand. */
  fragmentIds: string[];
}

export interface IRInteractionFragment extends IRElement {
  kind: 'FRAGMENT';
  fragmentKind: FragmentKind;
  /** Lifelines spanned horizontally by this fragment's rectangle. */
  coveredLifelineIds: string[];
  /** Operands. ALT supports many; OPT/LOOP/PAR support one. */
  operands: IRInteractionOperand[];
  parentFragmentId?: string;
}

/**
 * UML 2.5 §17.6 InteractionUse — a `ref` fragment that references (reuses)
 * another Interaction (sequence diagram) within this one.
 */
export interface IRInteractionUse extends IRElement {
  kind: 'INTERACTION_USE';
  /** Lifelines spanned horizontally by the ref rectangle. */
  coveredLifelineIds: string[];
  /** VFS file id of the referenced SEQUENCE_DIAGRAM (undefined when external/unset). */
  referencedDiagramId?: string;
  /** Display label of the referenced interaction (falls back to `name`). */
  referencedName?: string;
  /**
   * Temporal anchor: the ref sits in the band just below the message slot with
   * this number. 0 = at the top, before the first message.
   */
  afterSequenceNumber: number;
}

/**
 * UML 2.5 §17.4 StateInvariant — a runtime constraint on the state of the
 * participant a lifeline represents, drawn as a state symbol on the lifeline
 * between two message occurrences.
 */
export interface IRStateInvariant extends IRElement {
  kind: 'STATE_INVARIANT';
  /** Lifeline this invariant constrains. */
  lifelineId: string;
  /** The runtime constraint text (rendered inside a state symbol / braces). */
  constraint: string;
  /**
   * Temporal anchor: the invariant sits just below the message slot with this
   * sequenceNumber. 0 = above the first message. Mirrors how messages map
   * sequenceNumber → Y in the layout builder.
   */
  afterSequenceNumber: number;
}

export type RelationKind =
  | 'ASSOCIATION'
  | 'AGGREGATION'
  | 'COMPOSITION'
  | 'GENERALIZATION'
  | 'REALIZATION'
  | 'DEPENDENCY'
  | 'USAGE'
  | 'INCLUDE'
  | 'EXTEND'
  | 'TRANSITION'
  | 'CONTROL_FLOW'
  | 'OBJECT_FLOW'
  | 'DEPLOYMENT'
  | 'MANIFESTATION'
  | 'PACKAGE_IMPORT'
  | 'PACKAGE_MERGE'
  | 'PACKAGE_ACCESS';

export interface IRAssociationEnd {
  elementId: string;
  role?: string;
  multiplicity?: string;
  isNavigable?: boolean;
  aggregation?: 'none' | 'shared' | 'composite';
}

export interface IRRelation {
  id: string;
  kind: RelationKind;
  sourceId: string;
  targetId: string;
  name?: string;
  sourceEnd?: IRAssociationEnd;
  targetEnd?: IRAssociationEnd;
  stereotypes?: string[];
  taggedValues?: TaggedValue[];
  isExternal?: boolean;
  condition?: string;      // «extend» guard condition
  extensionPoint?: string; // «extend» target extension point name
}

export interface SemanticModel {
  id: string;
  name: string;
  version: string;
  packages: Record<string, IRPackage>;
  classes: Record<string, IRClass>;
  interfaces: Record<string, IRInterface>;
  enums: Record<string, IREnum>;
  dataTypes: Record<string, IRDataType>;
  attributes: Record<string, IRAttribute>;
  operations: Record<string, IROperation>;
  actors: Record<string, IRActor>;
  useCases: Record<string, IRUseCase>;
  systemBoundaries?: Record<string, IRSystemBoundary>;
  ucModules?: Record<string, IRUCModule>;
  domainEntities?: Record<string, IRDomainEntity>;
  domainAttributes?: Record<string, IRDomainAttribute>;
  activityNodes: Record<string, IRActivityNode>;
  objectInstances: Record<string, IRObjectInstance>;
  components: Record<string, IRComponent>;
  nodes: Record<string, IRNode>;
  artifacts: Record<string, IRArtifact>;
  lifelines?: Record<string, IRLifeline>;
  messages?: Record<string, IRMessage>;
  activations?: Record<string, IRActivation>;
  interactionFragments?: Record<string, IRInteractionFragment>;
  stateInvariants?: Record<string, IRStateInvariant>;
  interactionUses?: Record<string, IRInteractionUse>;
  gates?: Record<string, IRGate>;
  relations: Record<string, IRRelation>;
  createdAt: number;
  updatedAt: number;
  packageNames?: string[];
}

// ─── Semantic resolution types ────────────────────────────────────────────────

/**
 * Discriminant for any resolvable element in the SemanticModel.
 * Used by resolveSemanticElement and diagram-registry semanticLookup entries.
 */
export type SemanticKind =
  | 'CLASS'
  | 'ABSTRACT_CLASS'
  | 'INTERFACE'
  | 'ENUM'
  | 'PACKAGE'
  | 'NOTE'
  | 'ACTOR'
  | 'USECASE'
  | 'SYSTEM_BOUNDARY'
  | 'UC_MODULE'
  | 'DOMAIN_ENTITY'
  | 'LIFELINE'
  | 'UNKNOWN';

/**
 * Result of resolving a ViewNode's elementId against the SemanticModel.
 * `element` is null for NOTEs and UNKNOWN ids.
 */
export interface ResolvedElement {
  element:
    | IRClass
    | IRInterface
    | IREnum
    | IRPackage
    | IRActor
    | IRUseCase
    | IRSystemBoundary
    | IRUCModule
    | IRDomainEntity
    | IRLifeline
    | null;
  kind: SemanticKind;
}
