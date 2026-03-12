import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DomainNode } from '../core/domain/models/nodes';
import type { DomainEdge } from '../core/domain/models/edges';

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
      // === Initial State ===
      nodes: {},
      edges: {},

      // === Node Actions ===

      /**
       * Adds a new node to the SSOT.
       * If a node with the same ID exists, it will be replaced.
       */
      addNode: (node) =>
        set((state) => ({
          nodes: {
            ...state.nodes,
            [node.id]: node,
          },
        })),

      /**
       * Updates an existing node with partial data.
       * Automatically updates the `updatedAt` timestamp.
       */
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

      /**
       * Removes a node from the SSOT.
       * WARNING: Does not automatically remove connected edges.
       * Caller is responsible for cleaning up edges.
       */
      removeNode: (nodeId) =>
        set((state) => {
          const { [nodeId]: removed, ...remainingNodes } = state.nodes;
          return { nodes: remainingNodes };
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
       * WARNING: Does not automatically remove connected edges.
       */
      removeNodes: (nodeIds) =>
        set((state) => {
          const newNodes = { ...state.nodes };
          nodeIds.forEach((id) => {
            delete newNodes[id];
          });
          return { nodes: newNodes };
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
    }),
    {
      name: 'libreuml-project-storage',
      version: 1,
    }
  )
);
