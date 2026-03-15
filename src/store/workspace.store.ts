import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { DiagramFile, DiagramType, Viewport } from '../core/domain/workspace/diagram-file.types';
import { createEmptyHistory } from '../core/domain/workspace/history.types';
import { storageAdapter } from '../adapters/storage/storage.adapter';
import { useProjectStore } from './project.store';

/**
 * Workspace Store State - Multi-tab file management
 * 
 * This store manages the workspace UI state:
 * - Open diagram files (tabs)
 * - Active file selection
 * - Per-file viewport state
 * 
 * PHASE 9.5: Added freeze/hydrate architecture for true state isolation.
 * Each file stores its own snapshot of nodes and edges in the `data` property.
 */
interface WorkspaceStoreState {
  // === State ===
  files: DiagramFile[];
  activeFileId: string | null;
  projectName: string;

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
  clearWorkspace: () => void;
  
  // === Project Actions ===
  setProjectName: (name: string) => void;
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
        projectName: "Untitled Project",

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

      /**
       * PHASE 9.5: Context Switching with Freeze/Hydrate
       * PHASE 9.6.3: Simplified - history is now stored per-file, no swapping needed
       * 
       * Orchestrates the complete tab switch sequence:
       * 1. FREEZE: Save current ProjectStore state into the currently active file's data
       * 2. SWITCH: Change activeFileId to the new target
       * 3. HYDRATE: Load the new file's data into ProjectStore
       * 
       * History is now automatically preserved because it's stored in file.data.history
       * and managed by useFileHistory hook, not by Zundo's global temporal state.
       */
      switchFile: (fileId) => {
        const currentActiveFileId = get().activeFileId;
        
        // FREEZE: Save current state before switching (if there is an active file)
        if (currentActiveFileId) {
          const currentFile = get().getFile(currentActiveFileId);
          if (currentFile) {
            const projectState = useProjectStore.getState();
            const currentNodes = Object.values(projectState.nodes);
            const currentEdges = Object.values(projectState.edges);
            
            // Freeze current state into the file's data property
            // History is already stored in file.data.history by useFileHistory
            get().updateFile(currentActiveFileId, {
              data: {
                ...currentFile.data,
                nodes: currentNodes,
                edges: currentEdges,
                // history is preserved from currentFile.data.history
              },
            });
            
            console.log(`[WorkspaceStore] FREEZE: Saved ${currentNodes.length} nodes and ${currentEdges.length} edges to file ${currentFile.name}`);
          }
        }
        
        // SWITCH: Change active file
        get().setActiveFile(fileId);
        
        // HYDRATE: Load new file's data into ProjectStore
        const newFile = get().getFile(fileId);
        if (newFile) {
          const projectStore = useProjectStore.getState();
          
          // Clear ProjectStore completely
          projectStore.clearAll();
          
          // Hydrate with new file's data
          if (newFile.data.nodes.length > 0) {
            projectStore.addNodes(newFile.data.nodes);
          }
          if (newFile.data.edges.length > 0) {
            projectStore.addEdges(newFile.data.edges);
          }
          
          console.log(`[WorkspaceStore] HYDRATE: Loaded ${newFile.data.nodes.length} nodes and ${newFile.data.edges.length} edges from file ${newFile.name}`);
          console.log(`[WorkspaceStore] History is managed per-file by useFileHistory hook`);
        }
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
          data: {
            nodes: [],
            edges: [],
            history: createEmptyHistory(), // Initialize with empty custom history
          },
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

      clearWorkspace: () =>
        set({
          files: [],
          activeFileId: null,
        }),

      setProjectName: (name) =>
        set({
          projectName: name,
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
    // PHASE 8.2: Removed auto-create behavior to allow Welcome Screen
    // onRehydrateStorage: () => (state) => {
    //   if (state && state.files.length === 0) {
    //     const defaultFile = state.createNewFile('CLASS_DIAGRAM', 'Untitled Diagram');
    //     state.addFile(defaultFile);
    //   }
    // },
  }
  )
);
