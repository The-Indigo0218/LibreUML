import { Play, FileCode2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useUiStore } from "../../../../../store/uiStore";
import { useWorkspaceStore } from "../../../../../store/workspace.store";
import { useVFSStore } from "../../../../../store/project-vfs.store";
import { getDiagramRegistry } from "../../../../../core/registry/diagram-registry";
import { getIconComponent } from "../../../../../core/registry/icon-map";
import { useModelStore } from "../../../../../store/model.store";
import { useToastStore } from "../../../../../store/toast.store";
import { standaloneModelOps, getLocalModel } from "../../../../../store/standaloneModelOps";
import { isDiagramView } from "../../../hooks/useVFSCanvasController";
import { deriveOperationStubs, applyOperationStubs } from "../../../../../services/sequenceStubGenerator";
import type { VFSFile, DiagramView } from "../../../../../core/domain/vfs/vfs.types";

export function CodeMenu() {
  const { t } = useTranslation();

  const openSingleGenerator = useUiStore((s) => s.openSingleGenerator);
  const openProjectGenerator = useUiStore((s) => s.openProjectGenerator);
  const openImportModal = useUiStore((s) => s.openImportCode);
  const openCodeExportConfig = useUiStore((s) => s.openCodeExportConfig);

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);

  const diagramType = (() => {
    if (!activeTabId || !project) return 'CLASS_DIAGRAM';
    const node = project.nodes[activeTabId];
    if (node?.type === 'FILE') return (node as VFSFile).diagramType;
    return 'CLASS_DIAGRAM';
  })();

  const codeActions = useMemo(() => {
    try {
      const registry = getDiagramRegistry(diagramType);
      return registry.codeGenerationActions;
    } catch (error) {
      console.error('Failed to get code generation actions:', error);
      return [];
    }
  }, [diagramType]);

  const handleGenerateStubs = () => {
    if (!activeTabId || !project) return;
    const node = project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return;
    const file = node as VFSFile;
    const isStandalone = file.standalone === true;
    const model = isStandalone ? getLocalModel(activeTabId) : useModelStore.getState().model;
    if (!model) return;
    const view = isDiagramView(file.content) ? (file.content as DiagramView) : null;

    const plans = deriveOperationStubs(model, view);
    if (plans.length === 0) {
      useToastStore.getState().show('ℹ️ No hay mensajes con nombre que generen stubs');
      return;
    }
    const ops = isStandalone ? standaloneModelOps(activeTabId) : useModelStore.getState();
    const count = applyOperationStubs(model, plans, ops.setElementMembers);
    useToastStore.getState().show(`✅ ${count} operación(es) generada(s) en ${plans.length} clasificador(es)`);
  };

  if (codeActions.length === 0) {
    return null;
  }

  const actionHandlers: Record<string, () => void> = {
    'generate-class': openSingleGenerator,
    'generate-project': openProjectGenerator,
    'import-java': openImportModal,
    'export-config': openCodeExportConfig,
    'generate-stubs': handleGenerateStubs,
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
      <div className="h-px bg-surface-border my-1" />
      <MenubarItem
        label={t("menubar.code.exportConfig")} 
        icon={<FileCode2 className="w-4 h-4" />}
        onClick={openCodeExportConfig}
      />
      <div className="h-px bg-surface-border my-1" />
      <MenubarItem
        label={t("menubar.code.livePreview")} 
        icon={<Play className="w-4 h-4" />}
        disabled={true} 
      />
    </MenubarTrigger>
  );
}