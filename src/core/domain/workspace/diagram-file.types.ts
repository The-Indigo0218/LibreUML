/**
 * Supported diagram types in the workspace
 */
export type DiagramType = 
  | 'CLASS_DIAGRAM' 
  | 'USE_CASE_DIAGRAM';
  // Future: 'SEQUENCE_DIAGRAM' | 'ACTIVITY_DIAGRAM' | 'STATE_DIAGRAM'

/**
 * Viewport state (camera position and zoom)
 */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * A diagram file represents a single tab/document in the workspace.
 * It contains references to domain entities (by ID) and their view state.
 */
export interface DiagramFile<TDiagramType extends DiagramType = DiagramType> {
  id: string;
  name: string;
  diagramType: TDiagramType;
  
  // References to domain entities (SSOT lives in ProjectState)
  nodeIds: string[]; // Array of domain node IDs
  edgeIds: string[]; // Array of domain edge IDs
  
  // View state (UI concerns, not domain)
  viewport: Viewport;
  
  // File metadata
  filePath?: string; // File system path if saved
  isDirty: boolean; // Has unsaved changes
  createdAt: number;
  updatedAt: number;
  
  // Diagram-specific metadata
  metadata?: DiagramFileMetadata<TDiagramType>;
}

/**
 * Diagram-specific metadata (extensible per diagram type)
 */
export type DiagramFileMetadata<TDiagramType extends DiagramType> = 
  TDiagramType extends 'CLASS_DIAGRAM' ? ClassDiagramMetadata :
  TDiagramType extends 'USE_CASE_DIAGRAM' ? UseCaseDiagramMetadata :
  Record<string, unknown>;

/**
 * Class Diagram specific metadata
 */
export interface ClassDiagramMetadata {
  packages?: Array<{
    id: string;
    name: string; // Full path: "com.hospital.models"
  }>;
  activeConnectionMode?: 'ASSOCIATION' | 'INHERITANCE' | 'IMPLEMENTATION' | 'DEPENDENCY' | 'AGGREGATION' | 'COMPOSITION';
}

/**
 * Use Case Diagram specific metadata
 */
export interface UseCaseDiagramMetadata {
  systemName?: string;
  activeConnectionMode?: 'ASSOCIATION' | 'INCLUDE' | 'EXTEND' | 'GENERALIZATION';
}
