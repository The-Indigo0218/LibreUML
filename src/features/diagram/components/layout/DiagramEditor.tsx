import { useState } from "react";
import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import AppMenubar from "../menubar/AppMenubar";
import ActivityBar, { type ActivityTab } from "./ActivityBar";
import PrimarySideBar from "./PrimarySideBar";
import WelcomeScreen from "../../../workspace/components/WelcomeScreen";
import { useAutoSave } from "../../../../hooks/actions/useAutoSave";
import { useAutoRestore } from "../../../../hooks/useAutoRestore";
import { useWorkspaceStore } from "../../../../store/workspace.store";

function EditorLogic() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("tools");

  // Initialize auto-save and auto-restore
  useAutoSave();
  useAutoRestore();

  // Check if workspace is empty
  const activeFileId = useWorkspaceStore((state) => state.activeFileId);
  const files = useWorkspaceStore((state) => state.files);
  const isWorkspaceEmpty = !activeFileId || files.length === 0;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-gray-50">
      <AppMenubar />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isWorkspaceEmpty && <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} />}
        {!isWorkspaceEmpty && <PrimarySideBar activeTab={activeTab} />}

        <div className="flex-1 relative bg-slate-50 min-w-0">
          {isWorkspaceEmpty ? <WelcomeScreen /> : <DiagramCanvas />}
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