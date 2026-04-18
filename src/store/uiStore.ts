import { create } from "zustand";

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
  | null;

interface UiStoreState {
  // state
  activeModal: ActiveModal;
  editingId: string | null;
  isGetStartedOpen: boolean;

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
  openVfsEdgeAction: (edgeId: string) => void;
  openAutoLayoutLockedWarning: () => void;
  openCodeExportConfig: () => void;
  openKeyboardShortcuts: () => void;
  openWiki: () => void;
  openFeedback: () => void;
  closeModals: () => void;
  openGetStarted: () => void;
  closeGetStarted: () => void;
  toggleGetStarted: () => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeModal: null,
  editingId: null,
  isGetStartedOpen: false,

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

  openVfsEdgeAction: (edgeId) =>
    set({ activeModal: "vfs-edge-action", editingId: edgeId }),

  openAutoLayoutLockedWarning: () =>
    set({ activeModal: "auto-layout-locked-warning", editingId: null }),

  openCodeExportConfig: () =>
    set({ activeModal: "code-export-config", editingId: null }),

  openKeyboardShortcuts: () =>
    set({ activeModal: "keyboard-shortcuts", editingId: null }),

  openWiki: () => set({ activeModal: "wiki", editingId: null }),

  openFeedback: () => set({ activeModal: "feedback", editingId: null }),

  closeModals: () => set({ activeModal: null, editingId: null }),

  openGetStarted: () => set({ isGetStartedOpen: true }),
  closeGetStarted: () => set({ isGetStartedOpen: false }),
  toggleGetStarted: () => set((s) => ({ isGetStartedOpen: !s.isGetStartedOpen })),
}));