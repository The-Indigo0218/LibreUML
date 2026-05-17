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
  /** Persisted text content for Note nodes (no IR backing element). */
  content?: string;
  /** Persisted title for Note nodes. */
  noteTitle?: string;
  parentPackageId?: string | null;
  collapsed?: boolean;
  /** Package name for package container nodes. */
  packageName?: string;
}

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
}

export interface IRInterface extends IRElement {
  kind: 'INTERFACE';
  packageId?: string;
  packageName?: string;
  /** UML 2.5.1 §10.4: interfaces may own attributes as well as operations. Defaults to [] when absent (backward compat). */
  attributeIds?: string[];
  operationIds: string[];
  isExternal?: boolean;
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
  relations: Record<string, IRRelation>;
  createdAt: number;
  updatedAt: number;
  packageNames?: string[];
}
