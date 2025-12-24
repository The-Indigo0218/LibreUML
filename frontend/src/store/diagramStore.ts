import { create } from 'zustand';
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
} from 'reactflow';

import type { UmlClassData } from '../types/diagram.types';

// --- MOCKS (Initial Data) ---
const initialNodes: Node<UmlClassData>[] = [
  {
    id: '1',
    type: 'umlClass', 
    position: { x: 250, y: 50 },
    data: {
      label: 'Persona',
      attributes: ['+ nombre: String', '+ edad: int'],
      methods: ['+ caminar(): void'],
      stereotype: 'Entity'
    },
  },
  {
    id: '2',
    type: 'umlClass',
    position: { x: 250, y: 250 },
    data: {
      label: 'Estudiante',
      attributes: ['+ codigo: String', '+ promedio: float'],
      methods: ['+ estudiar(): void'],
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true }
];
// ----------------------------------------

interface DiagramState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  updateNodeData: (nodeId: string, newData: Partial<UmlClassData>) => void;
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

  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      }),
    });
  },
}));