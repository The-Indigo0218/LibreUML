import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import Sidebar from "./Sidebar";
import AppMenubar from "../menubar/AppMenubar";

import { useAutoSave } from "../../../../hooks/useAutosave";
import { useAutoRestore } from "../../../../hooks/useAutoRestore";

function DiagramManager() {
  useAutoRestore();
  useAutoSave();
  return null;
}

function EditorLogic() {
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-gray-50">
      <DiagramManager />

      <AppMenubar />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />

        <div className="flex-1 relative bg-slate-50 min-w-0">
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
