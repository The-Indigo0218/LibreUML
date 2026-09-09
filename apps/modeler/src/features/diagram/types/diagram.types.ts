import type { CSSProperties } from "react";

export type stereotype = "class" | "interface" | "abstract" | "note" | "enum" | "package" | "actor" | "use_case" | "system_boundary" | "uc_module" | "domain_entity" | "lifeline" | "actor_lifeline" | "activity_node"
  // Activity Diagram tool ids (A2.5) — distinct from "activity_node" above,
  // which classifies an *existing* node for connection validation; these are
  // the palette drop stereotypes that pick which ActivityNodeKind to create.
  | "action" | "call_operation" | "initial_node" | "activity_final" | "flow_final" | "decision" | "merge" | "fork" | "join"
  // A3: the swimlane tool id.
  | "activity_partition"
  // A6/v1.1: the object node tool id.
  | "object_node"
  // Structured nodes (v1.1): loop/conditional/sequence tool ids.
  | "loop_node" | "conditional_node" | "sequence_node"
  // v1.1: the interruptible region tool id.
  | "interruptible_region"
  // v1.1: the expansion region tool id. No tool id for its expansion nodes —
  // same reasoning as pins never getting one — they are created from the
  // region's own context menu instead.
  | "expansion_region";
export type UmlRelationType =
  | "association"
  | "inheritance"
  | "implementation"
  | "dependency"
  | "aggregation"
  | "composition"
  | "package_import"
  | "package_access"
  | "package_merge";
export type visibility = "+" | "-" | "#" | "~";

export interface UmlAttribute {
  id: string;
  name: string;
  type: string;
  visibility: visibility;
  isArray: boolean;
}

export interface UmlMethod {
  id: string;
  name: string;
  returnType: string;
  isReturnArray?: boolean;
  visibility: visibility;
  isStatic?: boolean;
  isAbstract?: boolean;
  isConstructor?: boolean;
  parameters: { 
    name: string; 
    type: string;
    isArray?: boolean;
  }[];
}

export interface UmlPackage {
  id: string;
  name: string;
  parentId?: string;
}

export interface UmlEnumLiteral {
  id: string;
  name: string;
  value?: string;
}

export interface UmlClassData {
  label: string;
  generics?: string;
  content?: string;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  stereotype: stereotype;
  isMain?: boolean;
  package?: string;
  /** Only populated when stereotype === 'enum'. Ignored otherwise. */
  literals?: UmlEnumLiteral[];
}

export interface UmlClassNode {
  id: string;
  type: "umlClass" | "umlNote";
  position: {
    x: number;
    y: number;
  };
  data: UmlClassData;
  selected?: boolean;
  width?: number;
  height?: number;
}

export interface UmlMarker {
  type: string;
  width?: number;
  height?: number;
  color?: string;
}

export interface UmlEdgeData {
  type: UmlRelationType | "note" | string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  /** UML navigability per end (from XMI <navigableOwnedEnd>). undefined = unspecified. */
  sourceNavigable?: boolean;
  targetNavigable?: boolean;
  isHovered?: boolean;
}

export interface UmlEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  animated?: boolean;

  style?: CSSProperties;
  markerEnd?: UmlMarker | string;
  sourceHandle?: string | null;
  targetHandle?: string | null;

  data?: UmlEdgeData;
}

export interface DiagramState {
  id: string;
  name: string;
  nodes: UmlClassNode[];
  edges: UmlEdge[];
  packages?: UmlPackage[]; 
  activeConnectionMode?: UmlRelationType;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}