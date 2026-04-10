import type { CSSProperties } from "react";

export type stereotype = "class" | "interface" | "abstract" | "note" | "enum" | "package";
export type UmlRelationType =
  | "association"
  | "inheritance"
  | "implementation"
  | "dependency"
  | "aggregation"
  | "composition";
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