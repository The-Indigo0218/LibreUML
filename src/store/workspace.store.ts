import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiagramFile, DiagramType, Viewport } from '../core/domain/workspace/diagram-file.types';
import { storageAdapter } from '../adapters/storage/storage.adapter';

interface WorkspaceStoreState {
  openTabs: string[];
  activeTabId: string | null;
  files: DiagramFile[];
  activeFileId: string | null;

  openTab: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  setActiveTab: (fileId: string) => void;
  closeAllTabs: () => void;

  addFile: (file: DiagramFile) => void;
  removeFile: (fileId: string) => void;
  updateFile: (fileId: string, updates: Partial<DiagramFile>) => void;
  getFile: (fileId: string) => DiagramFile | undefined;
  getActiveFile: () => DiagramFile | undefined;
  setActiveFile: (fileId: string) => void;
  switchFile: (fileId: string) => void;
  addNodeToFile: (fileId: string, nodeId: string) => void;
  removeNodeFromFile: (fileId: string, nodeId: string) => void;
  addEdgeToFile: (fileId: string, edgeId: string) => void;
  removeEdgeFromFile: (fileId: string, edgeId: string) => void;
  updateFileViewport: (fileId: string, viewport: Viewport) => void;
  markFileDirty: (fileId: string) => void;
  markFileClean: (fileId: string) => void;
  createNewFile: (diagramType: DiagramType, name?: string) => DiagramFile;
  closeAllFiles: () => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set, get) => ({
      openTabs: [],
      activeTabId: null,
      files: [],
      activeFileId: null,

      openTab: (fileId) =>
        set((state) => {
          if (state.openTabs.includes(fileId)) {
            return { activeTabId: fileId };
          }
          return {
            openTabs: [...state.openTabs, fileId],
            activeTabId: fileId,
          };
        }),

      closeTab: (fileId) =>
        set((state) => {
          const newOpenTabs = state.openTabs.filter((id) => id !== fileId);
          let newActiveTabId = state.activeTabId;

          if (state.activeTabId === fileId) {
            if (newOpenTabs.length === 0) {
              newActiveTabId = null;
            } else {
              const closedIndex = state.openTabs.indexOf(fileId);
              if (closedIndex > 0) {
                newActiveTabId = newOpenTabs[closedIndex - 1];
              } else {
                newActiveTabId = newOpenTabs[0];
              }
            }
          }

          return {
            openTabs: newOpenTabs,
            activeTabId: newActiveTabId,
          };
        }),

      setActiveTab: (fileId) =>
        set({
          activeTabId: fileId,
        }),

      closeAllTabs: () =>
        set({
          openTabs: [],
          activeTabId: null,
        }),

      addFile: (file) =>
        set((state) => ({
          files: [...state.files, file],
          activeFileId: file.id,
        })),

      removeFile: (fileId) =>
        set((state) => {
          const newFiles = state.files.filter((f) => f.id !== fileId);
          let newActiveFileId = state.activeFileId;

          if (state.activeFileId === fileId) {
            if (newFiles.length > 0) {
              newActiveFileId = newFiles[newFiles.length - 1].id;
            } else {
              newActiveFileId = null;
            }
          }

          return {
            files: newFiles,
            activeFileId: newActiveFileId,
          };
        }),

      updateFile: (fileId, updates) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  ...updates,
                  updatedAt: Date.now(),
                }
              : file
          ),
        })),

      getFile: (fileId) => {
        return get().files.find((f) => f.id === fileId);
      },

      getActiveFile: () => {
        const { files, activeFileId } = get();
        if (!activeFileId) return undefined;
        return files.find((f) => f.id === activeFileId);
      },

      setActiveFile: (fileId) =>
        set({
          activeFileId: fileId,
        }),

      switchFile: (fileId) => {
        get().setActiveFile(fileId);
      },

      addNodeToFile: (fileId, nodeId) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  nodeIds: [...file.nodeIds, nodeId],
                  isDirty: true,
                  updatedAt: Date.now(),
                }
              : file
          ),
        })),

      removeNodeFromFile: (fileId, nodeId) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  nodeIds: file.nodeIds.filter((id) => id !== nodeId),
                  isDirty: true,
                  updatedAt: Date.now(),
                }
              : file
          ),
        })),

      addEdgeToFile: (fileId, edgeId) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  edgeIds: [...file.edgeIds, edgeId],
                  isDirty: true,
                  updatedAt: Date.now(),
                }
              : file
          ),
        })),

      removeEdgeFromFile: (fileId, edgeId) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  edgeIds: file.edgeIds.filter((id) => id !== edgeId),
                  isDirty: true,
                  updatedAt: Date.now(),
                }
              : file
          ),
        })),

      updateFileViewport: (fileId, viewport) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  viewport,
                  updatedAt: Date.now(),
                }
              : file
          ),
        })),

      markFileDirty: (fileId) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  isDirty: true,
                  updatedAt: Date.now(),
                }
              : file
          ),
        })),

      markFileClean: (fileId) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  isDirty: false,
                }
              : file
          ),
        })),

      createNewFile: (diagramType, name) => {
        const now = Date.now();
        const file: DiagramFile = {
          id: crypto.randomUUID(),
          name: name || `Untitled ${diagramType}`,
          diagramType,
          nodeIds: [],
          edgeIds: [],
          viewport: {
            x: 0,
            y: 0,
            zoom: 1,
          },
          isDirty: false,
          createdAt: now,
          updatedAt: now,
        };
        return file;
      },

      closeAllFiles: () =>
        set({
          files: [],
          activeFileId: null,
          openTabs: [],
          activeTabId: null,
        }),
    }),
    {
      name: 'libreuml-workspace-storage',
      version: 1,
      storage: {
        getItem: (name) => {
          const value = storageAdapter.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          storageAdapter.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          storageAdapter.removeItem(name);
        },
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.files.length === 0) {
          const defaultFile = state.createNewFile('CLASS_DIAGRAM', 'Untitled Diagram');
          state.addFile(defaultFile);
        }
      },
    }
  )
);
