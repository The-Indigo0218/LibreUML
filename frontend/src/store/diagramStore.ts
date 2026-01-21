import { create } from "zustand";
import { temporal } from "zundo";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "reactflow";

import type {
  UmlClassData,
  stereotype,
  UmlRelationType,
  DiagramState as SavedDiagramState,
} from "../features/diagram/types/diagram.types";
import { getEdgeOptions, getNoteEdgeOptions } from "../util/edgeFactory";
import {
  getSmartEdgeHandles,
  checkCollision,
  updateSyncedEdges,
} from "../util/geometry";

interface DiagramStoreState {
  diagramId: string;
  diagramName: string;
  nodes: Node<UmlClassData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  activeConnectionMode: UmlRelationType;
  currentFilePath?: string;
  isDirty: boolean;
  

  setDiagramName: (name: string) => void;
  updateNodeData: (nodeId: string, newData: Partial<UmlClassData>) => void;
  addNode: (
    position: { x: number; y: number },
    stereotype?: stereotype,
  ) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  clearCanvas: () => void;
  setConnectionMode: (mode: UmlRelationType) => void;
  loadDiagram: (data: SavedDiagramState) => void;
  toggleMiniMap: () => void;
  showMiniMap: boolean;
  deleteEdge: (edgeId: string) => void;
  changeEdgeType: (edgeId: string, newType: UmlRelationType) => void;
  reverseEdge: (edgeId: string) => void;
  recalculateNodeConnections: (nodeId: string) => void;
  triggerHistorySnapshot: () => void;
  setFilePath: (path: string | undefined) => void; 
  setDirty: (dirty: boolean) => void;
  resetDiagram: () => void;
}

export const useDiagramStore = create<DiagramStoreState>()(
  temporal(
    (set, get) => ({
      diagramId: crypto.randomUUID(),
      diagramName: "Untitled Diagram",
      nodes: [],
      edges: [],
      activeConnectionMode: "association",
      showMiniMap: false,
      isDirty: false,

      setDirty: (dirty) => set({ isDirty: dirty }),

      setDiagramName: (name) => set({ diagramName: name, isDirty: true }),

      onNodesChange: (changes) =>
        set({ nodes: applyNodeChanges(changes, get().nodes), isDirty: true }),

      onEdgesChange: (changes) =>
        set({ edges: applyEdgeChanges(changes, get().edges), isDirty: true }),

      setFilePath: (path) => set({ currentFilePath: path }),

      onConnect: (connection) => {
        const { activeConnectionMode, nodes, edges } = get();
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);

        if (targetNode?.type === "umlNote") return;

        if (
          connection.targetHandle === "right" ||
          connection.targetHandle === "bottom"
        ) {
          return;
        }

        const isDuplicate = edges.some(
          (e) =>
            e.source === connection.source && e.target === connection.target,
        );
        if (isDuplicate) return;

        if (sourceNode?.type === "umlNote") {
          if (targetNode?.type === "umlNote") return;
        }

        let edgeOptions;
        let edgeData = {};

        if (sourceNode?.type === "umlNote") {
          edgeOptions = getNoteEdgeOptions();
          edgeData = { type: "note" };
        } else {
          edgeOptions = getEdgeOptions(activeConnectionMode);
          edgeData = { type: activeConnectionMode };
        }

        set({
          edges: addEdge(
            { ...connection, ...edgeOptions, data: edgeData },
            get().edges,
          ),
          isDirty: true,
        });
      },

      addNode: (position, stereotype = "class") => {
        const { nodes } = get();
        if (checkCollision(position, nodes)) return;
        const newNode: Node<UmlClassData> = {
          id: crypto.randomUUID(),
          type: stereotype === "note" ? "umlNote" : "umlClass",
          position,
          data: {
            label: stereotype === "note" ? "Nota" : `New ${stereotype}`,
            attributes: [],
            methods: [],
            stereotype: stereotype,
          },
        };
        set({ nodes: [...nodes, newNode], isDirty: true });
      },

      updateNodeData: (nodeId, newData) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n,
          ),
          isDirty: true,
        }),

      deleteNode: (nodeId) =>
        set({
          nodes: get().nodes.filter((n) => n.id !== nodeId),
          edges: get().edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId,
          ),
          isDirty: true,
        }),

      duplicateNode: (nodeId) => {
        const { nodes } = get();
        const n = nodes.find((x) => x.id === nodeId);

        if (n) {
          const newNode = {
            ...n,
            id: crypto.randomUUID(),
            position: { x: n.position.x + 50, y: n.position.y + 50 },
            selected: false,
            dragging: false,
            data: {
              ...n.data,
              label: `${n.data.label} (Copy)`,
            },
          };

          const otherNodes = nodes.map((node) => ({
            ...node,
            selected: false,
          }));

          set({
            nodes: [...otherNodes, newNode],
            isDirty: true,
          });
        }
      },

      setConnectionMode: (mode) => set({ activeConnectionMode: mode, isDirty: true }),

      loadDiagram: (data) => {
        const hydratedEdges = data.edges.map((edge) => {
          const type = edge.data?.type || "association";

          let options;
          if (type === "note") {
            options = getNoteEdgeOptions();
          } else {
            options = getEdgeOptions(type as UmlRelationType);
          }
          return {
            ...edge,
            ...options,
            data: { ...edge.data, type },
          };
        }) as Edge[];

        set({
          diagramId: data.id || crypto.randomUUID(),
          diagramName: data.name || "Imported",
          currentFilePath: undefined,
          nodes: data.nodes,
          edges: hydratedEdges,
          isDirty: false,
        });
      },

      toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),

      deleteEdge: (edgeId) => {
        set({ edges: get().edges.filter((e) => e.id !== edgeId), isDirty: true });
      },

      changeEdgeType: (edgeId, newType) => {
        const newOptions = getEdgeOptions(newType);
        set({
          edges: get().edges.map((e) =>
            e.id === edgeId
              ? {
                  ...e,
                  ...newOptions,
                  style: { ...e.style, ...newOptions.style },
                  data: { ...e.data, type: newType },
                }
              : e,
          ),
          isDirty: true,
        });
      },

      reverseEdge: (edgeId) => {
        const { nodes, edges } = get();
        const edge = edges.find((e) => e.id === edgeId);
        if (!edge) return;

        const newSourceNode = nodes.find((n) => n.id === edge.target);
        const newTargetNode = nodes.find((n) => n.id === edge.source);

        if (!newSourceNode || !newTargetNode) return;

        const { sourceHandle, targetHandle } = getSmartEdgeHandles(
          newSourceNode,
          newTargetNode,
        );

        set({
          edges: edges.map((e) => {
            if (e.id === edgeId) {
              return {
                ...e,
                source: e.target,
                target: e.source,
                sourceHandle,
                targetHandle,
                isDirty: true,
              };
            }
            return e;
          }),
        });
      },

      recalculateNodeConnections: (nodeId: string) => {
        const { nodes, edges } = get();
        const movedNode = nodes.find((n) => n.id === nodeId);
        if (!movedNode) return;
        const newEdges = updateSyncedEdges(movedNode, nodes, edges);
        set({ edges: newEdges, isDirty: true });
      },

      triggerHistorySnapshot: () =>
        set((state) => ({
          nodes: [...state.nodes],
          edges: [...state.edges],
        })),

      clearCanvas: () => {
        set({ nodes: [], edges: [], isDirty: true });
      },
      resetDiagram: () => {
        set({
          diagramId: crypto.randomUUID(),
          diagramName: "Untitled Diagram",
          nodes: [],
          edges: [],
          currentFilePath: undefined, 
          isDirty: false, 
        });
      },
    }),
    {
      limit: 50,
      partialize: (state) => {
        const { nodes, edges } = state;
        const cleanNodes = nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }));

        const cleanEdges = edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: e.type,
          data: e.data,
          animated: e.animated,
        }));

        return { nodes: cleanNodes, edges: cleanEdges };
      },
      equality: (pastState, currentState) => {
        return JSON.stringify(pastState) === JSON.stringify(currentState);
      },
    },
  ),
);
