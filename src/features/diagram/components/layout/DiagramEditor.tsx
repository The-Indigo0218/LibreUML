import { useState } from "react";
import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import AppMenubar from "../menubar/AppMenubar";
import ActivityBar, { type ActivityTab } from "./ActivityBar";
import PrimarySideBar from "./PrimarySideBar";
import RightSidebar from "./RightSidebar";
import BottomTerminal from "./BottomTerminal";
import StatusBar from "./StatusBar";
import TabBar from "./TabBar";
import WelcomeScreen from "../../../workspace/components/WelcomeScreen";
import SleepScreen from "../../../workspace/components/SleepScreen";
import SSoTElementEditorModal from "../modals/SSoTElementEditorModal";
import SSoTClassEditorModal from "../modals/SSoTClassEditorModal";
import GlobalDeleteModal from "../modals/GlobalDeleteModal";
import ToastContainer from "../../../../components/shared/ToastContainer";
import { useAutoSave } from "../../../../hooks/actions/useAutoSave";
import { useAutoRestore } from "../../../../hooks/useAutoRestore";
import { useThemeSystem } from "../../../../hooks/useThemeSystem";
import { useVFSStore } from "../../../../store/vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useLayoutStore } from "../../../../store/layout.store";

function EditorLogic() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("structure");
  const { project } = useVFSStore();
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const { isLeftPanelOpen, isRightPanelOpen, isBottomPanelOpen } = useLayoutStore();

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

      <div className="flex flex-1 overflow-hidden min-h-0">
        <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* ── Left panel (slides in/out) ─────────────────────────────── */}
        <div
          className={`h-full overflow-hidden transition-all duration-200 ease-in-out shrink-0 min-w-0 ${
            isLeftPanelOpen ? "w-64" : "w-0"
          }`}
        >
          <PrimarySideBar activeTab={activeTab} />
        </div>

        {/* ── Center column: tabs + canvas + bottom terminal ─────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
          <TabBar />

          {/* Canvas row: diagram + right sidebar */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {activeTabId ? <DiagramCanvas /> : <SleepScreen />}
            </div>

            {/* ── Right sidebar (slides in/out) ───────────────────────── */}
            <div
              className={`overflow-hidden transition-all duration-200 ease-in-out shrink-0 ${
                isRightPanelOpen ? "w-64" : "w-0"
              }`}
            >
              <RightSidebar />
            </div>
          </div>

          {/* ── Bottom terminal (slides in/out) ─────────────────────── */}
          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out shrink-0 ${
              isBottomPanelOpen ? "h-72" : "h-0"
            }`}
          >
            <BottomTerminal />
          </div>
        </div>
      </div>

      <StatusBar />

      {/* ── VFS-native modals (portal-rendered, outside layout tree) ──── */}
      <SSoTElementEditorModal />
      <SSoTClassEditorModal />
      <GlobalDeleteModal />
      <ToastContainer />
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
