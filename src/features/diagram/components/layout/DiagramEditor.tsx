import { useState, useEffect } from "react";
import KonvaCanvas from "../../../../canvas/KonvaCanvas";
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
import WikiModal from "../../../../components/Wiki/WikiModal";
import VfsEdgeActionModal from "../modals/VfsEdgeActionModal";
import MethodGeneratorModal from "../modals/MethodGeneratorModal";
import JavaImportPreferenceModal from "../../../../components/shared/JavaImportPreferenceModal";
import { useUiStore } from "../../../../store/uiStore";
import { useAutoSave } from "../../../../hooks/actions/useAutoSave";
import { useVFSAutoSave } from "../../../../hooks/actions/useVFSAutoSave";
import { useAutoRestore } from "../../../../hooks/useAutoRestore";
import { useThemeSystem } from "../../../../hooks/useThemeSystem";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useLayoutStore } from "../../../../store/layout.store";
import { useSettingsStore } from "../../../../store/settingsStore";
import { injectXmiIntoVFS } from "../../../../services/openFileService";
import { JavaImportService } from "../../../../services/javaImport.service";

function EditorLogic() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("structure");
  const [javaImportModal, setJavaImportModal] = useState<{
    isOpen: boolean;
    fileName: string;
    code: string;
    position?: { x: number; y: number };
  }>({
    isOpen: false,
    fileName: '',
    code: '',
  });
  
  const { project } = useVFSStore();
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const { isLeftPanelOpen, isRightPanelOpen, isBottomPanelOpen } = useLayoutStore();
  const { activeModal, editingId, closeModals } = useUiStore();
  const javaImportPreference = useSettingsStore((s) => s.javaImportPreference);
  const setJavaImportPreference = useSettingsStore((s) => s.setJavaImportPreference);

  useAutoSave();
  useVFSAutoSave();
  useAutoRestore();
  useThemeSystem();
  useKeyboardShortcuts(); // CRITICAL FIX: Enable keyboard shortcuts (Ctrl+Z, Ctrl+Y, etc.)

  const handleJavaImport = (code: string, target: 'model' | 'canvas' | 'both', position?: { x: number; y: number }) => {
    const result = JavaImportService.import({ code, target, position });
    if (!result.success) {
      console.error('[DiagramEditor] Java import failed:', result.error);
    }
    setJavaImportModal({ isOpen: false, fileName: '', code: '' });
  };

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };

    const handleDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []);
      
      // Check for Java files first
      const javaFile = files.find((f) => f.name.endsWith('.java'));
      if (javaFile) {
        e.preventDefault();
        if (!useVFSStore.getState().project) return;
        
        const reader = new FileReader();
        reader.onload = (ev) => {
          const code = ev.target?.result as string;
          
          // If user has a saved preference, use it directly
          if (javaImportPreference) {
            handleJavaImport(code, javaImportPreference);
          } else {
            // Show modal to ask user preference
            setJavaImportModal({
              isOpen: true,
              fileName: javaFile.name,
              code,
            });
          }
        };
        reader.readAsText(javaFile);
        return;
      }
      
      // Check for XMI files
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
  }, [javaImportPreference]);

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
        <div
          className={`h-full overflow-hidden transition-all duration-200 ease-in-out shrink-0 min-w-0 ${
            isLeftPanelOpen && activeTab ? "w-64" : "w-0"
          }`}
        >
          <PrimarySideBar activeTab={activeTab} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
          <TabBar />
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {activeTabId ? <KonvaCanvas /> : <SleepScreen />}
            </div>
            <div
              className={`overflow-hidden transition-all duration-200 ease-in-out shrink-0 ${
                isRightPanelOpen ? "w-64" : "w-0"
              }`}
            >
              <RightSidebar />
            </div>
          </div>
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
      <OpenFileModal />
      <SSoTElementEditorModal />
      <SSoTClassEditorModal />
      <GlobalDeleteModal />
      <VfsEdgeActionModal />
      <MethodGeneratorModal
        isOpen={activeModal === 'method-generator'}
        nodeId={activeModal === 'method-generator' ? (editingId ?? null) : null}
        onClose={closeModals}
      />
      <ToastContainer />
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
      <WikiModal
        isOpen={activeModal === 'wiki'}
        onClose={closeModals}
      />
      <JavaImportPreferenceModal
        isOpen={javaImportModal.isOpen}
        fileName={javaImportModal.fileName}
        onImportToModel={() => handleJavaImport(javaImportModal.code, 'model', javaImportModal.position)}
        onImportToCanvas={() => handleJavaImport(javaImportModal.code, 'canvas', javaImportModal.position)}
        onImportToBoth={() => handleJavaImport(javaImportModal.code, 'both', javaImportModal.position)}
        onCancel={() => setJavaImportModal({ isOpen: false, fileName: '', code: '' })}
        onDontShowAgain={(preference) => {
          setJavaImportPreference(preference);
          if (preference) {
            handleJavaImport(javaImportModal.code, preference, javaImportModal.position);
          }
        }}
      />
    </div>
  );
}

export default function DiagramEditor() {
  return <EditorLogic />;
}
