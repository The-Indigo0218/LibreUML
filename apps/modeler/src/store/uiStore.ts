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
  isGetStartedOpen: boolean;
  /** Edge id whose inline properties panel (R9) is open, or null. */
  inlineEdgePanelId: string | null;
  /** Element id of the class whose inline properties panel (R9) is open, or null. */
  inlineClassPanelId: string | null;
  /** Element id of the use case whose inline properties panel (R9 #2) is open, or null. */
  inlineUseCasePanelId: string | null;
  /** Element id of the domain entity whose inline properties panel (R9 #2) is open, or null. */
  inlineDomainPanelId: string | null;

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
  openDomainEntityProps: (elementId: string) => void;
  openDomainAssociationProps: (edgeId: string) => void;
  openFragmentProps: (fragmentId: string) => void;
  openMessageProps: (messageId: string) => void;
  openStateInvariantProps: (invariantId: string) => void;
  openInteractionUseProps: (useId: string) => void;
  openGateProps: (gateId: string) => void;
  closeModals: () => void;
  openInlineEdgePanel: (edgeId: string) => void;
  closeInlineEdgePanel: () => void;
  openInlineClassPanel: (elementId: string) => void;
  closeInlineClassPanel: () => void;
  openInlineUseCasePanel: (elementId: string) => void;
  closeInlineUseCasePanel: () => void;
  openInlineDomainPanel: (elementId: string) => void;
  closeInlineDomainPanel: () => void;
  openGetStarted: () => void;
  closeGetStarted: () => void;
  toggleGetStarted: () => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeModal: null,
  editingId: null,
  anchorSnapshot: null,
  isGetStartedOpen: false,
  inlineEdgePanelId: null,
  inlineClassPanelId: null,
  inlineUseCasePanelId: null,
  inlineDomainPanelId: null,

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
  openDomainEntityProps: (elementId) => set({ activeModal: "domain-entity-props", editingId: elementId }),
  openDomainAssociationProps: (edgeId) => set({ activeModal: "domain-association-props", editingId: edgeId }),
  openFragmentProps: (fragmentId) => set({ activeModal: "fragment-props", editingId: fragmentId }),
  openMessageProps: (messageId) => set({ activeModal: "message-props", editingId: messageId }),
  openStateInvariantProps: (invariantId) => set({ activeModal: "state-invariant-props", editingId: invariantId }),
  openInteractionUseProps: (useId) => set({ activeModal: "interaction-use-props", editingId: useId }),
  openGateProps: (gateId) => set({ activeModal: "gate-props", editingId: gateId }),

  closeModals: () => set({ activeModal: null, editingId: null, anchorSnapshot: null }),

  // Opening an inline panel closes any modal and every other inline panel.
  openInlineEdgePanel: (edgeId) =>
    set({ inlineEdgePanelId: edgeId, inlineClassPanelId: null, inlineUseCasePanelId: null, inlineDomainPanelId: null, activeModal: null, editingId: null }),
  closeInlineEdgePanel: () => set({ inlineEdgePanelId: null }),
  openInlineClassPanel: (elementId) =>
    set({ inlineClassPanelId: elementId, inlineEdgePanelId: null, inlineUseCasePanelId: null, inlineDomainPanelId: null, activeModal: null, editingId: null }),
  closeInlineClassPanel: () => set({ inlineClassPanelId: null }),
  openInlineUseCasePanel: (elementId) =>
    set({ inlineUseCasePanelId: elementId, inlineEdgePanelId: null, inlineClassPanelId: null, inlineDomainPanelId: null, activeModal: null, editingId: null }),
  closeInlineUseCasePanel: () => set({ inlineUseCasePanelId: null }),
  openInlineDomainPanel: (elementId) =>
    set({ inlineDomainPanelId: elementId, inlineEdgePanelId: null, inlineClassPanelId: null, inlineUseCasePanelId: null, activeModal: null, editingId: null }),
  closeInlineDomainPanel: () => set({ inlineDomainPanelId: null }),

  openGetStarted: () => set({ isGetStartedOpen: true }),
  closeGetStarted: () => set({ isGetStartedOpen: false }),
  toggleGetStarted: () => set((s) => ({ isGetStartedOpen: !s.isGetStartedOpen })),
}));