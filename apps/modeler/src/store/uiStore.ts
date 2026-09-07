import { create } from "zustand";
import type { LockedHandle } from '../canvas/edges/geometry';

// Define the types for active modals in the UI
export type ActiveModal =
  | "none"
  | "open-file"
  | "class-editor"
  | "multiplicity-editor"
  | "vfs-edge-action"
  | "auto-layout-locked-warning"
  | "clear-confirmation"
  | "export-modal"
  | "engineering-single"
  | "engineering-project"
  | "engineering-reverse"
  | "import-code"
  | "method-generator"
  | "ssot-element-editor"
  | "ssot-class-editor"
  | "global-delete"
  | "code-export-config"
  | "keyboard-shortcuts"
  | "wiki"
  | "feedback"
  | "use-case-spec"
  | "actor-props"
  | "extend-props"
  | "domain-entity-props"
  | "domain-association-props"
  | "fragment-props"
  | "message-props"
  | "state-invariant-props"
  | "interaction-use-props"
  | "gate-props"
  | "general-ordering-props"
  | "time-constraint-props"
  | "coregion-props"
  | "lifeline-props"
  | "continuation-props"
  | "self-message-warning"
  | "control-flow-props"
  | "activity-action-props"
  | "activity-partition-props"
  | "activity-props"
  | "activity-objectnode-props"
  | "activity-pin-props"
  | "activity-structured-props"
  | null;

export interface AnchorSnapshot {
  src: LockedHandle;
  tgt: LockedHandle;
  /** Vector from source-center to target-center in world coordinates. */
  direction: { dx: number; dy: number };
}

interface UiStoreState {
  // state
  activeModal: ActiveModal;
  editingId: string | null;
  anchorSnapshot: AnchorSnapshot | null;
  /** Pending self-message awaiting confirmation in the self-message-warning modal. */
  pendingSelfMessage: { lifelineId: string; dropY?: number } | null;
  isGetStartedOpen: boolean;
  /** Edge id whose inline properties panel is open, or null. */
  inlineEdgePanelId: string | null;
  /** Element id of the class whose inline properties panel is open, or null. */
  inlineClassPanelId: string | null;
  /** Element id of the use case whose inline properties panel is open, or null. */
  inlineUseCasePanelId: string | null;
  /** Element id of the domain entity whose inline properties panel is open, or null. */
  inlineDomainPanelId: string | null;
  /** Element id of the actor whose inline properties panel is open, or null. */
  inlineActorPanelId: string | null;
  /** Element id of the sequence message whose inline properties panel is open, or null. */
  inlineMessagePanelId: string | null;
  /** Element id of the combined fragment whose inline properties panel is open, or null. */
  inlineFragmentPanelId: string | null;
  /** Element id of the state invariant whose inline properties panel is open, or null. */
  inlineStateInvariantPanelId: string | null;
  /** Element id of the interaction use whose inline properties panel is open, or null. */
  inlineInteractionUsePanelId: string | null;
  /** Element id of the gate whose inline properties panel is open, or null. */
  inlineGatePanelId: string | null;

  // actions
  openClassEditor: (nodeId: string) => void;
  openMultiplicityEditor: (edgeId: string) => void;
  openClearConfirmation: () => void;
  openExportModal: () => void;
  openSingleGenerator: (nodeId?: string) => void; 
  openProjectGenerator: () => void;
  openReverseEngineering: () => void;
  openImportCode: () => void;
  openMethodGenerator: (nodeId: string) => void;
  openSSoTElementEditor: (elementId: string) => void;
  openSSoTClassEditor: (elementId: string) => void;
  openGlobalDelete: (elementId: string) => void;
  openOpenFileModal: () => void;
  openVfsEdgeAction: (edgeId: string, snapshot?: AnchorSnapshot | null) => void;
  openAutoLayoutLockedWarning: () => void;
  openCodeExportConfig: () => void;
  openKeyboardShortcuts: () => void;
  openWiki: () => void;
  openFeedback: () => void;
  openUseCaseSpec: (elementId: string) => void;
  openActorProps: (elementId: string) => void;
  openExtendProps: (edgeId: string) => void;
  openControlFlowProps: (edgeId: string) => void;
  /** Action/CallOperation node: pick the operation it invokes (ADR-0010). */
  openActivityActionProps: (elementId: string) => void;
  /** Swimlane header: pick the class/actor responsible for the lane (ADR-0010). */
  openActivityPartitionProps: (elementId: string) => void;
  /** Activity (diagram-level): pick the use case it realizes (ADR-0010). */
  openActivityProps: (activityId: string) => void;
  /** Object node: pick the classifier of the value that flows through it (ADR-0010). */
  openActivityObjectNodeProps: (elementId: string) => void;
  openActivityPinProps: (elementId: string) => void;
  /** Structured node: edit its test/guard condition (loop/conditional, v1.1). */
  openActivityStructuredProps: (elementId: string) => void;
  openDomainEntityProps: (elementId: string) => void;
  openDomainAssociationProps: (edgeId: string) => void;
  openFragmentProps: (fragmentId: string) => void;
  openMessageProps: (messageId: string) => void;
  openStateInvariantProps: (invariantId: string) => void;
  openInteractionUseProps: (useId: string) => void;
  openGateProps: (gateId: string) => void;
  openGeneralOrderingProps: (orderingId: string) => void;
  openTimeConstraintProps: (constraintId: string) => void;
  openCoregionProps: (coregionId: string) => void;
  openLifelineProps: (lifelineId: string) => void;
  openContinuationProps: (continuationId: string) => void;
  openSelfMessageWarning: (payload: { lifelineId: string; dropY?: number }) => void;
  closeModals: () => void;
  openInlineEdgePanel: (edgeId: string) => void;
  closeInlineEdgePanel: () => void;
  openInlineClassPanel: (elementId: string) => void;
  closeInlineClassPanel: () => void;
  openInlineUseCasePanel: (elementId: string) => void;
  closeInlineUseCasePanel: () => void;
  openInlineDomainPanel: (elementId: string) => void;
  closeInlineDomainPanel: () => void;
  openInlineActorPanel: (elementId: string) => void;
  closeInlineActorPanel: () => void;
  openInlineMessagePanel: (elementId: string) => void;
  closeInlineMessagePanel: () => void;
  openInlineFragmentPanel: (elementId: string) => void;
  closeInlineFragmentPanel: () => void;
  openInlineStateInvariantPanel: (elementId: string) => void;
  closeInlineStateInvariantPanel: () => void;
  openInlineInteractionUsePanel: (elementId: string) => void;
  closeInlineInteractionUsePanel: () => void;
  openInlineGatePanel: (elementId: string) => void;
  closeInlineGatePanel: () => void;
  openGetStarted: () => void;
  closeGetStarted: () => void;
  toggleGetStarted: () => void;
}

/** All inline-panel ids cleared — spread into an opener so only one panel is ever open. */
const NO_INLINE_PANELS = {
  inlineEdgePanelId: null,
  inlineClassPanelId: null,
  inlineUseCasePanelId: null,
  inlineDomainPanelId: null,
  inlineActorPanelId: null,
  inlineMessagePanelId: null,
  inlineFragmentPanelId: null,
  inlineStateInvariantPanelId: null,
  inlineInteractionUsePanelId: null,
  inlineGatePanelId: null,
} as const;

export const useUiStore = create<UiStoreState>((set) => ({
  activeModal: null,
  editingId: null,
  anchorSnapshot: null,
  pendingSelfMessage: null,
  isGetStartedOpen: false,
  inlineEdgePanelId: null,
  inlineClassPanelId: null,
  inlineUseCasePanelId: null,
  inlineDomainPanelId: null,
  inlineActorPanelId: null,
  inlineMessagePanelId: null,
  inlineFragmentPanelId: null,
  inlineStateInvariantPanelId: null,
  inlineInteractionUsePanelId: null,
  inlineGatePanelId: null,

  openClassEditor: (nodeId) =>
    set({ activeModal: "class-editor", editingId: nodeId }),

  openMultiplicityEditor: (edgeId) =>
    set({ activeModal: "multiplicity-editor", editingId: edgeId }),

  openClearConfirmation: () =>
    set({ activeModal: "clear-confirmation", editingId: null }),

  openExportModal: () => set({ activeModal: "export-modal", editingId: null }),

  openSingleGenerator: (nodeId?: string) =>
    set({ activeModal: "engineering-single", editingId: nodeId || null }),

  openProjectGenerator: () =>
    set({ activeModal: "engineering-project", editingId: null }),

  openReverseEngineering: () =>
    set({ activeModal: "engineering-reverse", editingId: null }),

  openImportCode: () =>
    set({ activeModal: "import-code", editingId: null }),

  openMethodGenerator: (nodeId) =>
    set({ activeModal: "method-generator", editingId: nodeId }),

  openSSoTElementEditor: (elementId) =>
    set({ activeModal: "ssot-element-editor", editingId: elementId }),

  openSSoTClassEditor: (elementId) =>
    set({ activeModal: "ssot-class-editor", editingId: elementId }),

  openGlobalDelete: (elementId) =>
    set({ activeModal: "global-delete", editingId: elementId }),

  openOpenFileModal: () =>
    set({ activeModal: "open-file", editingId: null }),

  openVfsEdgeAction: (edgeId, snapshot = null) =>
    set({ activeModal: "vfs-edge-action", editingId: edgeId, anchorSnapshot: snapshot }),

  openAutoLayoutLockedWarning: () =>
    set({ activeModal: "auto-layout-locked-warning", editingId: null }),

  openCodeExportConfig: () =>
    set({ activeModal: "code-export-config", editingId: null }),

  openKeyboardShortcuts: () =>
    set({ activeModal: "keyboard-shortcuts", editingId: null }),

  openWiki: () => set({ activeModal: "wiki", editingId: null }),

  openFeedback: () => set({ activeModal: "feedback", editingId: null }),
  openUseCaseSpec: (elementId) => set({ activeModal: "use-case-spec", editingId: elementId }),
  openActorProps: (elementId) => set({ activeModal: "actor-props", editingId: elementId }),
  openExtendProps: (edgeId) => set({ activeModal: "extend-props", editingId: edgeId }),
  openControlFlowProps: (edgeId) => set({ activeModal: "control-flow-props", editingId: edgeId }),
  openActivityActionProps: (elementId) => set({ activeModal: "activity-action-props", editingId: elementId }),
  openActivityPartitionProps: (elementId) => set({ activeModal: "activity-partition-props", editingId: elementId }),
  openActivityProps: (activityId) => set({ activeModal: "activity-props", editingId: activityId }),
  openActivityObjectNodeProps: (elementId) => set({ activeModal: "activity-objectnode-props", editingId: elementId }),
  openActivityPinProps: (elementId) => set({ activeModal: "activity-pin-props", editingId: elementId }),
  openActivityStructuredProps: (elementId) => set({ activeModal: "activity-structured-props", editingId: elementId }),
  openDomainEntityProps: (elementId) => set({ activeModal: "domain-entity-props", editingId: elementId }),
  openDomainAssociationProps: (edgeId) => set({ activeModal: "domain-association-props", editingId: edgeId }),
  openFragmentProps: (fragmentId) => set({ activeModal: "fragment-props", editingId: fragmentId }),
  openMessageProps: (messageId) => set({ activeModal: "message-props", editingId: messageId }),
  openStateInvariantProps: (invariantId) => set({ activeModal: "state-invariant-props", editingId: invariantId }),
  openInteractionUseProps: (useId) => set({ activeModal: "interaction-use-props", editingId: useId }),
  openGateProps: (gateId) => set({ activeModal: "gate-props", editingId: gateId }),
  openGeneralOrderingProps: (orderingId) => set({ activeModal: "general-ordering-props", editingId: orderingId }),
  openTimeConstraintProps: (constraintId) => set({ activeModal: "time-constraint-props", editingId: constraintId }),
  openCoregionProps: (coregionId) => set({ activeModal: "coregion-props", editingId: coregionId }),
  openLifelineProps: (lifelineId) => set({ activeModal: "lifeline-props", editingId: lifelineId }),
  openContinuationProps: (continuationId) => set({ activeModal: "continuation-props", editingId: continuationId }),
  openSelfMessageWarning: (payload) => set({ activeModal: "self-message-warning", pendingSelfMessage: payload }),

  closeModals: () => set({ activeModal: null, editingId: null, anchorSnapshot: null, pendingSelfMessage: null }),

  openInlineEdgePanel: (edgeId) =>
    set({ ...NO_INLINE_PANELS, inlineEdgePanelId: edgeId, activeModal: null, editingId: null }),
  closeInlineEdgePanel: () => set({ inlineEdgePanelId: null }),
  openInlineClassPanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineClassPanelId: elementId, activeModal: null, editingId: null }),
  closeInlineClassPanel: () => set({ inlineClassPanelId: null }),
  openInlineUseCasePanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineUseCasePanelId: elementId, activeModal: null, editingId: null }),
  closeInlineUseCasePanel: () => set({ inlineUseCasePanelId: null }),
  openInlineDomainPanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineDomainPanelId: elementId, activeModal: null, editingId: null }),
  closeInlineDomainPanel: () => set({ inlineDomainPanelId: null }),
  openInlineActorPanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineActorPanelId: elementId, activeModal: null, editingId: null }),
  closeInlineActorPanel: () => set({ inlineActorPanelId: null }),
  openInlineMessagePanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineMessagePanelId: elementId, activeModal: null, editingId: null }),
  closeInlineMessagePanel: () => set({ inlineMessagePanelId: null }),
  openInlineFragmentPanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineFragmentPanelId: elementId, activeModal: null, editingId: null }),
  closeInlineFragmentPanel: () => set({ inlineFragmentPanelId: null }),
  openInlineStateInvariantPanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineStateInvariantPanelId: elementId, activeModal: null, editingId: null }),
  closeInlineStateInvariantPanel: () => set({ inlineStateInvariantPanelId: null }),
  openInlineInteractionUsePanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineInteractionUsePanelId: elementId, activeModal: null, editingId: null }),
  closeInlineInteractionUsePanel: () => set({ inlineInteractionUsePanelId: null }),
  openInlineGatePanel: (elementId) =>
    set({ ...NO_INLINE_PANELS, inlineGatePanelId: elementId, activeModal: null, editingId: null }),
  closeInlineGatePanel: () => set({ inlineGatePanelId: null }),

  openGetStarted: () => set({ isGetStartedOpen: true }),
  closeGetStarted: () => set({ isGetStartedOpen: false }),
  toggleGetStarted: () => set((s) => ({ isGetStartedOpen: !s.isGetStartedOpen })),
}));