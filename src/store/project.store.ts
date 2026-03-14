import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DomainNode } from '../core/domain/models/nodes';
import type { DomainEdge } from '../core/domain/models/edges';
import { normalizeAllNodeTypes } from './migrations/normalize-node-types';
import { storageAdapter } from '../adapters/storage/storage.adapter';

/**
 * Project Store State - Single Source of Truth (SSOT)
 * 
 * This store contains ALL domain entities (nodes and edges) across ALL diagrams.
 * Entities are stored ONCE in dictionaries and referenced by ID from DiagramFiles.
 * 
 * CRITICAL: This store contains ONLY pure domain data, NO UI state.
 */
interface ProjectStoreState {
  // === SSOT: Domain Entities ===
  nodes: Record<string, DomainNode>;
  edges: Record<string, DomainEdge>;

  // === Node Actions ===
  addNode: (node: DomainNode) => void;
  updateNode: (nodeId: string, updates: Partial<DomainNode>) => void;
  removeNode: (nodeId: string) => void;
  getNode: (nodeId: string) => DomainNode | undefined;
  getNodes: (nodeIds: string[]) => DomainNode[];

  // === Edge Actions ===
  addEdge: (edge: DomainEdge) => void;
  updateEdge: (edgeId: string, updates: Partial<DomainEdge>) => void;
  removeEdge: (edgeId: string) => void;
  getEdge: (edgeId: string) => DomainEdge | undefined;
  getEdges: (edgeIds: string[]) => DomainEdge[];

  // === Bulk Operations ===
  addNodes: (nodes: DomainNode[]) => void;
  addEdges: (edges: DomainEdge[]) => void;
  removeNodes: (nodeIds: string[]) => void;
  removeEdges: (edgeIds: string[]) => void;

  // === Utility Actions ===
  clearAll: () => void;
  getEdgesForNode: (nodeId: string) => DomainEdge[];
  getEdgeIdsForNode: (nodeId: string) => string[];
  getEdgeIdsForNodes: (nodeIds: string[]) => string[];
}

/**
 * Project Store - SSOT for all domain entities
 * 
 * Architecture:
 * - Stores domain entities ONCE in dictionaries
 * - No duplication across diagrams
 * - No UI state (position, selection, etc.)
 * - Pure domain data only
 * 
 * Persistence:
 * - Persisted to localStorage
 * - Survives page refreshes
 * - Can be exported/imported for file saving
 */
export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      nodes: {},
      edges: {},


      addNode: (node) =>
        set((state) => ({
          nodes: {
            ...state.nodes,
            [node.id]: node,
          },
        })),


      updateNode: (nodeId, updates) =>
        set((state) => {
          const existingNode = state.nodes[nodeId];
          if (!existingNode) {
            console.warn(`Cannot update node ${nodeId}: not found`);
            return state;
          }

          return {
            nodes: {
              ...state.nodes,
              [nodeId]: {
                ...existingNode,
                ...updates,
                updatedAt: Date.now(),
              } as DomainNode,
            },
          };
        }),


      removeNode: (nodeId) =>
        set((state) => {
          const connectedEdges = Object.values(state.edges).filter(
            (edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId
          );

          const { [nodeId]: removedNode, ...remainingNodes } = state.nodes;

          const newEdges = { ...state.edges };
          connectedEdges.forEach((edge) => {
            delete newEdges[edge.id];
          });

          return {
            nodes: remainingNodes,
            edges: newEdges,
          };
        }),

      /**
       * Gets a single node by ID.
       */
      getNode: (nodeId) => {
        return get().nodes[nodeId];
      },

      /**
       * Gets multiple nodes by their IDs.
       * Filters out any IDs that don't exist.
       */
      getNodes: (nodeIds) => {
        const { nodes } = get();
        return nodeIds
          .map((id) => nodes[id])
          .filter((node): node is DomainNode => node !== undefined);
      },

      // === Edge Actions ===

      /**
       * Adds a new edge to the SSOT.
       * If an edge with the same ID exists, it will be replaced.
       */
      addEdge: (edge) =>
        set((state) => ({
          edges: {
            ...state.edges,
            [edge.id]: edge,
          },
        })),

      /**
       * Updates an existing edge with partial data.
       * Automatically updates the `updatedAt` timestamp.
       */
      updateEdge: (edgeId, updates) =>
        set((state) => {
          const existingEdge = state.edges[edgeId];
          if (!existingEdge) {
            console.warn(`Cannot update edge ${edgeId}: not found`);
            return state;
          }

          return {
            edges: {
              ...state.edges,
              [edgeId]: {
                ...existingEdge,
                ...updates,
                updatedAt: Date.now(),
              } as DomainEdge,
            },
          };
        }),

      /**
       * Removes an edge from the SSOT.
       */
      removeEdge: (edgeId) =>
        set((state) => {
          const { [edgeId]: removed, ...remainingEdges } = state.edges;
          return { edges: remainingEdges };
        }),

      /**
       * Gets a single edge by ID.
       */
      getEdge: (edgeId) => {
        return get().edges[edgeId];
      },

      /**
       * Gets multiple edges by their IDs.
       * Filters out any IDs that don't exist.
       */
      getEdges: (edgeIds) => {
        const { edges } = get();
        return edgeIds
          .map((id) => edges[id])
          .filter((edge): edge is DomainEdge => edge !== undefined);
      },

      // === Bulk Operations ===

      /**
       * Adds multiple nodes at once (more efficient than individual adds).
       */
      addNodes: (nodes) =>
        set((state) => {
          const newNodes = { ...state.nodes };
          nodes.forEach((node) => {
            newNodes[node.id] = node;
          });
          return { nodes: newNodes };
        }),

      /**
       * Adds multiple edges at once (more efficient than individual adds).
       */
      addEdges: (edges) =>
        set((state) => {
          const newEdges = { ...state.edges };
          edges.forEach((edge) => {
            newEdges[edge.id] = edge;
          });
          return { edges: newEdges };
        }),

      /**
       * Removes multiple nodes at once.
       * Automatically performs CASCADE DELETE on all connected edges.
       * This ensures data integrity and prevents orphaned edges.
       */
      removeNodes: (nodeIds) =>
        set((state) => {
          const nodeIdSet = new Set(nodeIds);

          // Find all edges connected to any of the nodes being removed
          const connectedEdges = Object.values(state.edges).filter(
            (edge) => nodeIdSet.has(edge.sourceNodeId) || nodeIdSet.has(edge.targetNodeId)
          );

          // Remove the nodes
          const newNodes = { ...state.nodes };
          nodeIds.forEach((id) => {
            delete newNodes[id];
          });

          // Cascade delete: Remove all connected edges
          const newEdges = { ...state.edges };
          connectedEdges.forEach((edge) => {
            delete newEdges[edge.id];
          });

          return {
            nodes: newNodes,
            edges: newEdges,
          };
        }),

      /**
       * Removes multiple edges at once.
       */
      removeEdges: (edgeIds) =>
        set((state) => {
          const newEdges = { ...state.edges };
          edgeIds.forEach((id) => {
            delete newEdges[id];
          });
          return { edges: newEdges };
        }),

      // === Utility Actions ===

      /**
       * Clears all nodes and edges from the SSOT.
       * USE WITH CAUTION: This will affect all diagrams.
       */
      clearAll: () =>
        set({
          nodes: {},
          edges: {},
        }),

      /**
       * Gets all edges connected to a specific node.
       * Returns edges where the node is either source or target.
       */
      getEdgesForNode: (nodeId) => {
        const { edges } = get();
        return Object.values(edges).filter(
          (edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId
        );
      },

      /**
       * Gets all edge IDs connected to a specific node.
       * Useful for coordinating cascade deletes with WorkspaceStore.
       */
      getEdgeIdsForNode: (nodeId) => {
        const { edges } = get();
        return Object.values(edges)
          .filter((edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId)
          .map((edge) => edge.id);
      },

      /**
       * Gets all edge IDs connected to multiple nodes.
       * Useful for bulk operations and coordinating cascade deletes.
       */
      getEdgeIdsForNodes: (nodeIds) => {
        const { edges } = get();
        const nodeIdSet = new Set(nodeIds);
        return Object.values(edges)
          .filter((edge) => nodeIdSet.has(edge.sourceNodeId) || nodeIdSet.has(edge.targetNodeId))
          .map((edge) => edge.id);
      },
    }),
    {
      name: 'libreuml-project-storage',
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
        if (state) {
          const normalizedNodes = normalizeAllNodeTypes(state.nodes);
          if (normalizedNodes !== state.nodes) {
            state.nodes = normalizedNodes;
          }
        }
      },
    }
  )
);
