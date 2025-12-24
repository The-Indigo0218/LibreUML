import ReactFlow, { Background, Controls, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagramStore } from '../../../store/diagramStore';
import UmlClassNode from './UmlClassNode';

const nodeTypes = { umlClass: UmlClassNode };

export default function DiagramCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } = useDiagramStore();
  const { screenToFlowPosition } = useReactFlow();

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(position);
  };

  return (
    <div className="w-screen h-screen bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={handleContextMenu}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background/>
        <Controls />
      </ReactFlow>
    </div>
  );
}