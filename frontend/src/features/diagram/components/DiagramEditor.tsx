import { useState, useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type NodeTypes,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";

import type { UmlClassNode as UmlClassNodeType } from "../../../types/diagram.types";
import UmlClassNode from "./UmlClassNode";

// --- MOCK DATA ---
const initialNodes: UmlClassNodeType[] = [
  {
    id: "1",
    type: "umlClass",
    position: { x: 100, y: 100 },
    data: {
      label: "User",
      attributes: ["+ id: Long", "+ username: String"],
      methods: ["+ login(): boolean", "+ logout(): void"],
      stereotype: "Entity",
    },
  },
  {
    id: "2",
    type: "umlClass",
    position: { x: 450, y: 100 },
    data: {
      label: "Order",
      attributes: ["+ id: Long", "+ total: BigDecimal"],
      methods: ["+ calculate(): void"],
    },
  },
];

const initialEdges: Edge[] = [];
// -----------------

export default function DiagramEditor() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      umlClass: UmlClassNode,
    }),
    []
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  const isValidConnection = useCallback(
  (connection: Connection) => {
    if (connection.source === connection.target) {
      return false;
    }


    const isDuplicate = edges.some(
      (edge) => edge.source === connection.source && edge.target === connection.target
    );

    return !isDuplicate;
  },
  [edges] 
);

  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "#F3F4F6" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes} 
        fitView
      >
        <Background gap={12} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
