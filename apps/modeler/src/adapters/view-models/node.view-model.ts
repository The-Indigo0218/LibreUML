export interface NodeSectionItem {
  id: string;
  text: string; 
  icon?: string; 
  isStatic?: boolean;
  isAbstract?: boolean;
  metadata?: Record<string, unknown>; 
}


export interface NodeSection {
  id: string;
  title?: string; 
  items: NodeSectionItem[];
  collapsible?: boolean;
  collapsed?: boolean;
}


export interface NodeStyleConfig {
  containerClass: string;
  headerClass: string;
  badgeColor: string;
  labelFormat: string; 
  showStereotype: boolean;
}


export interface NodeViewModel {
  id: string;
  domainId: string; 
  
  label: string;
  sublabel?: string;
  stereotype?: string; 
  badge?: string; 
  
  sections: NodeSection[];
  
  style: NodeStyleConfig;


  colorOverride?: string;
  borderWidthOverride?: number;
  borderStyleOverride?: 'solid' | 'dashed' | 'dotted';
  fontFamilyOverride?: string;
  fontSizeOverride?: number;

  metadata?: {
    isMain?: boolean;
    package?: string;
    [key: string]: unknown;
  };
}


export interface NoteViewModel {
  id: string;
  domainId: string;
  title?: string;
  content: string;
  colorOverride?: string;
  borderWidthOverride?: number;
  borderStyleOverride?: 'solid' | 'dashed' | 'dotted';
  fontFamilyOverride?: string;
  fontSizeOverride?: number;
  onSave?: (update: { content?: string; title?: string }) => void;
}

export interface PackageViewModel {
  __brand: 'package';
  id: string;
  name: string;
  collapsed: boolean;
  color?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
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
  colorOverride?: string;
  borderWidthOverride?: number;
  borderStyleOverride?: 'solid' | 'dashed' | 'dotted';
  fontFamilyOverride?: string;
  fontSizeOverride?: number;
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
  colorOverride?: string;
  borderWidthOverride?: number;
  borderStyleOverride?: 'solid' | 'dashed' | 'dotted';
  fontFamilyOverride?: string;
  fontSizeOverride?: number;
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
  colorOverride?: string;
  borderWidthOverride?: number;
  borderStyleOverride?: 'solid' | 'dashed' | 'dotted';
  fontFamilyOverride?: string;
  fontSizeOverride?: number;
  onRename?: (name: string) => void;
  onOpenProps?: () => void;
}

export type LifelineParticipantKindVM = 'CLASS' | 'INTERFACE' | 'ACTOR' | 'OBJECT' | 'ANONYMOUS';

export interface LifelineViewModel {
  __brand: 'lifeline';
  id: string;            
  domainId: string;       
  name: string;          
  participantKind: LifelineParticipantKindVM;
  isExternal?: boolean;
  timelineLength: number;
  headWidth: number;
  headHeight: number;

  headTopOffset?: number;
  isDestroyed?: boolean;
  onRename?: (name: string) => void;
}

export type MessageKindVM = 'SYNC' | 'ASYNC' | 'REPLY' | 'CREATE' | 'DESTROY';

export interface MessageViewModel {
  __brand: 'message';
  id: string;             
  domainId: string;       
  name: string;
  messageKind: MessageKindVM;
  sequenceNumber: number;
  displayNumber: string;
  length: number;
  isSelfMessage: boolean;
  isFound?: boolean;
  isLost?: boolean;
  /** Message-level guard ([guard]) rendered before the name (C8). */
  guard?: string;
  /** True when the glyph's Y comes from a manual override (B2 — `manualY`). */
  isManualY?: boolean;
  onRename?: (name: string) => void;
}

export interface ActivationViewModel {
  __brand: 'activation';
  id: string;             
  domainId: string;      
  width: number;
  height: number;
  isOpen: boolean;
  nestingDepth: number;
  /** True when the bar's geometry comes from a manual drag/resize override. */
  isManual?: boolean;
}

// Mirror of FragmentKind (vfs.types.ts) — the 12 UML 2.5 InteractionOperatorKind.
export type FragmentKindVM =
  | 'ALT' | 'OPT' | 'LOOP' | 'PAR' | 'SEQ' | 'STRICT' | 'BREAK' | 'CRITICAL'
  | 'NEG' | 'ASSERT' | 'IGNORE' | 'CONSIDER';

export interface FragmentOperandVM {
  id: string;
  guard?: string;
  yOffset: number;
}

export interface FragmentViewModel {
  __brand: 'fragment';
  id: string;
  domainId: string;
  fragmentKind: FragmentKindVM;
  width: number;
  height: number;
  operands: FragmentOperandVM[];
  nestingDepth: number;
}

export interface StateInvariantViewModel {
  __brand: 'stateInvariant';
  id: string;             
  domainId: string;      
  constraint: string;
  width: number;
  height: number;
  afterSequenceNumber: number;
  totalMessages: number;
}

export interface InteractionUseViewModel {
  __brand: 'interactionUse';
  id: string;            
  domainId: string;    
  label: string;
  width: number;
  height: number;
  afterSequenceNumber: number;
  totalMessages: number;
}

export interface GateViewModel {
  __brand: 'gate';
  id: string;           
  domainId: string;       
  name: string;
  side: 'LEFT' | 'RIGHT';
  size: number;
  afterSequenceNumber: number;
  totalMessages: number;
}


export interface GeneralOrderingViewModel {
  __brand: 'generalOrdering';
  id: string;
  domainId: string;
  /** Tail point (before occurrence) relative to the node's top-left. */
  from: { x: number; y: number };
  /** Head point (after occurrence) relative to the node's top-left. */
  to: { x: number; y: number };
  /** Bounding-box size (max of |dx|, |dy| plus padding) for hit/size. */
  width: number;
  height: number;
}

export interface TimeConstraintViewModel {
  __brand: 'timeConstraint';
  id: string;
  domainId: string;
  constraintKind: 'DURATION' | 'TIME';
  /** Rendered text (already wrapped in braces by the shape). */
  expression: string;
  /** Primary anchor point relative to the node's top-left. */
  from: { x: number; y: number };
  /** Second anchor (DURATION only) relative to the node's top-left. */
  to?: { x: number; y: number };
  width: number;
  height: number;
}

export interface CoregionViewModel {
  __brand: 'coregion';
  id: string;
  domainId: string;
  /** Bracket width (lifeline-centred). */
  width: number;
  /** Vertical span between the top and bottom brackets. */
  height: number;
}

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
  | StateInvariantViewModel
  | InteractionUseViewModel
  | GateViewModel
  | GeneralOrderingViewModel
  | TimeConstraintViewModel
  | CoregionViewModel;


export function isNodeViewModel(vm: AnyNodeViewModel): vm is NodeViewModel {
  return 'sections' in vm;
}

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

export function isInteractionUseViewModel(vm: AnyNodeViewModel): vm is InteractionUseViewModel {
  return '__brand' in vm && vm.__brand === 'interactionUse';
}

export function isGateViewModel(vm: AnyNodeViewModel): vm is GateViewModel {
  return '__brand' in vm && vm.__brand === 'gate';
}

export function isGeneralOrderingViewModel(vm: AnyNodeViewModel): vm is GeneralOrderingViewModel {
  return '__brand' in vm && vm.__brand === 'generalOrdering';
}

export function isTimeConstraintViewModel(vm: AnyNodeViewModel): vm is TimeConstraintViewModel {
  return '__brand' in vm && vm.__brand === 'timeConstraint';
}

export function isCoregionViewModel(vm: AnyNodeViewModel): vm is CoregionViewModel {
  return '__brand' in vm && vm.__brand === 'coregion';
}
