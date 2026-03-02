import { 
  Download, 
  Image as ImageIcon,
  Share2,
  FileCode2 
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useUiStore } from "../../../../../store/uiStore";
import { useDiagramStore } from "../../../../../store/diagramStore"; 
import { XmiConverterService } from "../../../../../services/xmiConverter.service";
import type { UmlClassNode, UmlEdge } from "../../../types/diagram.types";

export function ExportMenu() {
  const { t } = useTranslation();
  const openExportModal = useUiStore((s) => s.openExportModal);
  
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const diagramName = useDiagramStore((s) => s.diagramName);

  const handleExportXmi = () => {
    const exportId = crypto.randomUUID();

    XmiConverterService.downloadXmi(
      exportId, 
      diagramName,
      nodes as unknown as UmlClassNode[],
      edges as unknown as UmlEdge[]
    );
  };

  return (
    <MenubarTrigger label={t("menubar.export.title") || "Export"}>
      
      {/* Primary Action */}
      <MenubarItem
        label={t("menubar.export.image") || "Export Image..."}
        icon={<ImageIcon className="w-4 h-4" />}
        shortcut="Ctrl+E"
        onClick={openExportModal}
      />

      <MenubarItem
        label={t("menubar.export.xmi") || "Export XMI (OMG Standard)"}
        icon={<FileCode2 className="w-4 h-4" />}
        onClick={handleExportXmi}
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