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
  type NodeChange,
  type Connection,
  type DefaultEdgeOptions,
} from "reactflow";

import type {
  UmlClassData,
  stereotype,
  UmlRelationType,
  DiagramState as SavedDiagramState 
} from "../types/diagram.types";

export const NODE_WIDTH = 250;
export const NODE_HEIGHT = 200;

const EDGE_BASE_COLOR = "#6B7280"; 
const ARROW_HEAD_COLOR = "#FFFFFF"; 

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
      attributes: ["+ nombre: String", "+ edad: int"],
      methods: ["+ caminar(): void"],
      stereotype: "class",
    },
  },
  {
    id: "2",
    type: "umlClass",
    position: { x: 250, y: 350 },
    data: {
      label: "Estudiante",
      attributes: ["+ codigo: String", "+ promedio: float"],
      methods: ["+ estudiar(): void"],
      stereotype: "interface",
    },
  },
];

const initialEdges: Edge[] = [];

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
  addNode: (position: { x: number; y: number }, stereotype?: stereotype) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  clearCanvas: () => void;
  setConnectionMode: (mode: UmlRelationType) => void;
  loadDiagram: (data: SavedDiagramState) => void; 
  showMiniMap: boolean;
  toggleMiniMap: () => void;
}

export const useDiagramStore = create<DiagramStoreState>((set, get) => ({
  diagramId: crypto.randomUUID(),
  diagramName: "Untitled Diagram",
  
  nodes: initialNodes,
  edges: initialEdges,
  activeConnectionMode: "association",
  showMiniMap: false,

  setDiagramName: (name) => set({ diagramName: name }),

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    const { activeConnectionMode, nodes } = get();
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const isSourceNote = sourceNode?.type === "umlNote";

    let edgeOptions: DefaultEdgeOptions = {
      type: "smoothstep",
      style: { stroke: EDGE_BASE_COLOR },
      animated: false,
    };

    if (isSourceNote) {
      edgeOptions = {
        type: "smoothstep",
        style: { 
          stroke: EDGE_BASE_COLOR, 
          strokeWidth: 1, 
          strokeDasharray: "3,3" 
        },
        markerEnd: { type: MarkerType.Arrow, width: 15, height: 15, color: EDGE_BASE_COLOR },
      };
    } else {
      switch (activeConnectionMode) {
        case "inheritance":
          edgeOptions = {
            ...edgeOptions,
            style: { stroke: EDGE_BASE_COLOR, strokeWidth: 2.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 25,
              height: 25,
              color: ARROW_HEAD_COLOR,
            },
            zIndex: 10,
          };
          break;

        case "implementation":
          edgeOptions = {
            ...edgeOptions,
            style: { 
              stroke: EDGE_BASE_COLOR, 
              strokeWidth: 2, 
              strokeDasharray: "6,4" 
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 25, 
              height: 25,
              color: ARROW_HEAD_COLOR,
            },
            zIndex: 9,
          };
          break;

        case "dependency":
          edgeOptions = {
            ...edgeOptions,
            style: { 
              stroke: EDGE_BASE_COLOR, 
              strokeWidth: 1, 
              strokeDasharray: "4,4" 
            },
            markerEnd: { 
              type: MarkerType.Arrow,
              width: 18,
              height: 18,
              color: EDGE_BASE_COLOR 
            },
            zIndex: 1,
          };
          break;

        case "association":
        default:
          edgeOptions = {
            ...edgeOptions,
            style: { stroke: EDGE_BASE_COLOR, strokeWidth: 1.5 },
            markerEnd: { 
              type: MarkerType.Arrow,
              width: 20,
              height: 20,
              color: EDGE_BASE_COLOR 
            },
            zIndex: 5,
          };
          break;
      }
    }
    set({
      edges: addEdge({ ...connection, ...edgeOptions }, get().edges),
    });
  },

  addNode: (position, stereotype = "class") => {
    const { nodes } = get();
    if (checkCollision(position, nodes)) {
      console.warn("Collision detected via Store.");
      return;
    }
    const isNote = stereotype === "note";
    const newNode: Node<UmlClassData> = {
      id: crypto.randomUUID(),
      type: isNote ? "umlNote" : "umlClass",
      position,
      data: {
        label: isNote ? "Título de Nota" : `New ${stereotype}`,
        content: isNote ? "Escribe aquí tu descripción..." : undefined,
        attributes: [],
        methods: [],
        stereotype: stereotype,
      },
    };
    set({ nodes: [...nodes, newNode] });
  },

  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      ),
    });
  },

  deleteNode: (nodeId: string) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
    });
  },

  duplicateNode: (nodeId: string) => {
    const nodeToDuplicate = get().nodes.find((n) => n.id === nodeId);
    if (!nodeToDuplicate) return;
    const newPos = {
      x: nodeToDuplicate.position.x + 40,
      y: nodeToDuplicate.position.y + 40,
    };
    const newNode: Node<UmlClassData> = {
      ...nodeToDuplicate,
      id: crypto.randomUUID(),
      position: newPos,
      data: { ...nodeToDuplicate.data },
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  setConnectionMode: (mode) => set({ activeConnectionMode: mode }),

  loadDiagram: (data) => {
    if (!data.nodes || !data.edges) {
      alert("El archivo no parece ser un diagrama válido de LibreUML.");
      return;
    }
    set({
      diagramId: data.id || crypto.randomUUID(), 
      diagramName: data.name || "Imported Diagram",
      nodes: data.nodes,
      edges: data.edges,
    });
  },

  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),

  clearCanvas: () => {
    if (window.confirm("¿Estás seguro de que quieres borrar todo el diagrama?")) {
      set({ 
        nodes: [], 
        edges: [],
        diagramName: "Untitled Diagram",
        diagramId: crypto.randomUUID()
      });
    }
  },
}));