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

/**
 * The behaviour an activity diagram describes. Nodes and partitions always
 * belong to exactly one.
 */
export interface IRActivity extends IRElement {
  kind: 'ACTIVITY';
  /** Trace to the use case this activity realizes (ADR-0010). */
  realizesUseCaseId?: string;
  /** Trace to the classifier that owns the behaviour. */
  contextClassifierId?: string;
}

export type ActivityNodeKind =
  // v1
  | 'ACTION'
  | 'CALL_OPERATION'
  | 'INITIAL'
  | 'ACTIVITY_FINAL'
  | 'DECISION'
  | 'MERGE'
  | 'FORK'
  | 'JOIN'
  // v1.1
  | 'FLOW_FINAL'
  | 'OBJECT_NODE'
  | 'INPUT_PIN'
  | 'OUTPUT_PIN';

export interface IRActivityNode extends IRElement {
  kind: 'ACTIVITY_NODE';
  activityType: ActivityNodeKind;
  /** Owning activity. A node always belongs to exactly one. */
  activityId: string;
  /** Partition (swimlane) containing it; undefined means outside any lane. */
  partitionId?: string;
  /** CALL_OPERATION only: the operation this action invokes (ADR-0010). */
  callsOperationId?: string;
  /** OBJECT_NODE only: classifier of the object that flows. */
  classifierId?: string;
  /** FORK/JOIN only: bar axis. Defaults to HORIZONTAL. */
  barOrientation?: 'HORIZONTAL' | 'VERTICAL';
  /**
   * INPUT_PIN/OUTPUT_PIN only: the action (ACTION/CALL_OPERATION) this pin
   * belongs to (A6.2). A pin has no meaning without an owner.
   */
  ownerActionId?: string;
  /**
   * INPUT_PIN/OUTPUT_PIN only: trace to a parameter of the owner's linked
   * operation (ADR-0010). By name, not id — `IRParameter` carries no id of
   * its own. The sentinel `PIN_RETURN_VALUE` ('__return__', see
   * `activityModelOps.ts`) traces an output pin to the operation's return
   * value instead of a parameter.
   */
  parameterName?: string;
}

/**
 * A swimlane. Its position comes from `index`, never from pixels: reordering
 * lanes swaps indices and the geometry follows (ADR-0008).
 */
export interface IRActivityPartition extends IRElement {
  kind: 'ACTIVITY_PARTITION';
  activityId: string;
  /** Order along the axis. Determines the lane's position. */
  index: number;
  /** Trace to the class or actor responsible for this lane (ADR-0010). */
  representsId?: string;
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
  /**
   * UML 2.5 §17.4 PartDecomposition — VFS file id of the SEQUENCE_DIAGRAM that
   * refines this lifeline's internal behaviour. When set, the lifeline shows a
   * `ref <name>` marker and double-clicking it navigates to that sub-interaction
   * (C5). Mirrors `IRInteractionUse.referencedDiagramId` but anchored to a
   * single participant.
   */
  decomposedAs?: string;
  /** Display label of the referenced sub-interaction (falls back to its file name). */
  decomposedName?: string;
  /**
   * Hybrid layout override (G-c): manual vertical length of the lifeline's
   * timeline, in px. By default the timeline length is derived from the message
   * count; dragging the foot handle pins this value so the user can stretch the
   * lifeline past the last message (EA/StarUML style). Ignored for destroyed
   * lifelines (their timeline ends at the destroy occurrence). Double-clicking
   * the foot handle clears it.
   */
  manualTimelineLength?: number;
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
  /**
   * UML 2.5 InteractionConstraint at the message level — a guard condition that
   * must hold for this message to occur (rendered as `[guard]` before the name).
   * Distinct from an operand's guard (`IRInteractionOperand.guard`): this scopes
   * the condition to a single message rather than a whole fragment operand (C8).
   */
  guard?: string;
  /** For REPLY messages, references the invoking message. */
  inReplyTo?: string;
  /**
   * Hybrid layout override (B2): when set, the message is pinned at this absolute
   * Y (world px) instead of its computed slot Y, mirroring an activation's
   * `manualTopY`. The `sequenceNumber` still drives ordering/numbering; only the
   * glyph's vertical position floats. Cleared on a plain drag-reorder or reset.
   */
  manualY?: number;
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
  // Activation geometry is fully system-managed (UML convention): the bar is
  // anchored to its lifeline (X auto, fixed width) and its height is derived
  // from the execution span — it grows automatically with nested messages,
  // self-messages and new interactions. There are no manual layout overrides.
}

/**
 * The 12 UML 2.5 §17.6 InteractionOperatorKind values. `interactionOperator`
 * in XMI is the lowercased form of each (`alt`, `strict`, `consider`, …).
 */
export type FragmentKind =
  | 'ALT'      // alternative (if/else) with multiple guarded operands
  | 'OPT'      // optional (single guarded operand)
  | 'LOOP'     // iteration with guard
  | 'PAR'      // parallel
  | 'SEQ'      // weak sequencing
  | 'STRICT'   // strict sequencing (order across operands is significant)
  | 'BREAK'    // break
  | 'CRITICAL' // critical region
  | 'NEG'      // negative (invalid traces)
  | 'ASSERT'   // assertion (only valid continuation)
  | 'IGNORE'   // ignore the listed message types
  | 'CONSIDER'; // consider only the listed message types

/** All combined-fragment kinds, in canonical UI order. */
export const FRAGMENT_KINDS: readonly FragmentKind[] = [
  'ALT', 'OPT', 'LOOP', 'PAR', 'SEQ', 'STRICT', 'BREAK', 'CRITICAL',
  'NEG', 'ASSERT', 'IGNORE', 'CONSIDER',
];

/**
 * Fragment kinds whose semantics allow more than one operand: alternatives,
 * parallel regions, weak and strict sequencing. The rest are single-operand by
 * definition (UML 2.5 §17.6). Single source of truth for both the creation
 * defaults and the operand add/remove UI.
 */
export const MULTI_OPERAND_FRAGMENT_KINDS: ReadonlySet<FragmentKind> = new Set([
  'ALT', 'PAR', 'SEQ', 'STRICT',
]);

/** Default number of operands to seed when a fragment of this kind is created. */
export function defaultOperandCount(kind: FragmentKind): number {
  return MULTI_OPERAND_FRAGMENT_KINDS.has(kind) ? 2 : 1;
}

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
  /**
   * Hybrid layout overrides (G-a/G-b): by default the box is derived (X from the
   * covered lifelines, Y from the span of the messages it contains). When any of
   * these are set the builder uses them instead, letting the user move the
   * container vertically and resize its width/height like in EA/StarUML. Dragging
   * the box vertically also shifts the contained messages (`manualY`) so the
   * contents follow the container; the inline panel's reset clears all four.
   */
  manualLeft?: number;
  manualTop?: number;
  manualWidth?: number;
  manualHeight?: number;
  /**
   * UML 2.5 §17.6 — the explicit message set for IGNORE / CONSIDER operators.
   * IGNORE renders `ignore {m1, m2}` (those messages are disregarded inside the
   * region); CONSIDER renders `consider {m1, m2}` (only those are significant).
   * Empty/undefined for every other kind, and harmless when present.
   */
  messageSet?: string[];
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
  /** Hybrid layout overrides (G-d): manual box width/height in px. */
  manualWidth?: number;
  manualHeight?: number;
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
  /** Hybrid layout overrides (G-d): manual box width/height, kept centered. */
  manualWidth?: number;
  manualHeight?: number;
}

/**
 * UML 2.5 §17.2 GeneralOrdering — a dotted arrow that forces a temporal order
 * between two OccurrenceSpecifications (message ends) that would otherwise be
 * unordered (typically on different lifelines). Purely a constraint: it adds no
 * message, only an ordering edge `before → after`.
 */
export interface IRGeneralOrdering extends IRElement {
  kind: 'GENERAL_ORDERING';
  /** The earlier message whose occurrence must precede the other. */
  beforeMessageId: string;
  /** Which end (occurrence) of the before-message anchors the order's tail. */
  beforeEnd: 'SEND' | 'RECEIVE';
  /** The later message whose occurrence must follow the other. */
  afterMessageId: string;
  /** Which end (occurrence) of the after-message the arrow points at. */
  afterEnd: 'SEND' | 'RECEIVE';
}

/**
 * UML 2.5 §17.2 timing constraint — covers both DurationConstraint (an interval
 * `{0..3s}` between two occurrences) and TimeConstraint (`{t=now}` at a single
 * occurrence). One IR with a `constraintKind` discriminant; DURATION uses both
 * anchors, TIME only the `from` anchor.
 */
export interface IRTimeConstraint extends IRElement {
  kind: 'TIME_CONSTRAINT';
  constraintKind: 'DURATION' | 'TIME';
  /** Primary occurrence anchor (the only one for TIME). */
  fromMessageId: string;
  fromEnd: 'SEND' | 'RECEIVE';
  /** Second occurrence anchor — DURATION only (the interval's other end). */
  toMessageId?: string;
  toEnd?: 'SEND' | 'RECEIVE';
  /** Constraint expression, e.g. "0..3s" (duration) or "t=now" (time). */
  expression: string;
}

/**
 * UML 2.5 §17.4 Coregion — a section of a single lifeline whose contained event
 * occurrences are NOT ordered (they may happen in any order). Drawn as square
 * brackets `[ ]` bracketing a vertical span of the lifeline. Lighter-weight than
 * a full PAR fragment when concurrency is local to one participant.
 */
export interface IRCoregion extends IRElement {
  kind: 'COREGION';
  /** The single lifeline this coregion brackets. */
  lifelineId: string;
  /** Top boundary in message-slot units (0 = top of the timeline). */
  fromSequence: number;
  /** Bottom boundary in message-slot units. */
  toSequence: number;
}

/**
 * UML 2.5 §17.3 Continuation — a named continuation point spanning one or more
 * lifelines, used to split and rejoin alternative flows (typically with ALT/SEQ).
 * Two continuations with the SAME name denote a jump: control reaching one
 * continues at the other. Drawn as a stadium (rounded-end) box with the name.
 */
export interface IRContinuation extends IRElement {
  kind: 'CONTINUATION';
  /** Lifelines this continuation spans horizontally. */
  coveredLifelineIds: string[];
  /** Temporal anchor: sits in the band below this message slot (0 = top). */
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
  /** CONTROL_FLOW / OBJECT_FLOW guard, e.g. '[balance > 0]'. */
  guard?: string;
  /** CONTROL_FLOW / OBJECT_FLOW weight: '*', '1', or an expression. */
  weight?: string;
}

export interface SemanticModel {
  id: string;
  name: string;
  /** Business version of the model's content. Not the storage format. */
  version: string;
  /**
   * Storage format version, driving the migration pipeline (ADR-0012).
   * Absent means "before migrations existed" and is treated as 0.
   */
  schemaVersion?: number;
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
  activities?: Record<string, IRActivity>;
  activityNodes: Record<string, IRActivityNode>;
  activityPartitions?: Record<string, IRActivityPartition>;
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
  generalOrderings?: Record<string, IRGeneralOrdering>;
  timeConstraints?: Record<string, IRTimeConstraint>;
  coregions?: Record<string, IRCoregion>;
  continuations?: Record<string, IRContinuation>;
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
  | 'ACTIVITY_NODE'
  | 'ACTIVITY_PARTITION'
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
    | IRActivityNode
    | IRActivityPartition
    | null;
  kind: SemanticKind;
}
