import { 
  FileCode, 
  Package, 
  Upload, 
  Play 
} from "lucide-react";
//import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useUiStore } from "../../../../../store/uiStore";

export function CodeMenu() {
  //const { t } = useTranslation();
  
  // Store actions
  const openSingleGenerator = useUiStore((s) => s.openSingleGenerator); 
  const openProjectGenerator = useUiStore((s) => s.openProjectGenerator); 
  const openReverseEngineering = useUiStore((s) => s.openReverseEngineering);

  return (
    <MenubarTrigger label="Code">
      
      {/* UML -> Code (Single Class) */}
      <MenubarItem
        label="Generate Class Code..."
        icon={<FileCode className="w-4 h-4" />}
        shortcut="Ctrl+G"
        onClick={openSingleGenerator}
      />

      {/*  Generate Project (Bulk) */}
      <MenubarItem
        label="Generate Project (.zip)..."
        icon={<Package className="w-4 h-4" />}
        onClick={openProjectGenerator}
      />

      <div className="h-px bg-surface-border my-1" />

      {/*  Code -> UML (Reverse) */}
      <MenubarItem
        label="Import Java Code..."
        icon={<Upload className="w-4 h-4" />}
        onClick={openReverseEngineering}
      />

      <div className="h-px bg-surface-border my-1" />

      {/* Future Stuff */}
      <MenubarItem
        label="Live Code Preview"
        icon={<Play className="w-4 h-4" />}
        disabled={true} 
      />

    </MenubarTrigger>
  );
}