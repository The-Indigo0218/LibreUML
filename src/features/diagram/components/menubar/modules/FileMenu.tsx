import { useState } from "react";
import {
  FilePlus,
  FolderOpen,
  Save,
  LogOut,
  XCircle,
  FileOutput,
  RotateCcw,
  Download,
  FileDown,
  FolderX,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useDiagramActions } from "../../../hooks/useDiagramActions";
import { useWorkspaceStore } from "../../../../../store/workspace.store";
import {
  downloadProject,
  exportDiagram,
} from "../../../../../services/projectIO.service";
import { useVFSStore } from "../../../../../store/project-vfs.store";
import { useUiStore } from "../../../../../store/uiStore";
import type { VFSFile } from "../../../../../core/domain/vfs/vfs.types";
import CloseProjectModal, {
  isCloseProjectWarningSuppressed,
} from "../../modals/CloseProjectModal";
import SaveProjectWarningModal from "../../modals/SaveProjectWarningModal";

interface FileMenuProps {
  actions: ReturnType<typeof useDiagramActions>;
  onOpenProjectProperties?: () => void;
}

export function FileMenu({ actions, onOpenProjectProperties }: FileMenuProps) {
  const { t } = useTranslation();

  const activeProject = useVFSStore((s) => s.project);
  const closeProject = useVFSStore((s) => s.closeProject);
  const closeAllFiles = useWorkspaceStore((s) => s.closeAllFiles);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const openOpenFileModal = useUiStore((s) => s.openOpenFileModal);
  const [isCloseProjectModalOpen, setIsCloseProjectModalOpen] = useState(false);
  const [isSaveProjectWarningOpen, setIsSaveProjectWarningOpen] = useState(false);

  const {
    handleNew,
    handleSave,
    handleSaveAs,
    handleCloseFile,
    handleExit,
    hasFilePath,
    handleDiscardChangesAction,
    isDirty,
  } = actions;

  // ── Determine export capability ───────────────────────────────────────────
  const activeNode =
    activeTabId && activeProject ? activeProject.nodes[activeTabId] : null;
  const canExportDiagram =
    !!activeProject &&
    !!activeNode &&
    activeNode.type === 'FILE' &&
    (activeNode as VFSFile).extension !== '.model';

  // ── VFS project export ────────────────────────────────────────────────────

  const standaloneFileNames: string[] = activeProject
    ? Object.values(activeProject.nodes)
        .filter((n) => n.type === "FILE" && (n as VFSFile).standalone === true)
        .map((n) => n.name)
    : [];

  const executeProjectSave = async () => {
    try {
      await downloadProject();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to export project.");
    }
  };

  const handleSaveProject = () => {
    if (standaloneFileNames.length > 0) {
      setIsSaveProjectWarningOpen(true);
    } else {
      executeProjectSave();
    }
  };

  const handleExportDiagram = async () => {
    if (!activeTabId) return;
    try {
      await exportDiagram(activeTabId);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to export diagram.",
      );
    }
  };

  const handleCloseProject = () => {
    if (isCloseProjectWarningSuppressed()) {
      closeProject();
      closeAllFiles();
    } else {
      setIsCloseProjectModalOpen(true);
    }
  };

  const isElectron = !!window.electronAPI?.isElectron();
  const isSaveDisabled = isElectron ? !hasFilePath : false;
  const isSaveAsDisabled = !isElectron;

  return (
    <>
      <MenubarTrigger label={t("menubar.file.title") || "File"}>
        <MenubarItem
          label={t("menubar.file.new") || "New Diagram"}
          icon={<FilePlus className="w-4 h-4" />}
          onClick={handleNew}
        />
        <MenubarItem
          label="Open File..."
          icon={<FolderOpen className="w-4 h-4" />}
          shortcut="Ctrl+O"
          onClick={openOpenFileModal}
        />
        <div className="h-px bg-surface-border my-1" />
        <MenubarItem
          label="Save Project (.luml.zip)"
          icon={<Download className="w-4 h-4 text-emerald-400" />}
          shortcut="Ctrl+Shift+E"
          onClick={handleSaveProject}
          disabled={!activeProject}
        />

        <MenubarItem
          label="Export Diagram (.luml)"
          icon={<FileDown className="w-4 h-4 text-blue-400" />}
          onClick={handleExportDiagram}
          disabled={!canExportDiagram}
        />

        {activeProject && onOpenProjectProperties && (
          <MenubarItem
            label="Project Properties..."
            icon={<SlidersHorizontal className="w-4 h-4 text-blue-400" />}
            onClick={onOpenProjectProperties}
          />
        )}

        <div className="h-px bg-surface-border my-1" />

        <MenubarItem
          label={t("menubar.file.save") || "Save"}
          icon={<Save className="w-4 h-4" />}
          shortcut="Ctrl+S"
          onClick={handleSave}
          disabled={isSaveDisabled}
        />
        <MenubarItem
          label={t("menubar.file.saveAs") || "Save As..."}
          icon={<FileOutput className="w-4 h-4" />}
          shortcut="Ctrl+Shift+S"
          onClick={handleSaveAs}
          disabled={isSaveAsDisabled}
        />

        <MenubarItem
          label={t("menubar.file.discard") || "Discard Changes"}
          icon={<RotateCcw className="w-4 h-4" />}
          onClick={handleDiscardChangesAction}
          disabled={!hasFilePath || !isDirty}
        />

        <div className="h-px bg-surface-border my-1" />

        {activeProject ? (
          <MenubarItem
            label="Close Project"
            icon={<FolderX className="w-4 h-4" />}
            onClick={handleCloseProject}
          />
        ) : (
          <MenubarItem
            label={t("menubar.file.close") || "Close Editor"}
            icon={<XCircle className="w-4 h-4" />}
            onClick={handleCloseFile}
          />
        )}
        <MenubarItem
          label={t("menubar.file.exit") || "Exit"}
          icon={<LogOut className="w-4 h-4" />}
          onClick={handleExit}
          danger
        />
      </MenubarTrigger>

      <CloseProjectModal
        isOpen={isCloseProjectModalOpen}
        onClose={() => setIsCloseProjectModalOpen(false)}
        onConfirm={() => {
          closeProject();
          closeAllFiles();
        }}
      />

      <SaveProjectWarningModal
        isOpen={isSaveProjectWarningOpen}
        standaloneFileNames={standaloneFileNames}
        onClose={() => setIsSaveProjectWarningOpen(false)}
        onConfirm={executeProjectSave}
      />
    </>
  );
}
