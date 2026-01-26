import { create } from "zustand";

// Define the types for active modals in the UI
export type ActiveModal = 
  | "none" 
  | "class-editor" 
  | "multiplicity-editor" 
  | "clear-confirmation"; 

interface UiStoreState {
  // state
  activeModal: ActiveModal;
  editingId: string | null; 

  // actions
  openClassEditor: (nodeId: string) => void;
  openMultiplicityEditor: (edgeId: string) => void;
  openClearConfirmation: () => void;
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

  closeModals: () =>
    set({ activeModal: "none", editingId: null }),
}));