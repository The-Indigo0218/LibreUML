import { Download, Share2, Cloud, Image } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useUiStore } from "../../../../../store/uiStore";

export function ExportMenuContent() {
  const { t } = useTranslation();
  const openExportModal = useUiStore((s) => s.openExportModal);

  return (
    <>
      {/* Primary Export Action */}
      <MenubarItem
        label={t("menubar.export.diagram")}
        icon={<Image className="w-4 h-4" />}
        shortcut="Ctrl+E"
        onClick={openExportModal}
      />

      {/* Separator */}
      <div className="h-px bg-surface-border my-1" />
      
      {/* Coming Soon Items */}
      <MenubarItem
        label={t("menubar.export.pdf")}
        icon={<Download className="w-4 h-4" />}
        disabled={true}
      />
      
      <MenubarItem
        label={t("menubar.export.cloud")}
        icon={<Cloud className="w-4 h-4" />}
        disabled={true}
      />
      
      <MenubarItem
        label={t("menubar.export.github")}
        icon={<Share2 className="w-4 h-4" />}
        disabled={true}
      />
    </>
  );
}

export function ExportMenu() {
  const { t } = useTranslation();

  return (
    <MenubarTrigger label={t("menubar.export.title")}>
      <ExportMenuContent />
    </MenubarTrigger>
  );
}