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
  | "engineering-reverse";

interface UiStoreState {
  // state
  activeModal: ActiveModal;
  editingId: string | null;

  // actions
  openClassEditor: (nodeId: string) => void;
  openMultiplicityEditor: (edgeId: string) => void;
  openClearConfirmation: () => void;
  openExportModal: () => void;
  openSingleGenerator: () => void;
  openProjectGenerator: () => void;
  openReverseEngineering: () => void;
  closeModals: () => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeModal: "none",
  editingId: null,

  openClassEditor: (nodeId) =>
    set({ activeModal: "class-editor", editingId: nodeId }),

  openMultiplicityEditor: (edgeId) =>
    set({ activeModal: "multiplicity-editor", editingId: edgeId }),

  openClearConfirmation: () =>
    set({ activeModal: "clear-confirmation", editingId: null }),

  openExportModal: () => set({ activeModal: "export-modal", editingId: null }),

  openSingleGenerator: () =>
    set({ activeModal: "engineering-single", editingId: null }),
  openProjectGenerator: () =>
    set({ activeModal: "engineering-project", editingId: null }),
  openReverseEngineering: () =>
    set({ activeModal: "engineering-reverse", editingId: null }),

  closeModals: () => set({ activeModal: "none", editingId: null }),
}));
