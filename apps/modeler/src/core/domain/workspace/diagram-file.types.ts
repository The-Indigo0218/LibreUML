// DiagramType is defined once in vfs.types.ts (the full 12-type union) and
// re-exported here so workspace code always uses the same source of truth.
import type { DiagramType } from '../vfs/vfs.types';
export type { DiagramType };

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
  TDiagramType extends 'DOMAIN_MODEL_DIAGRAM' ? DomainModelDiagramMetadata :
  TDiagramType extends 'SEQUENCE_DIAGRAM' ? SequenceDiagramMetadata :
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
  positionMap?: Record<string, { x: number; y: number }>; // UI position state per node
}

/**
 * Use Case Diagram specific metadata
 */
export interface UseCaseDiagramMetadata {
  systemName?: string;
  activeConnectionMode?: 'ASSOCIATION' | 'INCLUDE' | 'EXTEND' | 'GENERALIZATION';
  positionMap?: Record<string, { x: number; y: number }>; // UI position state per node
}

/**
 * Domain Model Diagram specific metadata
 */
export interface DomainModelDiagramMetadata {
  activeConnectionMode?: 'ASSOCIATION';
  positionMap?: Record<string, { x: number; y: number }>;
}

/**
 * Sequence Diagram specific metadata
 */
export interface SequenceDiagramMetadata {
  activeConnectionMode?:
    | 'MESSAGE_SYNC'
    | 'MESSAGE_ASYNC'
    | 'MESSAGE_REPLY'
    | 'MESSAGE_CREATE'
    | 'MESSAGE_DESTROY';
  /** Persisted X position per lifelineId (Y is always 0 — lifelines sit at the top). */
  lifelineXMap?: Record<string, number>;
}
