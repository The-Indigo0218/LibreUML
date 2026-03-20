/**
 * Base domain model for all edge entities.
 * This is the SSOT - no UI concerns, pure relationship data.
 */
export interface BaseDomainEdge {
  id: string;
  type: string; // Discriminator for specific edge types
  sourceNodeId: string; // Reference to domain node ID
  targetNodeId: string; // Reference to domain node ID
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Common properties for edges with multiplicity
 */
export interface Multiplicable {
  sourceMultiplicity?: string; // e.g., "1", "0..*", "1..*"
  targetMultiplicity?: string;
}

/**
 * Common properties for edges with labels
 */
export interface Labelable {
  label?: string;
}
