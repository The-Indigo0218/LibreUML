import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAutosave } from "../../../../hooks/useAutosave";

function EditorLogic() {
  
  useAutosave();

  return (
      <div className="flex w-screen h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full min-w-0">
          <Header />
          <div className="flex-1 relative bg-slate-50">
            <DiagramCanvas />
          </div>
        </div>
      </div>
  );
}

export default function DiagramEditor() {
  return (
    <ReactFlowProvider>
       <EditorLogic /> 
    </ReactFlowProvider>
  );
}
