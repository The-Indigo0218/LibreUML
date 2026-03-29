import { create } from 'zustand';

interface SelectionStoreState {
  /** IDs of currently selected ReactFlow nodes (ViewNode.id). */
  selectedNodeIds: string[];
  /** IDs of currently selected ReactFlow edges (ViewEdge.id). */
  selectedEdgeIds: string[];

  /** Replace the full node selection. */
  setSelectedNodes: (ids: string[]) => void;
  /** Replace the full edge selection. */
  setSelectedEdges: (ids: string[]) => void;
  /** Replace both node and edge selection at once (avoids double render). */
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  /** Clear all selection. */
  clear: () => void;
}

export const useSelectionStore = create<SelectionStoreState>((set) => ({
  selectedNodeIds: [],
  selectedEdgeIds: [],

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),
  setSelectedEdges: (ids) => set({ selectedEdgeIds: ids }),
  setSelection: (nodeIds, edgeIds) =>
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }),
  clear: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),
}));
