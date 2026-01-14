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


export interface UmlEdge {
  id: string;
  source: string;       
  target: string;       
  type?: 'smoothstep' | 'straight'; 
  label?: string;       
  animated?: boolean;  
}

// Complete Diagram State to be saved/loaded (API or LocalStorage)
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