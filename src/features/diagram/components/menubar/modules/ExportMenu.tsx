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
import { useProjectStore } from "../../../../../store/project.store";
import { useWorkspaceStore } from "../../../../../store/workspace.store";
import { XmiConverterService } from "../../../../../services/xmiConverter.service";
import type { UmlClassNode, UmlEdge } from "../../../types/diagram.types";

export function ExportMenu() {
  const { t } = useTranslation();
  const openExportModal = useUiStore((s) => s.openExportModal);
  
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const activeFile = activeFileId ? getFile(activeFileId) : null;
  const diagramName = activeFile?.name || "diagram";

  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);

  const handleExportXmi = () => {
    if (!activeFile) return;
    
    const domainNodes = getNodes(activeFile.nodeIds);
    const domainEdges = getEdges(activeFile.edgeIds);

    const legacyNodes = domainNodes.map(n => ({
      id: n.id,
      type: 'umlClass',
      position: { x: 0, y: 0 },
      data: {
        label: (n as any).name,
        stereotype: n.type.toLowerCase() as any,
        attributes: (n as any).attributes || [],
        methods: (n as any).methods || [],
        generics: (n as any).generics,
        package: (n as any).package,
      }
    }));

    const legacyEdges = domainEdges.map(e => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: e.type.toLowerCase(),
      data: { type: e.type.toLowerCase() }
    }));

    const exportId = crypto.randomUUID();

    XmiConverterService.downloadXmi(
      exportId,
      diagramName,
      legacyNodes as unknown as UmlClassNode[],
      legacyEdges as unknown as UmlEdge[]
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