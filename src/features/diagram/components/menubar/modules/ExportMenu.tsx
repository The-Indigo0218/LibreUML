import { 
  Download, 
  Image as ImageIcon,
  Share2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useUiStore } from "../../../../../store/uiStore";

export function ExportMenu() {
  const { t } = useTranslation();
  const openExportModal = useUiStore((s) => s.openExportModal);

  return (
    <MenubarTrigger label={t("menubar.export.title") || "Export"}>
      
      {/* Primary Action */}
      <MenubarItem
        label={t("menubar.export.image") || "Export Image..."}
        icon={<ImageIcon className="w-4 h-4" />}
        shortcut="Ctrl+E"
        onClick={openExportModal}
      />

      {/* Future Features (Placeholder) */}
      <div className="h-px bg-surface-border my-1" />
      
      <MenubarItem
        label={t("menubar.export.pdf") || "Export PDF"}
        icon={<Download className="w-4 h-4" />}
        disabled={true} // Coming soon
      />
       <MenubarItem
        label={t("menubar.export.github") || "Export to GitHub"}
        icon={<Share2 className="w-4 h-4" />}
        disabled={true} // Coming soon
      />

    </MenubarTrigger>
  );
}