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
  /** Optional persistence callback for saving note content via VFS. */
  onSave?: (update: { content?: string; title?: string }) => void;
}

export interface PackageViewModel {
  __brand: 'package';
  id: string;
  name: string;
  collapsed: boolean;
  color?: string;
  childCount: number;
  depth: number;
}

export interface ActorViewModel {
  __brand: 'actor';
  id: string;
  domainId: string;
  name: string;
  isAbstract: boolean;
  actorType?: 'human' | 'system' | 'timer';
  onRename?: (name: string) => void;
  onOpenProps?: () => void;
}

export interface UseCaseViewModel {
  __brand: 'useCase';
  id: string;
  domainId: string;
  name: string;
  extensionPoints: string[];
  hasSpec: boolean;
  onRename?: (name: string) => void;
  onOpenSpec?: () => void;
}

export interface SystemBoundaryViewModel {
  __brand: 'systemBoundary';
  id: string;
  domainId: string;
  name: string;
  width: number;
  height: number;
  onRename?: (name: string) => void;
}

export interface UCModuleViewModel {
  __brand: 'ucModule';
  id: string;
  domainId: string;
  name: string;
  width: number;
  height: number;
  onRename?: (name: string) => void;
}

export interface DomainEntityViewModel {
  __brand: 'domainEntity';
  id: string;
  domainId: string;
  name: string;
  attributes: Array<{ id: string; name: string }>;
  onRename?: (name: string) => void;
  onOpenProps?: () => void;
}

export type LifelineParticipantKindVM = 'CLASS' | 'INTERFACE' | 'ACTOR' | 'OBJECT' | 'ANONYMOUS';

export interface LifelineViewModel {
  __brand: 'lifeline';
  id: string;             // view node id
  domainId: string;       // IRLifeline.id
  name: string;           // display name
  participantKind: LifelineParticipantKindVM;
  isExternal?: boolean;
  /** Total length of the dashed timeline below the head. */
  timelineLength: number;
  headWidth: number;
  headHeight: number;
  /**
   * Vertical offset (from the group origin) at which the head box is drawn.
   * 0 for normal lifelines; > 0 when the lifeline is born mid-diagram via a
   * CREATE message (UML 2.5 create event).
   */
  headTopOffset?: number;
  /** True when a DESTROY message terminates this lifeline (draws an ✕ marker). */
  isDestroyed?: boolean;
  onRename?: (name: string) => void;
}

export type MessageKindVM = 'SYNC' | 'ASYNC' | 'REPLY' | 'CREATE' | 'DESTROY';

export interface MessageViewModel {
  __brand: 'message';
  id: string;             // synthetic id (== domain message id)
  domainId: string;       // IRMessage.id
  name: string;
  messageKind: MessageKindVM;
  sequenceNumber: number;
  /** Hierarchical display label: "1", "2", "1.1", "2.3.2", etc. */
  displayNumber: string;
  /** Signed horizontal length: positive = arrow right, negative = left, 0 = self. */
  length: number;
  isSelfMessage: boolean;
  onRename?: (name: string) => void;
}

export interface ActivationViewModel {
  __brand: 'activation';
  id: string;             // synthetic id (== domain activation id)
  domainId: string;       // IRActivation.id
  /** Width of the bar (typically 10px). */
  width: number;
  /** Length of the bar (top to bottom). */
  height: number;
  /** True while the activation has no endMessageId (rendered with dashed bottom). */
  isOpen: boolean;
  /** Visual offset for nested activations (re-entrancy). */
  nestingDepth: number;
}

export type FragmentKindVM =
  | 'ALT' | 'OPT' | 'LOOP' | 'PAR' | 'SEQ' | 'BREAK' | 'CRITICAL';

export interface FragmentOperandVM {
  id: string;
  guard?: string;
  /** Y offset within the fragment where this operand begins (used for separator lines). */
  yOffset: number;
}

export interface FragmentViewModel {
  __brand: 'fragment';
  id: string;
  domainId: string;
  fragmentKind: FragmentKindVM;
  /** Bounding box width (covers all coveredLifelineIds). */
  width: number;
  /** Bounding box height (top to bottom across all operands). */
  height: number;
  /** Operands in order; the first one has yOffset=0 (no separator above it). */
  operands: FragmentOperandVM[];
  /** Visual offset depth for nested fragments. */
  nestingDepth: number;
}

export interface StateInvariantViewModel {
  __brand: 'stateInvariant';
  id: string;             // synthetic id (== domain state-invariant id)
  domainId: string;       // IRStateInvariant.id
  /** Constraint text rendered inside the state symbol (braces added by the shape). */
  constraint: string;
  /** State-symbol bounding box (centred on the lifeline by the builder). */
  width: number;
  height: number;
}

/**
 * Union type for all node view models
 */
export type AnyNodeViewModel =
  | NodeViewModel
  | NoteViewModel
  | PackageViewModel
  | ActorViewModel
  | UseCaseViewModel
  | SystemBoundaryViewModel
  | UCModuleViewModel
  | DomainEntityViewModel
  | LifelineViewModel
  | MessageViewModel
  | ActivationViewModel
  | FragmentViewModel
  | StateInvariantViewModel;

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

export function isPackageViewModel(vm: AnyNodeViewModel): vm is PackageViewModel {
  return '__brand' in vm && vm.__brand === 'package';
}

export function isActorViewModel(vm: AnyNodeViewModel): vm is ActorViewModel {
  return '__brand' in vm && vm.__brand === 'actor';
}

export function isUseCaseViewModel(vm: AnyNodeViewModel): vm is UseCaseViewModel {
  return '__brand' in vm && vm.__brand === 'useCase';
}

export function isSystemBoundaryViewModel(vm: AnyNodeViewModel): vm is SystemBoundaryViewModel {
  return '__brand' in vm && vm.__brand === 'systemBoundary';
}

export function isUCModuleViewModel(vm: AnyNodeViewModel): vm is UCModuleViewModel {
  return '__brand' in vm && vm.__brand === 'ucModule';
}

export function isDomainEntityViewModel(vm: AnyNodeViewModel): vm is DomainEntityViewModel {
  return '__brand' in vm && vm.__brand === 'domainEntity';
}

export function isLifelineViewModel(vm: AnyNodeViewModel): vm is LifelineViewModel {
  return '__brand' in vm && vm.__brand === 'lifeline';
}

export function isMessageViewModel(vm: AnyNodeViewModel): vm is MessageViewModel {
  return '__brand' in vm && vm.__brand === 'message';
}

export function isActivationViewModel(vm: AnyNodeViewModel): vm is ActivationViewModel {
  return '__brand' in vm && vm.__brand === 'activation';
}

export function isFragmentViewModel(vm: AnyNodeViewModel): vm is FragmentViewModel {
  return '__brand' in vm && vm.__brand === 'fragment';
}

export function isStateInvariantViewModel(vm: AnyNodeViewModel): vm is StateInvariantViewModel {
  return '__brand' in vm && vm.__brand === 'stateInvariant';
}
