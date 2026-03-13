import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiagramFile, DiagramType, Viewport } from '../core/domain/workspace/diagram-file.types';

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
 */
export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set, get) => ({
      // === Initial State ===
      files: [],
      activeFileId: null,

      // === File Management Actions ===

      /**
       * Adds a new file to the workspace.
       * Automatically sets it as the active file.
       */
      addFile: (file) =>
        set((state) => ({
          files: [...state.files, file],
          activeFileId: file.id,
        })),

      /**
       * Removes a file from the workspace.
       * If the removed file was active, switches to the previous file.
       */
      removeFile: (fileId) =>
        set((state) => {
          const newFiles = state.files.filter((f) => f.id !== fileId);
          
          let newActiveFileId = state.activeFileId;
          
          // If we removed the active file, switch to another
          if (state.activeFileId === fileId) {
            if (newFiles.length > 0) {
              // Switch to the last file
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

      /**
       * Updates a file with partial data.
       * Automatically updates the `updatedAt` timestamp.
       */
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

      /**
       * Gets a file by ID.
       */
      getFile: (fileId) => {
        return get().files.find((f) => f.id === fileId);
      },

      /**
       * Gets the currently active file.
       */
      getActiveFile: () => {
        const { files, activeFileId } = get();
        if (!activeFileId) return undefined;
        return files.find((f) => f.id === activeFileId);
      },

      // === Active File Actions ===

      /**
       * Sets the active file by ID.
       */
      setActiveFile: (fileId) =>
        set({
          activeFileId: fileId,
        }),

      /**
       * Switches to a different file (alias for setActiveFile).
       */
      switchFile: (fileId) => {
        get().setActiveFile(fileId);
      },

      // === File Content Actions ===

      /**
       * Adds a node ID to a file's nodeIds array.
       * Marks the file as dirty.
       */
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

      /**
       * Removes a node ID from a file's nodeIds array.
       * Marks the file as dirty.
       */
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

      /**
       * Adds an edge ID to a file's edgeIds array.
       * Marks the file as dirty.
       */
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

      /**
       * Removes an edge ID from a file's edgeIds array.
       * Marks the file as dirty.
       */
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

      // === Viewport Actions ===

      /**
       * Updates the viewport state for a specific file.
       * Used when user pans/zooms the canvas.
       */
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

      // === Dirty State Actions ===

      /**
       * Marks a file as having unsaved changes.
       */
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

      /**
       * Marks a file as saved (no unsaved changes).
       */
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

      // === Utility Actions ===

      /**
       * Creates a new diagram file with default settings.
       * Returns the created file (does not add it to the store).
       */
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

      /**
       * Closes all open files.
       * USE WITH CAUTION: Unsaved changes will be lost.
       */
      closeAllFiles: () =>
        set({
          files: [],
          activeFileId: null,
        }),
    }),
    {
      name: 'libreuml-workspace-storage',
      version: 1,
    }
  )
);
