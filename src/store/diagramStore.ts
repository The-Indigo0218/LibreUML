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
  UmlEdgeData,
} from "../features/diagram/types/diagram.types";

type ToastType = {
  message: string;
  type: "success" | "error";
};

import { getEdgeOptions, getNoteEdgeOptions } from "../util/edgeFactory";
import {
  getSmartEdgeHandles,
  checkCollision,
  updateSyncedEdges,
} from "../util/geometry";
import { validateConnection } from "../util/connectionValidator";

interface DiagramStoreState {
  // --- State Properties ---
  diagramId: string;
  diagramName: string;
  nodes: Node<UmlClassData>[];
  edges: Edge[];
  activeConnectionMode: UmlRelationType;
  currentFilePath?: string;
  isDirty: boolean;
  showMiniMap: boolean;
  showGrid?: boolean;
  snapToGrid?: boolean;
  showAllEdges?: boolean;
  activeToast: ToastType | null;

  // --- React Flow Handlers ---
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // --- Canvas Actions ---
  setDiagramName: (name: string) => void;
  setFilePath: (path: string | undefined) => void;
  setDirty: (dirty: boolean) => void;
  toggleMiniMap: () => void;
  clearCanvas: () => void;
  resetDiagram: () => void;
  setConnectionMode: (mode: UmlRelationType) => void;
  loadDiagram: (data: SavedDiagramState, preservePath?: boolean) => void;
  triggerHistorySnapshot: () => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  toggleShowAllEdges: () => void;
  dismissToast: () => void;

  // --- Import Actions ---
  setNodes: (nodes: Node<UmlClassData>[]) => void; 
  setEdges: (edges: Edge[]) => void;               

  // --- Node Actions ---
  addNode: (
    position: { x: number; y: number },
    stereotype?: stereotype,
  ) => void;
  updateNodeData: (nodeId: string, newData: Partial<UmlClassData>) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  recalculateNodeConnections: (nodeId: string) => void;

  // --- Edge Actions ---
  deleteEdge: (edgeId: string) => void;
  changeEdgeType: (edgeId: string, type: UmlRelationType) => void;
  reverseEdge: (edgeId: string) => void;
  updateEdgeData: (edgeId: string, data: Partial<UmlEdgeData>) => void;
}

export const useDiagramStore = create<DiagramStoreState>()(
  temporal(
    (set, get) => ({
      // --- Initial State ---
      diagramId: crypto.randomUUID(),
      diagramName: "Untitled Diagram",
      nodes: [],
      edges: [],
      activeConnectionMode: "association",
      showMiniMap: false,
      showGrid: true,
      snapToGrid: true,
      showAllEdges: false,
      isDirty: false,
      activeToast: null,

      // --- State Setters ---
      setDirty: (dirty) => set({ isDirty: dirty }),
      setDiagramName: (name) => set({ diagramName: name, isDirty: true }),
      setFilePath: (path) => set({ currentFilePath: path }),
      toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
      toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
      toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
      toggleShowAllEdges: () => set((s) => ({ showAllEdges: !s.showAllEdges })),
      dismissToast: () => set({ activeToast: null }),

      setNodes: (nodes) => set({ nodes, isDirty: true }), 
      setEdges: (edges) => set({ edges, isDirty: true }), 

      // --- React Flow Callbacks ---
      onNodesChange: (changes) =>
        set({ nodes: applyNodeChanges(changes, get().nodes), isDirty: true }),

      onEdgesChange: (changes) =>
        set({ edges: applyEdgeChanges(changes, get().edges), isDirty: true }),

      onConnect: (connection) => {
        const { activeConnectionMode, nodes, edges } = get();
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);

        if (!sourceNode || !targetNode) return;
        
        if (targetNode.type === "umlNote") return; 
        
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

        if (sourceNode.type === "umlNote" && targetNode.type === "umlNote")
          return;

        if (sourceNode.type !== "umlNote") {
           const isValid = validateConnection(
             sourceNode.data.stereotype,
             targetNode.data.stereotype,
             activeConnectionMode
           );

           if (!isValid) {
            set({
               activeToast: {
                 message: `🚫 Rule Violation: Cannot connect [${sourceNode.data.stereotype}] to [${targetNode.data.stereotype}] via ${activeConnectionMode}.`,
                 type: "error"
               }
             });
             return; 
           }
        }
        let edgeOptions;
        let edgeData: UmlEdgeData;

        if (sourceNode.type === "umlNote") {
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

      // --- Node Operations ---
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

      recalculateNodeConnections: (nodeId: string) => {
        const { nodes, edges } = get();
        const movedNode = nodes.find((n) => n.id === nodeId);
        if (!movedNode) return;

        const newEdges = updateSyncedEdges(movedNode, nodes, edges);
        set({ edges: newEdges, isDirty: true });
      },

      // --- Edge Operations ---
      setConnectionMode: (mode) =>
        set({ activeConnectionMode: mode, isDirty: true }),

      deleteEdge: (edgeId) => {
        set({
          edges: get().edges.filter((e) => e.id !== edgeId),
          isDirty: true,
        });
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
                  data: { ...e.data, type: newType } as UmlEdgeData,
                }
              : e,
          ),
          isDirty: true,
        });
      },

      updateEdgeData: (edgeId, newData) => {
        set({
          edges: get().edges.map((edge) => {
            if (edge.id === edgeId) {
              return {
                ...edge,
                data: { ...edge.data, ...newData } as UmlEdgeData,
              };
            }
            return edge;
          }),
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

      // --- System & History Actions ---
      loadDiagram: (data, preservePath = false) => {
        const hydratedEdges = data.edges.map((edge) => {
          const edgeData = edge.data as UmlEdgeData;
          const type = edgeData?.type || "association";

          let options;
          if (type === "note") {
            options = getNoteEdgeOptions();
          } else {
            options = getEdgeOptions(type as UmlRelationType);
          }

          return {
            ...edge,
            ...options,
            data: { ...edgeData, type },
          };
        }) as Edge[];

        set((state) => ({
          diagramId: data.id || crypto.randomUUID(),
          diagramName: data.name || "Imported",
          currentFilePath: preservePath ? state.currentFilePath : undefined,

          activeConnectionMode: data.activeConnectionMode || "association",

          nodes: data.nodes,
          edges: hydratedEdges,
          isDirty: false,
        }));
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

    // --- Zundo Configuration (History) ---
    {
      limit: 50,
      partialize: (state) => {
        const { nodes, edges } = state;

        const cleanNodes = nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
          width: n.width,
          height: n.height,
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