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
  addNode: (position: { x: number; y: number }) => void;
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
  
  addNode: (position) => {
    const { nodes } = get();
  
  const W = 260; 
  const H = 200; 

  const hasCollision = nodes.some((node) => {
    return (
      position.x < node.position.x + W &&
      position.x + W > node.position.x &&
      position.y < node.position.y + H &&
      position.y + H > node.position.y
    );
  });

  if (hasCollision) return; 

    const newNode: Node<UmlClassData> = {
      id: crypto.randomUUID(),
      type: 'umlClass',
      position,
      data: {
        label: 'NewClass', 
        attributes: [],
        methods: [],
      },
    };

    set({ nodes: [...nodes, newNode] });
  },

  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) => 
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      ),
    });
  },
}));
