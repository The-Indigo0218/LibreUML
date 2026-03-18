import { useState } from "react";
import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import AppMenubar from "../menubar/AppMenubar";
import ActivityBar, { type ActivityTab } from "./ActivityBar";
import PrimarySideBar from "./PrimarySideBar";
import StatusBar from "./StatusBar";
import TabBar from "./TabBar";
import WelcomeScreen from "../../../workspace/components/WelcomeScreen";
import SleepScreen from "../../../workspace/components/SleepScreen";
import { useAutoSave } from "../../../../hooks/actions/useAutoSave";
import { useAutoRestore } from "../../../../hooks/useAutoRestore";
import { useThemeSystem } from "../../../../hooks/useThemeSystem";
import { useVFSStore } from "../../../../store/vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";

function EditorLogic() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("structure");
  const { project } = useVFSStore();
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);

  useAutoSave();
  useAutoRestore();
  useThemeSystem();

  if (!project) {
    return (
      <div className="h-screen w-screen">
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-gray-50">
      <AppMenubar />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} />
        <PrimarySideBar activeTab={activeTab} />

        <div className="flex-1 flex flex-col relative bg-slate-50 min-w-0">
          <TabBar />
          <div className="flex-1 overflow-hidden">
            {activeTabId ? <DiagramCanvas /> : <SleepScreen />}
          </div>
        </div>
      </div>

      <StatusBar />
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