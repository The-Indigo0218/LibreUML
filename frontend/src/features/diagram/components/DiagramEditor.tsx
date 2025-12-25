import { ReactFlowProvider } from 'reactflow';
import DiagramCanvas from './DiagramCanvas'; 

export default function DiagramEditor() {
  return (
    <ReactFlowProvider>
      <DiagramCanvas />
    </ReactFlowProvider>
  );
}