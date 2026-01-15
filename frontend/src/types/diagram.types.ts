import type { CSSProperties } from 'react';

export type stereotype = 'class' | 'interface' | 'abstract' | 'note';
export type UmlRelationType = 'association' | 'inheritance' | 'implementation' | 'dependency';

export interface UmlClassData {
  label: string;
  content?: string;
  attributes: string[];
  methods: string[];
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