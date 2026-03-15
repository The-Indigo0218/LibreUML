import { useState } from "react";
import { ReactFlowProvider } from "reactflow";
import DiagramCanvas from "./DiagramCanvas";
import AppMenubar from "../menubar/AppMenubar";
import ActivityBar, { type ActivityTab } from "./ActivityBar";
import PrimarySideBar from "./PrimarySideBar";
import WelcomeScreen from "../../../workspace/components/WelcomeScreen";
import NotAProjectModal from "../../../../components/shared/NotAProjectModal";
import FullScreenLoader from "../../../../components/shared/FullScreenLoader";
import { useAutoSave } from "../../../../hooks/actions/useAutoSave";
import { useAutoRestore } from "../../../../hooks/useAutoRestore";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useUiStore } from "../../../../store/uiStore";
import { useFileLifecycle } from "../../hooks/actions/useFileLifecycle";

function EditorLogic() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("tools");

  // Initialize auto-save and auto-restore
  useAutoSave();
  useAutoRestore();

  // Check if workspace is empty
  const activeFileId = useWorkspaceStore((state) => state.activeFileId);
  const files = useWorkspaceStore((state) => state.files);
  const isWorkspaceEmpty = !activeFileId || files.length === 0;

  // Global UI state
  const { activeModal, pendingFileData, isFileLoading, closeModals } = useUiStore();
  const { processFileFromModal } = useFileLifecycle();

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

      {/* PHASE 8.5: Global Modals - Rendered outside conditional to work from Welcome Screen */}
      <NotAProjectModal
        isOpen={activeModal === 'not-a-project'}
        fileName={pendingFileData?.fileName || ''}
        onCreateProject={() => {
          if (pendingFileData) {
            processFileFromModal(
              pendingFileData.fileName,
              pendingFileData.content,
              pendingFileData.fileType
            );
          }
          closeModals();
        }}
        onCancel={closeModals}
      />

      {/* PHASE 8.5: Global Loading Spinner */}
      <FullScreenLoader isLoading={isFileLoading} />
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