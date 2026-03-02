import { useRef } from "react";
import { 
  FilePlus, 
  FolderOpen, 
  Save, 
  LogOut, 
  XCircle, 
  FileOutput, 
  RotateCcw,
  FileCode2 
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useDiagramActions } from "../../../hooks/useDiagramActions";
import { useDiagramStore } from "../../../../../store/diagramStore";
import { XmiImporterService } from "../../../../../services/xmiImporter.service";

interface FileMenuProps {
  actions: ReturnType<typeof useDiagramActions>;
}

export function FileMenu({ actions }: FileMenuProps) {
  const { t } = useTranslation();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xmiInputRef = useRef<HTMLInputElement>(null);

  const loadDiagram = useDiagramStore((s) => s.loadDiagram);

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
        
        loadDiagram({
          id: crypto.randomUUID(),
          name: fileName,
          nodes: importedData.nodes,
          edges: importedData.edges,
          viewport: { x: 0, y: 0, zoom: 1 } 
        });
        
        if (xmiInputRef.current) xmiInputRef.current.value = '';
      } catch (error) {
        console.error("Error importando XMI:", error);
        alert(t("messages.error.importXmi") || "Error importing XMI file. Ensure it complies with the OMG UML 2.x standard.");
      }
    };
    reader.readAsText(file);
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
        style={{ display: 'none' }}
      />

      <input
        type="file"
        ref={xmiInputRef}
        onChange={handleXmiUpload}
        accept=".xmi,.xml"
        className="hidden"
        style={{ display: 'none' }}
      />

      <MenubarTrigger label={t("menubar.file.title") || "File"}>
        <MenubarItem
          label={t("menubar.file.new") || "New Diagram"}
          icon={<FilePlus className="w-4 h-4" />}
          onClick={handleNew}
        />
        <MenubarItem
          label={t("menubar.file.open") || "Open..."}
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

        <MenubarItem
          label={t("menubar.file.close") || "Close Editor"}
          icon={<XCircle className="w-4 h-4" />}
          onClick={handleCloseFile}
        />
        <MenubarItem
          label={t("menubar.file.exit") || "Exit"}
          icon={<LogOut className="w-4 h-4" />}
          onClick={handleExit}
          danger
        />
      </MenubarTrigger>
    </>
  );
}