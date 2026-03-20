import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useModelStore } from './model.store';
import type {
  LibreUMLProject,
  VFSFolder,
  VFSFile,
  DiagramType,
  FileExtension,
  DiagramView,
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
    isExternal?: boolean
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
}

export const useVFSStore = create<VFSStoreState>()(
  persist(
    (set) => ({
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

      createFile: (parentId, name, diagramType, extension, isExternal = false) => {
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

        const file: VFSFile = {
          id,
          name,
          type: 'FILE',
          parentId,
          diagramType,
          extension,
          isExternal,
          content,
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
    }),
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
    }
  )
);

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
