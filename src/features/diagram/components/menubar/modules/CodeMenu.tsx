import { Play, FileCode2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useUiStore } from "../../../../../store/uiStore";
import { useWorkspaceStore } from "../../../../../store/workspace.store";
import { getDiagramRegistry } from "../../../../../core/registry/diagram-registry";
import { getIconComponent } from "../../../../../core/registry/icon-map";

export function CodeMenu() {
  const { t } = useTranslation();
  
  const openSingleGenerator = useUiStore((s) => s.openSingleGenerator); 
  const openProjectGenerator = useUiStore((s) => s.openProjectGenerator); 
  const openImportModal = useUiStore((s) => s.openImportCode);
  const openCodeExportConfig = useUiStore((s) => s.openCodeExportConfig);

  // Get active file and diagram type
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const activeFile = activeFileId ? getFile(activeFileId) : null;
  const diagramType = activeFile?.diagramType || 'CLASS_DIAGRAM';

  // Get code generation actions from registry
  const codeActions = useMemo(() => {
    try {
      const registry = getDiagramRegistry(diagramType);
      return registry.codeGenerationActions;
    } catch (error) {
      console.error('Failed to get code generation actions:', error);
      return [];
    }
  }, [diagramType]);

  // If no code generation actions available, don't render the menu
  if (codeActions.length === 0) {
    return null;
  }

  // Map action IDs to handlers
  const actionHandlers: Record<string, () => void> = {
    'generate-class': openSingleGenerator,
    'generate-project': openProjectGenerator,
    'import-java': openImportModal,
    'export-config': openCodeExportConfig,
  };

  return (
   <MenubarTrigger label={t("menubar.code.title")}>
      {codeActions.map((action, index) => {
        const IconComponent = getIconComponent(action.icon);
        const handler = actionHandlers[action.id];
        
        return (
          <div key={action.id}>
            <MenubarItem
              label={action.translationKey ? t(action.translationKey) : action.label}
              icon={IconComponent ? <IconComponent className="w-4 h-4" /> : undefined}
              shortcut={action.id === 'generate-class' ? 'Ctrl+G' : undefined}
              onClick={handler}
              disabled={!action.enabled}
            />
            {/* Add separator after generate-project and import-java */}
            {(action.id === 'generate-project' || action.id === 'import-java') && 
             index < codeActions.length - 1 && (
              <div className="h-px bg-surface-border my-1" />
            )}
          </div>
        );
      })}

      {/* Export Configuration */}
      <div className="h-px bg-surface-border my-1" />
      <MenubarItem
        label={t("menubar.code.exportConfig")} 
        icon={<FileCode2 className="w-4 h-4" />}
        onClick={openCodeExportConfig}
      />

      {/* Future Stuff */}
      <div className="h-px bg-surface-border my-1" />
      <MenubarItem
        label={t("menubar.code.livePreview")} 
        icon={<Play className="w-4 h-4" />}
        disabled={true} 
      />
    </MenubarTrigger>
  );
}