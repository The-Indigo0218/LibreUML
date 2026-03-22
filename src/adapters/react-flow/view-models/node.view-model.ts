/**
 * Generic Node View Model for UI Rendering
 * 
 * This is a presentation DTO that decouples UI components from domain logic.
 * It contains ONLY what the UI needs to render, with no domain-specific types.
 * 
 * CRITICAL: UI components should NEVER import domain types.
 * All domain data must be transformed into this generic structure.
 */

/**
 * Generic section item (attribute, method, literal, etc.)
 */
export interface NodeSectionItem {
  id: string;
  text: string; // Pre-formatted display text (e.g., "+ name: String")
  icon?: string; // Optional icon identifier
  isStatic?: boolean;
  isAbstract?: boolean;
  metadata?: Record<string, unknown>; // Extensible for future needs
}

/**
 * Generic section (attributes, methods, literals, etc.)
 */
export interface NodeSection {
  id: string;
  title?: string; // Optional section title
  items: NodeSectionItem[];
  collapsible?: boolean;
  collapsed?: boolean;
}

/**
 * Style configuration for node rendering
 */
export interface NodeStyleConfig {
  containerClass: string;
  headerClass: string;
  badgeColor: string;
  labelFormat: string; // CSS classes for label formatting (e.g., "italic font-bold")
  showStereotype: boolean;
}

/**
 * Generic Node View Model
 * 
 * This is what UI components receive. It contains:
 * - Display data (label, stereotype, sections)
 * - Style configuration
 * - NO domain-specific types or logic
 */
export interface NodeViewModel {
  // Identity
  id: string;
  domainId: string; // Reference to domain entity for updates
  
  // Display data
  label: string; // Primary label (e.g., class name)
  sublabel?: string; // Secondary label (e.g., generics like "<T>")
  stereotype?: string; // Visual stereotype badge (e.g., "interface", "abstract")
  badge?: string; // Additional badge text (e.g., "main", package name)
  
  // Content sections (generic structure)
  sections: NodeSection[];
  
  // Style configuration
  style: NodeStyleConfig;
  
  // Metadata (extensible)
  metadata?: {
    isMain?: boolean;
    package?: string;
    [key: string]: unknown;
  };
}

/**
 * Note-specific view model (simplified)
 */
export interface NoteViewModel {
  id: string;
  domainId: string;
  title?: string;
  content: string;
  /**
   * Optional persistence callback. Provided by the layer that knows how to
   * save note content (VFS controller, or omitted for legacy ProjectStore path).
   * When absent the component falls back to useProjectStore.updateNode().
   */
  onSave?: (update: { content?: string; title?: string }) => void;
}

/**
 * Union type for all node view models
 */
export type AnyNodeViewModel = NodeViewModel | NoteViewModel;

/**
 * Type guard for NodeViewModel
 */
export function isNodeViewModel(vm: AnyNodeViewModel): vm is NodeViewModel {
  return 'sections' in vm;
}

/**
 * Type guard for NoteViewModel
 */
export function isNoteViewModel(vm: AnyNodeViewModel): vm is NoteViewModel {
  return 'content' in vm && !('sections' in vm);
}
