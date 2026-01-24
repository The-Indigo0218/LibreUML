import type { CSSProperties } from 'react';

export type stereotype = 'class' | 'interface' | 'abstract' | 'note';
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
  parameters: {name: string, type: string}[];
}

export interface UmlClassData {
  label: string;
  content?: string;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  stereotype: stereotype; 
}


// UML Class Node Type for React Flow
export interface UmlClassNode {
  id: string;
  type: 'umlClass';
  position: { 
    x: number; 
    y: number; 
  };
  data: UmlClassData; 
  selected?: boolean;     
}


export interface UmlMarker {
  type: string;
  width?: number;
  height?: number;
  color?: string;
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

  data?: {
    type: UmlRelationType | 'note' | string;
  };
}

export interface DiagramState {
  id: string;
  name: string;
  nodes: UmlClassNode[];
  edges: UmlEdge[]; 
  viewport: { 
    x: number; 
    y: number; 
    zoom: number; 
  }; 
}