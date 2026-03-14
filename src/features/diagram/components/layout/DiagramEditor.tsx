import { useState } from "react";
import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import AppMenubar from "../menubar/AppMenubar";
import ActivityBar, { type ActivityTab } from "./ActivityBar";
import PrimarySideBar from "./PrimarySideBar";

function EditorLogic() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("tools");

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-gray-50">
      <AppMenubar />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} />
        <PrimarySideBar activeTab={activeTab} />

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