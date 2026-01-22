import { FilePlus, FolderOpen, Save, LogOut, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useDiagramActions } from "../../../hooks/useDiagramActions";

interface FileMenuProps {
  actions: ReturnType<typeof useDiagramActions>;
}

export function FileMenu({ actions }: FileMenuProps) {
  const { t } = useTranslation();
  const { handleNew, handleSave, handleCloseFile, handleExit } = actions;

  return (
    <MenubarTrigger label={t("header.file") || "File"}>
      <MenubarItem
        label={t("header.new") || "New Diagram"}
        icon={<FilePlus className="w-4 h-4" />}
        onClick={handleNew}
      />
      <MenubarItem
        label={t("header.open") || "Open..."}
        icon={<FolderOpen className="w-4 h-4" />}
        shortcut="Ctrl+O"
        disabled 
      />
      
      <div className="h-px bg-surface-border my-1" />
      
      <MenubarItem
        label={t("header.save") || "Save"}
        icon={<Save className="w-4 h-4" />}
        shortcut="Ctrl+S"
        onClick={handleSave}
      />
      <MenubarItem
        label="Save As..."
        disabled
      />
      
      <div className="h-px bg-surface-border my-1" />
      
      <MenubarItem
        label="Close Editor"
        icon={<XCircle className="w-4 h-4" />}
        onClick={handleCloseFile}
      />
      <MenubarItem
        label="Exit"
        icon={<LogOut className="w-4 h-4" />}
        onClick={handleExit}
        danger
      />
    </MenubarTrigger>
  );
}