export type VFSNodeType = 'FOLDER' | 'FILE';

export type DiagramType = 
  | 'CLASS_DIAGRAM' 
  | 'USE_CASE_DIAGRAM' 
  | 'SEQUENCE_DIAGRAM' 
  | 'ACTIVITY_DIAGRAM' 
  | 'STATE_MACHINE_DIAGRAM' 
  | 'COMPONENT_DIAGRAM' 
  | 'DEPLOYMENT_DIAGRAM' 
  | 'PACKAGE_DIAGRAM' 
  | 'UNSPECIFIED';

export type FileExtension = '.luml' | '.xmi' | '.md' | '.model';

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
  content: DiagramView | unknown | null;
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
}

export interface DiagramView {
  nodes: ViewNode[];
  edges: ViewEdge[];
}

export interface LibreUMLProject {
  id: string;
  projectName: string;
  description?: string;
  author?: string;
  version: string;
  domainModelId: string;
  nodes: Record<string, VFSFolder | VFSFile>;
  createdAt: number;
  updatedAt: number;
}
