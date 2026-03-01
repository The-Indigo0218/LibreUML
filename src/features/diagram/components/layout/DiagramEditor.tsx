import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import Sidebar from "./Sidebar";
import AppMenubar from "../menubar/AppMenubar";
import Toast from "../../../../components/shared/Toast";
import { useDiagramStore } from "../../../../store/diagramStore";

import { useAutoSave } from "../../../../hooks/useAutosave";
import { useAutoRestore } from "../../../../hooks/useAutoRestore";

function DiagramManager() {
  useAutoRestore();
  useAutoSave();
  return null;
}

function EditorLogic() {
  const activeToast = useDiagramStore((s) => s.activeToast);
  const dismissToast = useDiagramStore((s) => s.dismissToast);
  const isHydrated = useDiagramStore((s) => s.isHydrated);

  if (!isHydrated) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-gray-900 flex-col gap-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium tracking-wide">Inicializando LibreUML...</p>
        <DiagramManager /> 
      </div>
    );
  }

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

      {activeToast && (
        <Toast 
          message={activeToast.message}
          type={activeToast.type}
          onClose={dismissToast} 
          duration={3000}
        />
      )}
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