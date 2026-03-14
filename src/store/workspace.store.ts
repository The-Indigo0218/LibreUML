import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { DiagramFile, DiagramType, Viewport } from '../core/domain/workspace/diagram-file.types';
import { storageAdapter } from '../adapters/storage/storage.adapter';

/**
 * Workspace Store State - Multi-tab file management
 * 
 * This store manages the workspace UI state:
 * - Open diagram files (tabs)
 * - Active file selection
 * - Per-file viewport state
 * 
 * CRITICAL: DiagramFiles only store ID references to domain entities.
 * The actual domain data lives in ProjectStore (SSOT).
 */
interface WorkspaceStoreState {
  // === State ===
  files: DiagramFile[];
  activeFileId: string | null;

  // === File Management Actions ===
  addFile: (file: DiagramFile) => void;
  removeFile: (fileId: string) => void;
  updateFile: (fileId: string, updates: Partial<DiagramFile>) => void;
  getFile: (fileId: string) => DiagramFile | undefined;
  getActiveFile: () => DiagramFile | undefined;

  // === Active File Actions ===
  setActiveFile: (fileId: string) => void;
  switchFile: (fileId: string) => void;

  // === File Content Actions ===
  addNodeToFile: (fileId: string, nodeId: string) => void;
  removeNodeFromFile: (fileId: string, nodeId: string) => void;
  addEdgeToFile: (fileId: string, edgeId: string) => void;
  removeEdgeFromFile: (fileId: string, edgeId: string) => void;

  // === Viewport Actions ===
  updateFileViewport: (fileId: string, viewport: Viewport) => void;

  // === Dirty State Actions ===
  markFileDirty: (fileId: string) => void;
  markFileClean: (fileId: string) => void;

  // === Utility Actions ===
  createNewFile: (diagramType: DiagramType, name?: string) => DiagramFile;
  closeAllFiles: () => void;
}

/**
 * Workspace Store - Multi-tab file management
 * 
 * Architecture:
 * - Manages open diagram files (tabs)
 * - Each file references domain entities by ID
 * - Stores viewport state per file
 * - Tracks dirty state for unsaved changes
 * 
 * Persistence:
 * - Persisted to localStorage
 * - Restores open tabs on page refresh
 * - Preserves viewport positions
 * 
 * History (Phase 7):
 * - Tracks changes to positionMap (node positions)
 * - Supports undo/redo for layout changes (50 steps)
 * - History NOT persisted (memory only)
 */
export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    temporal(
      (set, get) => ({
        files: [],
        activeFileId: null,

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
        }),
    }),
    {
      // PHASE 7: Temporal (undo/redo) configuration for positions
      limit: 50,
      equality: (a, b) => a === b,
      partialize: (state) => {
        // Only track files array (which contains positionMap in metadata)
        // Don't track activeFileId changes
        const { files } = state;
        return { files } as any;
      },
    }
  ),
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
