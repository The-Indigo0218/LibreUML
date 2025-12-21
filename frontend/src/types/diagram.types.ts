/**
 * Shared Domain Types.
 * Matches the JSON structure expected from the Backend.
 */

export interface UmlClassData {
  label: string;
  attributes: string[];
  methods: string[];
  stereotype?: string; 
}

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


export interface UmlEdge {
  id: string;
  source: string;       
  target: string;       
  type?: 'smoothstep' | 'straight'; 
  label?: string;       
  animated?: boolean;  
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