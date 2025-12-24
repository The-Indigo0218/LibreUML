import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagramStore } from '../../../store/diagramStore';
import UmlClassNode from './UmlClassNode';

const nodeTypes = { umlClass: UmlClassNode };

export default function DiagramEditor() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useDiagramStore();

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#F3F4F6' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}