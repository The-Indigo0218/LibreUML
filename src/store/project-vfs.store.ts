import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { useModelStore } from './model.store';
import type {
  LibreUMLProject,
  VFSFolder,
  VFSFile,
  DiagramType,
  FileExtension,
  DiagramView,
  SemanticModel,
} from '../core/domain/vfs/vfs.types';
import { storageAdapter } from '../adapters/storage/storage.adapter';

type VFSNode = VFSFolder | VFSFile;

interface VFSStoreState {
  project: LibreUMLProject | null;
  isLoading: boolean;

  loadProject: (project: LibreUMLProject) => void;
  closeProject: () => void;
  renameProject: (newName: string) => void;
  updateProjectProperties: (
    props: Partial<Pick<LibreUMLProject, 'version' | 'author' | 'description' | 'targetLanguage' | 'basePackage'>>
  ) => void;
  createFolder: (parentId: string | null, name: string) => string;
  createFile: (
    parentId: string | null,
    name: string,
    diagramType: DiagramType,
    extension: FileExtension,
    isExternal?: boolean,
    standalone?: boolean
  ) => string;
  deleteNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newName: string) => void;
  updateNode: (nodeId: string, updates: Partial<VFSFile | VFSFolder>) => void;
  updateFileContent: (fileId: string, content: DiagramView | unknown) => void;
  /**
   * Cascade-removes a deleted semantic element from every diagram in the project.
   * Called after ModelStore.deleteClass/Interface/Enum to ensure no ghost ViewNodes
   * or ViewEdges remain in any VFS file.
   *
   * @param elementId     - The IR element that was deleted.
   * @param relationIds   - Set of relation IDs that were cascade-deleted alongside it.
   */
  purgeElementFromAllDiagrams: (elementId: string, relationIds: Set<string>) => void;
  /**
   * Initialises an empty SemanticModel as the localModel for a standalone file.
   * Safe to call multiple times — no-ops if localModel is already present.
   */
  initLocalModel: (fileId: string) => void;
  /**
   * Runs a plain-object mutation on a file's localModel via a deep-clone cycle.
   * The updater receives a mutable copy of the current localModel. No-ops when
   * the file does not exist or has no localModel.
   */
  updateLocalModel: (fileId: string, updater: (draft: SemanticModel) => void) => void;
}

export const useVFSStore = create<VFSStoreState>()(
  temporal(
  persist(
    immer((set) => ({
      project: null,
      isLoading: false,

      loadProject: (project) =>
        set({
          project,
          isLoading: false,
        }),

      closeProject: () => {
        set({ project: null, isLoading: false });
        useModelStore.getState().resetModel();
      },

      renameProject: (newName) =>
        set((state) => {
          if (!state.project || !newName.trim()) return state;
          return {
            project: {
              ...state.project,
              projectName: newName.trim(),
              updatedAt: Date.now(),
            },
          };
        }),

      updateProjectProperties: (props) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              ...props,
              updatedAt: Date.now(),
            },
          };
        }),

      createFolder: (parentId, name) => {
        const id = crypto.randomUUID();
        const now = Date.now();

        const folder: VFSFolder = {
          id,
          name,
          type: 'FOLDER',
          parentId,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          if (!state.project) return state;

          return {
            project: {
              ...state.project,
              nodes: {
                ...state.project.nodes,
                [id]: folder,
              },
              updatedAt: now,
            },
          };
        });

        return id;
      },

      createFile: (parentId, name, diagramType, extension, isExternal = false, standalone = false) => {
        const id = crypto.randomUUID();
        const now = Date.now();

        const content: DiagramView | null =
          extension === '.luml'
            ? {
                diagramId: id,
                nodes: [],
                edges: [],
              }
            : null;

        // Seed an empty localModel for new standalone .luml files so the
        // canvas never needs to call initLocalModel on first open.
        const localModel: SemanticModel | null =
          standalone && extension === '.luml'
            ? {
                id: crypto.randomUUID(),
                name: `${name} (standalone)`,
                version: '1.0.0',
                packages: {},
                classes: {},
                interfaces: {},
                enums: {},
                dataTypes: {},
                attributes: {},
                operations: {},
                actors: {},
                useCases: {},
                activityNodes: {},
                objectInstances: {},
                components: {},
                nodes: {},
                artifacts: {},
                relations: {},
                createdAt: now,
                updatedAt: now,
              }
            : null;

        const file: VFSFile = {
          id,
          name,
          type: 'FILE',
          parentId,
          diagramType,
          extension,
          isExternal,
          standalone,
          content,
          localModel,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          if (!state.project) return state;

          return {
            project: {
              ...state.project,
              nodes: {
                ...state.project.nodes,
                [id]: file,
              },
              updatedAt: now,
            },
          };
        });

        return id;
      },

      deleteNode: (nodeId) => {
        set((state) => {
          if (!state.project) return state;

          const nodesToDelete = new Set<string>();
          nodesToDelete.add(nodeId);

          const collectChildren = (parentId: string) => {
            Object.values(state.project!.nodes).forEach((node) => {
              if (node.parentId === parentId) {
                nodesToDelete.add(node.id);
                if (node.type === 'FOLDER') {
                  collectChildren(node.id);
                }
              }
            });
          };

          const targetNode = state.project.nodes[nodeId];
          if (targetNode?.type === 'FOLDER') {
            collectChildren(nodeId);
          }

          const newNodes = { ...state.project.nodes };
          nodesToDelete.forEach((id) => {
            delete newNodes[id];
          });

          return {
            project: {
              ...state.project,
              nodes: newNodes,
              updatedAt: Date.now(),
            },
          };
        });
      },

      renameNode: (nodeId, newName) => {
        set((state) => {
          if (!state.project) return state;

          const existingNode = state.project.nodes[nodeId];
          if (!existingNode) return state;

          return {
            project: {
              ...state.project,
              nodes: {
                ...state.project.nodes,
                [nodeId]: {
                  ...existingNode,
                  name: newName,
                  updatedAt: Date.now(),
                } as VFSNode,
              },
              updatedAt: Date.now(),
            },
          };
        });
      },

      updateNode: (nodeId, updates) => {
        set((state) => {
          if (!state.project) return state;

          const existingNode = state.project.nodes[nodeId];
          if (!existingNode) return state;

          return {
            project: {
              ...state.project,
              nodes: {
                ...state.project.nodes,
                [nodeId]: {
                  ...existingNode,
                  ...updates,
                  updatedAt: Date.now(),
                } as VFSNode,
              },
              updatedAt: Date.now(),
            },
          };
        });
      },

      purgeElementFromAllDiagrams: (elementId, relationIds) => {
        set((state) => {
          if (!state.project) return state;

          let changed = false;
          const updatedNodes = { ...state.project.nodes };

          Object.entries(state.project.nodes).forEach(([fileId, node]) => {
            if (node.type !== 'FILE') return;
            const content = (node as VFSFile).content;

            if (
              content === null ||
              typeof content !== 'object' ||
              !('diagramId' in (content as object)) ||
              !('nodes' in (content as object)) ||
              !('edges' in (content as object)) ||
              !Array.isArray((content as DiagramView).nodes) ||
              !Array.isArray((content as DiagramView).edges)
            ) return;

            const view = content as DiagramView;
            const filteredNodes = view.nodes.filter((vn) => vn.elementId !== elementId);
            const filteredEdges = view.edges.filter((ve) => !relationIds.has(ve.relationId));

            if (
              filteredNodes.length !== view.nodes.length ||
              filteredEdges.length !== view.edges.length
            ) {
              changed = true;
              updatedNodes[fileId] = {
                ...node,
                content: { ...view, nodes: filteredNodes, edges: filteredEdges },
                updatedAt: Date.now(),
              } as VFSFile;
            }
          });

          if (!changed) return state;

          return {
            project: {
              ...state.project,
              nodes: updatedNodes,
              updatedAt: Date.now(),
            },
          };
        });
      },

      initLocalModel: (fileId) => {
        set((state) => {
          if (!state.project) return state;
          const node = state.project.nodes[fileId];
          if (!node || node.type !== 'FILE') return state;
          const file = node as VFSFile;
          if (file.localModel) return state; // already initialised — no-op
          const now = Date.now();
          const emptyModel: SemanticModel = {
            id: crypto.randomUUID(),
            name: `${file.name} (standalone)`,
            version: '1.0.0',
            packages: {},
            classes: {},
            interfaces: {},
            enums: {},
            dataTypes: {},
            attributes: {},
            operations: {},
            actors: {},
            useCases: {},
            activityNodes: {},
            objectInstances: {},
            components: {},
            nodes: {},
            artifacts: {},
            relations: {},
            createdAt: now,
            updatedAt: now,
          };
          return {
            project: {
              ...state.project,
              nodes: {
                ...state.project.nodes,
                [fileId]: { ...file, localModel: emptyModel, updatedAt: now } as VFSFile,
              },
              updatedAt: now,
            },
          };
        });
      },

      updateLocalModel: (fileId, updater) => {
        set((state) => {
          if (!state.project) return state;
          const node = state.project.nodes[fileId];
          if (!node || node.type !== 'FILE') return state;
          const file = node as VFSFile;
          if (!file.localModel) return state; // must call initLocalModel first
          // Deep-clone so the updater can mutate safely without immer
          const draft = JSON.parse(JSON.stringify(file.localModel)) as SemanticModel;
          updater(draft);
          return {
            project: {
              ...state.project,
              nodes: {
                ...state.project.nodes,
                [fileId]: { ...file, localModel: draft, updatedAt: Date.now() } as VFSFile,
              },
              updatedAt: Date.now(),
            },
          };
        });
      },

      updateFileContent: (fileId, content) => {
        set((state) => {
          if (!state.project) return state;

          const existingNode = state.project.nodes[fileId];
          if (!existingNode || existingNode.type !== 'FILE') return state;

          return {
            project: {
              ...state.project,
              nodes: {
                ...state.project.nodes,
                [fileId]: {
                  ...existingNode,
                  content,
                  updatedAt: Date.now(),
                } as VFSFile,
              },
              updatedAt: Date.now(),
            },
          };
        });
      },
    })),
    {
      name: 'libreuml-vfs-storage',
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
      onRehydrateStorage: () => {
        return () => {
          // Clear undo history created by persist rehydration —
          // loading from storage is not a user action.
          // Wrapped in setTimeout to avoid TDZ (Temporal Dead Zone) issue:
          // onRehydrateStorage fires during create(), before useVFSStore is assigned.
          setTimeout(() => {
            useVFSStore.temporal.getState().clear();
          }, 0);
        };
      },
    }
  ),
  {
    limit: 50,
    equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    partialize: (state) => ({ project: state.project }),
  },
  )
);

/**
 * Runs a callback with temporal tracking paused on BOTH stores.
 * Used for position-only updates that shouldn't create undo history.
 */
export function withoutUndo(fn: () => void): void {
  const vfsTemporalStore = useVFSStore.temporal.getState();
  const modelTemporalStore = useModelStore.temporal.getState();
  
  vfsTemporalStore.pause();
  modelTemporalStore.pause();
  
  fn();
  
  vfsTemporalStore.resume();
  modelTemporalStore.resume();
}

export function getNodePath(
  nodeId: string,
  nodes: Record<string, VFSNode>
): string {
  const path: string[] = [];
  let currentId: string | null = nodeId;

  while (currentId !== null) {
    const currentNode: VFSNode | undefined = nodes[currentId];
    if (!currentNode) break;

    path.unshift(currentNode.name);
    currentId = currentNode.parentId;
  }

  return '/' + path.join('/');
}
