import { 
  FileCode, 
  Package, 
  Upload, 
  Play 
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useUiStore } from "../../../../../store/uiStore";

export function CodeMenu() {
  const { t } = useTranslation();
  
  // Store actions
  const openSingleGenerator = useUiStore((s) => s.openSingleGenerator); 
  const openProjectGenerator = useUiStore((s) => s.openProjectGenerator); 
  const openImportModal = useUiStore((s) => s.openImportCode);

  return (
   <MenubarTrigger label={t("menubar.code.title")}>
      <MenubarItem
        label={t("menubar.code.generateClass")} 
        icon={<FileCode className="w-4 h-4" />}
        shortcut="Ctrl+G"
        onClick={openSingleGenerator} 
      />

      {/*  Generate Project (Bulk) */}
      <MenubarItem
        label={t("menubar.code.generateProject")} 
        icon={<Package className="w-4 h-4" />}
        onClick={openProjectGenerator}
      />
      <div className="h-px bg-surface-border my-1" />

      {/*  Code -> UML (Reverse) */}
      <MenubarItem
        label={t("menubar.code.importJava")} 
        icon={<Upload className="w-4 h-4" />}
        onClick={openImportModal}
      />
      <div className="h-px bg-surface-border my-1" />

      {/* Future Stuff */}
      <MenubarItem
        label={t("menubar.code.livePreview")} 
        icon={<Play className="w-4 h-4" />}
        disabled={true} 
      />
    </MenubarTrigger>
  );
}