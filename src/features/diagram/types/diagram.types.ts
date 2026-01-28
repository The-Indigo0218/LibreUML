import type { CSSProperties } from 'react';

export type stereotype = 'class' | 'interface' | 'abstract' | 'note' | 'enum';
export type UmlRelationType = 'association' | 'inheritance' | 'implementation' | 'dependency' | 'aggregation' | 'composition';
export type visibility = '+' | '-' | '#' | '~';

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
  visibility: visibility;
  isStatic?: boolean;
  parameters: {name: string, type: string}[];
}

export interface UmlClassData {
  label: string;
  content?: string;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  stereotype: stereotype; 
  isMain?: boolean;
}

export interface UmlClassNode {
  id: string;
  type: 'umlClass' | 'umlNote'; 
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
  type: UmlRelationType | 'note' | string;
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
  activeConnectionMode?: UmlRelationType; 
  viewport: { 
    x: number; 
    y: number; 
    zoom: number; 
  }; 
}