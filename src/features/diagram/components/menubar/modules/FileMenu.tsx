import { useRef } from "react";
import { 
  FilePlus, 
  FolderOpen, 
  Save, 
  LogOut, 
  XCircle, 
  FileOutput, 
  RotateCcw, 
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useDiagramActions } from "../../../hooks/useDiagramActions";

interface FileMenuProps {
  actions: ReturnType<typeof useDiagramActions>;
}

export function FileMenu({ actions }: FileMenuProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // --- LOGIC: SAVE BUTTONS STATE ---
  const isElectron = !!window.electronAPI?.isElectron();

  // Save: Disabled in Electron if no file path (forces Save As). Enabled in Web (Download).
  const isSaveDisabled = isElectron ? !hasFilePath : false;

  // Save As: Disabled in Web (Browser handles downloads via 'Save').
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