import { create } from "zustand";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type DefaultEdgeOptions,
} from "reactflow";

import type {
  UmlClassData,
  stereotype,
  UmlRelationType,
  DiagramState as SavedDiagramState,
} from "../types/diagram.types";

export const NODE_WIDTH = 250;
export const NODE_HEIGHT = 200;

const EDGE_BASE_COLOR = "#6B7280";
const ARROW_HEAD_COLOR = "#FFFFFF";

const getEdgeOptions = (type: UmlRelationType): DefaultEdgeOptions => {
  const base = {
    type: "smoothstep",
    pathOptions: { borderRadius: 20 },
    animated: false,
    style: { stroke: EDGE_BASE_COLOR },
  };

  switch (type) {
    case "inheritance":
      return {
        ...base,
        style: { stroke: EDGE_BASE_COLOR, strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 25,
          height: 25,
          color: ARROW_HEAD_COLOR,
        },
        zIndex: 10,
      };
    case "implementation":
      return {
        ...base,
        style: {
          stroke: EDGE_BASE_COLOR,
          strokeWidth: 2,
          strokeDasharray: "6,4",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 25,
          height: 25,
          color: ARROW_HEAD_COLOR,
        },
        zIndex: 9,
      };
    case "dependency":
      return {
        ...base,
        style: {
          stroke: EDGE_BASE_COLOR,
          strokeWidth: 1,
          strokeDasharray: "4,4",
        },
        markerEnd: {
          type: MarkerType.Arrow,
          width: 18,
          height: 18,
          color: EDGE_BASE_COLOR,
        },
        zIndex: 1,
      };
    case "association":
    default:
      return {
        ...base,
        style: { stroke: EDGE_BASE_COLOR, strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.Arrow,
          width: 20,
          height: 20,
          color: EDGE_BASE_COLOR,
        },
        zIndex: 5,
      };
  }
};

export const checkCollision = (
  position: { x: number; y: number },
  nodes: Node[]
) => {
  return nodes.some((node) => {
    const nodeW = node.width || NODE_WIDTH;
    const nodeH = node.height || NODE_HEIGHT;
    return (
      position.x < node.position.x + nodeW &&
      position.x + NODE_WIDTH > node.position.x &&
      position.y < node.position.y + nodeH &&
      position.y + NODE_HEIGHT > node.position.y
    );
  });
};

const initialNodes: Node<UmlClassData>[] = [
  {
    id: "1",
    type: "umlClass",
    position: { x: 250, y: 50 },
    data: {
      label: "Persona",
      attributes: [],
      methods: [],
      stereotype: "class",
    },
  },
  {
    id: "2",
    type: "umlClass",
    position: { x: 250, y: 350 },
    data: {
      label: "Estudiante",
      attributes: [],
      methods: [],
      stereotype: "interface",
    },
  },
];

interface DiagramStoreState {
  diagramId: string;
  diagramName: string;
  nodes: Node<UmlClassData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  activeConnectionMode: UmlRelationType;

  setDiagramName: (name: string) => void;
  updateNodeData: (nodeId: string, newData: Partial<UmlClassData>) => void;
  addNode: (
    position: { x: number; y: number },
    stereotype?: stereotype
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
}

export const useDiagramStore = create<DiagramStoreState>((set, get) => ({
  diagramId: crypto.randomUUID(),
  diagramName: "Untitled Diagram",
  nodes: initialNodes,
  edges: [],
  activeConnectionMode: "association",
  showMiniMap: false,

  setDiagramName: (name) => set({ diagramName: name }),
  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) => {
    const { activeConnectionMode, nodes } = get();
    const sourceNode = nodes.find((n) => n.id === connection.source);
    let edgeOptions;
    let edgeData = {};

    if (sourceNode?.type === "umlNote") {
      edgeOptions = {
        type: "smoothstep",
        style: {
          stroke: EDGE_BASE_COLOR,
          strokeWidth: 1,
          strokeDasharray: "3,3",
        },
        markerEnd: {
          type: MarkerType.Arrow,
          width: 15,
          height: 15,
          color: EDGE_BASE_COLOR,
        },
      };
      edgeData = { type: "note" };
    } else {
      edgeOptions = getEdgeOptions(activeConnectionMode);
      edgeData = { type: activeConnectionMode };
    }

    set({
      edges: addEdge(
        { ...connection, ...edgeOptions, data: edgeData },
        get().edges
      ),
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
    set({ nodes: [...nodes, newNode] });
  },

  updateNodeData: (nodeId, newData) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
      ),
    }),
  deleteNode: (nodeId) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
    }),
  duplicateNode: (nodeId) => {
    const n = get().nodes.find((x) => x.id === nodeId);
    if (n)
      set({
        nodes: [
          ...get().nodes,
          {
            ...n,
            id: crypto.randomUUID(),
            position: { x: n.position.x + 20, y: n.position.y + 20 },
          },
        ],
      });
  },
  setConnectionMode: (mode) => set({ activeConnectionMode: mode }),
  loadDiagram: (data) =>
    set({
      diagramId: data.id || crypto.randomUUID(),
      diagramName: data.name || "Imported",
      nodes: data.nodes,
      edges: data.edges,
    }),
  toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
  clearCanvas: () => {
    if (confirm("Borrar todo?")) set({ nodes: [], edges: [] });
  },

  deleteEdge: (edgeId) => {
    set({ edges: get().edges.filter((e) => e.id !== edgeId) });
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
          : e
      ),
    });
  },

  reverseEdge: (edgeId) => {
    set({
      edges: get().edges.map((e) => {
        if (e.id === edgeId) {
          return {
            ...e,
            source: e.target,
            target: e.source,
            sourceHandle: e.targetHandle,
            targetHandle: e.sourceHandle,
          };
        }
        return e;
      }),
    });
  },
}));
