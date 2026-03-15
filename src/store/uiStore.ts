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
  | "method-generator"
  | "not-a-project"
  | "create-diagram"
  | null;

interface UiStoreState {
  // state
  activeModal: ActiveModal;
  editingId: string | null;
  pendingFileData: { fileName: string; content: string; fileType: 'luml' | 'xmi' } | null;
  isFileLoading: boolean;

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
  openNotAProjectModal: (fileName: string, content: string, fileType: 'luml' | 'xmi') => void;
  openCreateDiagram: () => void;
  setIsFileLoading: (isLoading: boolean) => void;
  closeModals: () => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeModal:null,
  editingId: null,
  pendingFileData: null,
  isFileLoading: false,

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

  openNotAProjectModal: (fileName, content, fileType) =>
    set({ 
      activeModal: "not-a-project", 
      editingId: null,
      pendingFileData: { fileName, content, fileType }
    }),

  openCreateDiagram: () =>
    set({ activeModal: "create-diagram", editingId: null }),

  setIsFileLoading: (isLoading) =>
    set({ isFileLoading: isLoading }),

  closeModals: () => set({ activeModal: null, editingId: null, pendingFileData: null }),
}));