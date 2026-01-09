import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import Sidebar from "./Sidebar";

export default function DiagramEditor() {
  return (
    <ReactFlowProvider>
      <div className="flex w-screen h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 h-full relative">
          <DiagramCanvas />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
