import type { DomainNode } from '../models/nodes';
import type { DomainEdge } from '../models/edges';
import type { DiagramFile } from './diagram-file.types';

/**
 * The root project state - Single Source of Truth (SSOT)
 * 
 * Architecture:
 * - Domain entities (nodes, edges) are stored ONCE in dictionaries
 * - DiagramFiles reference entities by ID
 * - No duplication, no synchronization issues
 * - Domain data is completely decoupled from UI/view state
 */
export interface ProjectState {
  // === SSOT: Domain Entities ===
  // All nodes across all diagrams, indexed by ID
  nodes: Record<string, DomainNode>;
  
  // All edges across all diagrams, indexed by ID
  edges: Record<string, DomainEdge>;
  
  // === Workspace: Files & Tabs ===
  // Array of open diagram files (tabs)
  files: DiagramFile[];
  
  // Currently active file ID
  activeFileId: string | null;
  
  // === Project Metadata ===
  projectName: string;
  projectId: string;
  createdAt: number;
  updatedAt: number;
}
