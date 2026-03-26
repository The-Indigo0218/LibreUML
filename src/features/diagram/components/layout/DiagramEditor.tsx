import { useState, useEffect } from "react";
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
import { OpenFileModal } from "../modals/OpenFileModal";
import KeyboardShortcutsModal from "../modals/KeyboardShortcutsModal";
import ExportModal from "../modals/ExportModal";
import SingleClassGeneratorModal from "../modals/SingleClassGeneratorModal";
import ProjectGeneratorModal from "../modals/ProjectGeneratorModal";
import ImportCodeModal from "../modals/ImportCodeModal";
import CodeExportConfigModal from "../modals/CodeExportConfigModal";
import { useUiStore } from "../../../../store/uiStore";
import { useAutoSave } from "../../../../hooks/actions/useAutoSave";
import { useAutoRestore } from "../../../../hooks/useAutoRestore";
import { useThemeSystem } from "../../../../hooks/useThemeSystem";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useLayoutStore } from "../../../../store/layout.store";
import { injectXmiIntoVFS } from "../../../../services/openFileService";

function EditorLogic() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("structure");
  const { project } = useVFSStore();
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const { isLeftPanelOpen, isRightPanelOpen, isBottomPanelOpen } = useLayoutStore();
  const { activeModal, closeModals } = useUiStore();

  useAutoSave();
  useAutoRestore();
  useThemeSystem();

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };

    const handleDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []);
      const xmiFile = files.find((f) => /\.(xmi|xmin)$/i.test(f.name));
      if (!xmiFile) return;
      e.preventDefault();
      if (!useVFSStore.getState().project) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const content = ev.target?.result as string;
          const baseName = xmiFile.name.replace(/\.[^/.]+$/, '');
          await injectXmiIntoVFS(content, baseName, 'project');
        } catch (err) {
          console.error('[LibreUML] XMI drop import failed:', err);
        }
      };
      reader.readAsText(xmiFile);
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

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
            isLeftPanelOpen && activeTab ? "w-64" : "w-0"
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
      <OpenFileModal />
      <SSoTElementEditorModal />
      <SSoTClassEditorModal />
      <GlobalDeleteModal />
      <ToastContainer />

      {/* ── Menubar-triggered modals (available regardless of canvas state) ── */}
      <KeyboardShortcutsModal
        isOpen={activeModal === 'keyboard-shortcuts'}
        onClose={closeModals}
      />
      <ExportModal
        isOpen={activeModal === 'export-modal'}
        onClose={closeModals}
      />
      <SingleClassGeneratorModal
        isOpen={activeModal === 'engineering-single'}
        onClose={closeModals}
      />
      <ProjectGeneratorModal
        isOpen={activeModal === 'engineering-project'}
        onClose={closeModals}
      />
      <ImportCodeModal
        isOpen={activeModal === 'import-code'}
        onClose={closeModals}
      />
      <CodeExportConfigModal
        isOpen={activeModal === 'code-export-config'}
        onClose={closeModals}
      />
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
