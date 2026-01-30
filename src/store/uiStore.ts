import { create } from "zustand";

// Define the types for active modals in the UI
export type ActiveModal =
  | "none"
  | "class-editor"
  | "multiplicity-editor"
  | "clear-confirmation"
  | "export-modal"
  | "engineering-single"
  | "engineering-project"
  | "engineering-reverse"
  | "import-code"
  | null;

interface UiStoreState {
  // state
  activeModal: ActiveModal;
  editingId: string | null;

  // actions
  openClassEditor: (nodeId: string) => void;
  openMultiplicityEditor: (edgeId: string) => void;
  openClearConfirmation: () => void;
  openExportModal: () => void;
  openSingleGenerator: (nodeId?: string) => void; 
  openProjectGenerator: () => void;
  openReverseEngineering: () => void;
  openImportCode: () => void;
  closeModals: () => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeModal:null,
  editingId: null,

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

  closeModals: () => set({ activeModal: "none", editingId: null }),
}));