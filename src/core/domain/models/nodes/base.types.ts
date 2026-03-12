/**
 * Base domain model for all node entities.
 * This is the SSOT - no UI concerns, pure business data.
 */
export interface BaseDomainNode {
  id: string;
  type: string; // Discriminator for specific node types
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>; // Extensibility
}

/**
 * Visibility modifiers (shared across diagram types)
 */
export type Visibility = '+' | '-' | '#' | '~';

/**
 * Common properties for nodes that can be grouped/packaged
 */
export interface Packageable {
  package?: string;
}

/**
 * Common properties for nodes that can be documented
 */
export interface Documentable {
  documentation?: string;
  tags?: string[];
}
