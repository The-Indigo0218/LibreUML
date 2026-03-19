import { useRef, useState } from "react";
import {
  FilePlus,
  FolderOpen,
  Save,
  LogOut,
  XCircle,
  FileOutput,
  RotateCcw,
  FileCode2,
  Download,
  Upload,
  FolderX,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useDiagramActions } from "../../../hooks/useDiagramActions";
import { useWorkspaceStore } from "../../../../../store/workspace.store";
import { useProjectStore } from "../../../../../store/project.store";
import { XmiImporterService } from "../../../../../services/xmiImporter.service";
import {
  downloadProject,
  importProject,
  ProjectImportError,
} from "../../../../../services/projectIO.service";
import { useVFSStore } from "../../../../../store/vfs.store";
import CloseProjectModal, {
  isCloseProjectWarningSuppressed,
} from "../../modals/CloseProjectModal";

interface FileMenuProps {
  actions: ReturnType<typeof useDiagramActions>;
  onOpenProjectProperties?: () => void;
}

export function FileMenu({ actions, onOpenProjectProperties }: FileMenuProps) {
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xmiInputRef = useRef<HTMLInputElement>(null);
  const lumlProjectInputRef = useRef<HTMLInputElement>(null);

  const activeProject = useVFSStore((s) => s.project);
  const closeProject = useVFSStore((s) => s.closeProject);
  const closeAllFiles = useWorkspaceStore((s) => s.closeAllFiles);
  const [isCloseProjectModalOpen, setIsCloseProjectModalOpen] = useState(false);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const addNodeToFile = useWorkspaceStore((s) => s.addNodeToFile);
  const addEdgeToFile = useWorkspaceStore((s) => s.addEdgeToFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);

  const addNode = useProjectStore((s) => s.addNode);
  const addEdge = useProjectStore((s) => s.addEdge);

  const { 
    handleNew, 
    handleOpen, 
    handleWebImport,
    handleSave, 
    handleSaveAs, 
    handleCloseFile, 
    handleExit, 
    hasFilePath,
    handleDiscardChangesAction,
    isDirty
  } = actions;

  const onOpenClick = () => {
    handleOpen(() => {
      fileInputRef.current?.click();
    });
  };

  const handleXmiUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.replace(/\.[^/.]+$/, "");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlContent = e.target?.result as string;
        
        const importedData = XmiImporterService.import(xmlContent);
        
        if (!activeFileId) {
          alert("Please open or create a diagram file first.");
          return;
        }

        const file = getFile(activeFileId);
        if (!file) return;

        const newPositionMap: Record<string, { x: number; y: number }> = {
          ...(file.metadata as any)?.positionMap || {}
        };

        importedData.nodes.forEach(node => {
          const stereotype = node.data.stereotype || "class";
          
          const domainType = stereotype.toUpperCase() === 'ABSTRACT' 
            ? 'ABSTRACT_CLASS' 
            : stereotype.toUpperCase();
          
          const domainNode = {
            id: node.id,
            type: domainType,
            name: node.data.label,
            package: node.data.package || "default",
            attributes: node.data.attributes || [],
            methods: node.data.methods || [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as any;
          
          addNode(domainNode);
          addNodeToFile(activeFileId, node.id);
          
          if ('position' in node && node.position) {
            newPositionMap[node.id] = node.position;
          }
        });

        // Process Edges
        importedData.edges.forEach(edge => {
          const edgeType = edge.type || edge.data?.type || "association";
          
          const domainEdge = {
            id: edge.id,
            sourceNodeId: edge.source,
            targetNodeId: edge.target,
            type: edgeType.toUpperCase(),
            sourceMultiplicity: edge.data?.sourceMultiplicity,
            targetMultiplicity: edge.data?.targetMultiplicity,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as any;

          addEdge(domainEdge);
          addEdgeToFile(activeFileId, edge.id);
        });

        updateFile(activeFileId, {
          name: fileName,
          metadata: {
            ...file.metadata,
            positionMap: newPositionMap
          } as any
        });
        
        if (xmiInputRef.current) xmiInputRef.current.value = '';
      } catch (error) {
        console.error("Error importando XMI:", error);
        alert(t("messages.error.importXmi") || "Error importing XMI file. Ensure it complies with the OMG UML 2.x standard.");
      }
    };
    reader.readAsText(file);
  };

  // ── VFS project I/O ─────────────────────────────────────────────────────────

  const handleSaveProject = async () => {
    try {
      await downloadProject();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export project.');
    }
  };

  const handleOpenProjectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (activeProject) {
      const confirmed = window.confirm(
        `Opening a new project will overwrite your current workspace.\n\n` +
        `Any unsaved changes will be lost.\n\nDo you want to continue?`
      );
      if (!confirmed) {
        event.target.value = '';
        return;
      }
    }

    try {
      const project = await importProject(file);
      alert(`Project "${project.projectName}" loaded successfully.`);
    } catch (err) {
      if (err instanceof ProjectImportError) {
        alert(`Import failed:\n\n${err.message}`);
      } else {
        alert('Import failed: an unexpected error occurred. Check the console for details.');
        console.error('[LibreUML] Project import error:', err);
      }
    }

    // Reset so the same file can be re-opened immediately
    event.target.value = '';
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
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleWebImport}
        accept=".json,.luml"
        className="hidden"
        aria-label="Open file"
        style={{ display: 'none' }}
      />

      <input
        type="file"
        ref={xmiInputRef}
        onChange={handleXmiUpload}
        accept=".xmi,.xml"
        className="hidden"
        aria-label="Import XMI file"
        style={{ display: 'none' }}
      />

      {/* Hidden input for VFS project import */}
      <input
        type="file"
        ref={lumlProjectInputRef}
        onChange={handleOpenProjectFile}
        accept=".luml"
        className="hidden"
        aria-label="Open LibreUML project"
        style={{ display: 'none' }}
      />

      <MenubarTrigger label={t("menubar.file.title") || "File"}>
        <MenubarItem
          label={t("menubar.file.new") || "New Diagram"}
          icon={<FilePlus className="w-4 h-4" />}
          onClick={handleNew}
        />
        <MenubarItem
          label={t("common.open_file") || "Open file"}
          icon={<FolderOpen className="w-4 h-4" />}
          shortcut="Ctrl+O"
          onClick={onOpenClick}
        />

        <MenubarItem
          label={t("menubar.file.importXmi") || "Import XMI..."}
          icon={<FileCode2 className="w-4 h-4 text-blue-400" />}
          onClick={() => xmiInputRef.current?.click()}
        />

        <div className="h-px bg-surface-border my-1" />

        {/* ── VFS Project I/O ─────────────────────────────────────────── */}
        <MenubarItem
          label="Save Project (.luml)"
          icon={<Download className="w-4 h-4 text-emerald-400" />}
          shortcut="Ctrl+Shift+E"
          onClick={handleSaveProject}
          disabled={!activeProject}
        />
        <MenubarItem
          label="Open Project (.luml)"
          icon={<Upload className="w-4 h-4 text-emerald-400" />}
          onClick={() => lumlProjectInputRef.current?.click()}
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
    </>
  );
}