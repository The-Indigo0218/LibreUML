import { Download, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useUiStore } from "../../../../../store/uiStore";
import { useProjectStore } from "../../../../../store/project.store";
import { useWorkspaceStore } from "../../../../../store/workspace.store";
import { XmiConverterService } from "../../../../../services/xmiConverter.service";
import { getDiagramRegistry } from "../../../../../core/registry/diagram-registry";
import { getIconComponent } from "../../../../../core/registry/icon-map";

export function ExportMenuContent() {
  const { t } = useTranslation();
  const openExportModal = useUiStore((s) => s.openExportModal);
  
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const activeFile = activeFileId ? getFile(activeFileId) : null;
  const diagramName = activeFile?.name || "diagram";
  const diagramType = activeFile?.diagramType || 'CLASS_DIAGRAM';

  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);

  const exportActions = useMemo(() => {
    try {
      const registry = getDiagramRegistry(diagramType);
      return registry.exportActions;
    } catch (error) {
      console.error('Failed to get export actions:', error);
      return [];
    }
  }, [diagramType]);

  const handleExportXmi = () => {
    if (!activeFile) return;
    
    const domainNodes = getNodes(activeFile.nodeIds);
    const domainEdges = getEdges(activeFile.edgeIds);

    const exportId = crypto.randomUUID();

    XmiConverterService.downloadXmi(
      exportId,
      diagramName,
      domainNodes,
      domainEdges
    );
  };

  const actionHandlers: Record<string, () => void> = {
    'export-image': openExportModal,
    'export-xmi': handleExportXmi,
  };

  return (
    <>
      {exportActions.map((action) => {
        const IconComponent = getIconComponent(action.icon);
        const handler = actionHandlers[action.id];
        
        return (
          <MenubarItem
            key={action.id}
            label={action.translationKey ? t(action.translationKey) : action.label}
            icon={IconComponent ? <IconComponent className="w-4 h-4" /> : undefined}
            shortcut={action.id === 'export-image' ? 'Ctrl+E' : undefined}
            onClick={handler}
            disabled={!action.enabled}
          />
        );
      })}

      <div className="h-px bg-surface-border my-1" />
      
      <MenubarItem
        label={t("menubar.export.pdf") || "Export PDF"}
        icon={<Download className="w-4 h-4" />}
        disabled={true}
      />
       <MenubarItem
        label={t("menubar.export.github") || "Export to GitHub"}
        icon={<Share2 className="w-4 h-4" />}
        disabled={true}
      />
    </>
  );
}

export function ExportMenu() {
  const { t } = useTranslation();

  return (
    <MenubarTrigger label={t("menubar.export.title") || "Export"}>
      <ExportMenuContent />
    </MenubarTrigger>
  );
}