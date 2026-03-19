export type VFSNodeType = 'FOLDER' | 'FILE';

export type FileExtension = '.luml' | '.xmi' | '.md' | '.model' | '.json';

export type DiagramType = 
  | 'CLASS_DIAGRAM' 
  | 'USE_CASE_DIAGRAM' 
  | 'SEQUENCE_DIAGRAM' 
  | 'ACTIVITY_DIAGRAM' 
  | 'STATE_MACHINE_DIAGRAM' 
  | 'COMPONENT_DIAGRAM' 
  | 'DEPLOYMENT_DIAGRAM' 
  | 'PACKAGE_DIAGRAM'
  | 'OBJECT_DIAGRAM'
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
  content: unknown | null;
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

export interface LibreUMLProject {
  id: string;
  projectName: string;
  description?: string;
  author?: string;
  version: string;
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
}

export interface IROperation extends IRElement {
  kind: 'OPERATION';
  returnType?: string;
  parameters: IRParameter[];
  isQuery?: boolean;
  exceptions?: string[];
}

export interface IRClass extends IRElement {
  kind: 'CLASS';
  packageId?: string;
  attributeIds: string[];
  operationIds: string[];
  isFinal?: boolean;
  isActive?: boolean;
  isExternal?: boolean;
}

export interface IRInterface extends IRElement {
  kind: 'INTERFACE';
  packageId?: string;
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
}

export interface IRUseCase extends IRElement {
  kind: 'USECASE';
  extensionPoints?: string[];
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
  | 'MANIFESTATION';

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
  activityNodes: Record<string, IRActivityNode>;
  objectInstances: Record<string, IRObjectInstance>;
  components: Record<string, IRComponent>;
  nodes: Record<string, IRNode>;
  artifacts: Record<string, IRArtifact>;
  relations: Record<string, IRRelation>;
  createdAt: number;
  updatedAt: number;
}
