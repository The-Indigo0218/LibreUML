import { create } from "zustand";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeChange,
} from "reactflow";

import type { UmlClassData, stereotype } from "../types/diagram.types";

export const NODE_WIDTH = 250; 
export const NODE_HEIGHT = 200; 

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

// --- MOCKS (Initial Data) ---
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
    position: { x: 250, y: 250 },
    data: {
      label: "Estudiante",
      attributes: ["+ codigo: String", "+ promedio: float"],
      methods: ["+ estudiar(): void"],
      stereotype: "interface",
    },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
];

interface DiagramState {
  nodes: Node<UmlClassData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  updateNodeData: (nodeId: string, newData: Partial<UmlClassData>) => void;
  addNode: (
    position: { x: number; y: number },
    stereotype?: stereotype
  ) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  clearCanvas: () => void;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,

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

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addNode: (position, stereotype = "class") => {
    const { nodes } = get();

    if (checkCollision(position, nodes)) {
      console.warn("Collision detected via Store. Operation blocked.");
      return;
    }

    const newNode: Node<UmlClassData> = {
      id: crypto.randomUUID(),
      type: "umlClass",
      position,
      data: {
        label: `New ${stereotype}`,
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
        y: nodeToDuplicate.position.y + 40
    };

    const newNode: Node<UmlClassData> = {
      ...nodeToDuplicate,
      id: crypto.randomUUID(),
      position: newPos,
      data: { ...nodeToDuplicate.data },
    };

    set({ nodes: [...get().nodes, newNode] });
  },

  clearCanvas: () => {
    if (
      window.confirm("¿Estás seguro de que quieres borrar todo el diagrama?")
    ) {
      set({ nodes: [], edges: [] });
    }
  },
}));
