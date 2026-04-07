import { XCircle, AlertTriangle, Shield, Globe, Cloud, CloudOff, Undo2, Redo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useModelStore } from "../../../../store/model.store";
import { useModelValidation } from "../../hooks/useModelValidation";
import { useLayoutStore } from "../../../../store/layout.store";
import { useCodeGenerationStore, LANGUAGE_OPTIONS } from "../../../../store/codeGeneration.store";

export default function StatusBar() {
  const { t } = useTranslation();
  const { activeTabId } = useWorkspaceStore();
  const { project } = useVFSStore();
  const { openProblemsTab } = useLayoutStore();

  const vfsTemporalState = useVFSStore.temporal.getState();
  const modelTemporalState = useModelStore.temporal.getState();

  const canUndo = (vfsTemporalState.pastStates?.length ?? 0) > 0 || (modelTemporalState.pastStates?.length ?? 0) > 0;
  const canRedo = (vfsTemporalState.futureStates?.length ?? 0) > 0 || (modelTemporalState.futureStates?.length ?? 0) > 0;

  const handleUndo = () => {
    useVFSStore.temporal.getState().undo();
    useModelStore.temporal.getState().undo();
  };

  const handleRedo = () => {
    useVFSStore.temporal.getState().redo();
    useModelStore.temporal.getState().redo();
  };

  const activeNode = activeTabId && project?.nodes[activeTabId];
  const activeFile = activeNode && activeNode.type === "FILE" ? activeNode : null;

  const fileName = activeFile?.name || t('statusbar.untitled');
  const diagramType = activeFile?.diagramType || "UNSPECIFIED";
  const { errorCount, errors, warningCount } = useModelValidation();
  const isCloudConnected = false;

  const targetLanguage = useCodeGenerationStore((s) => s.config.targetLanguage);
  const languageLabel = LANGUAGE_OPTIONS.find((o) => o.value === targetLanguage)?.label ?? 'Java';

  return (
    <footer className="h-8 w-full bg-surface-primary border-t border-surface-border flex justify-between items-center px-4 py-1 select-none shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent active:scale-95"
            title={`Undo (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Z)`}
          >
            <Undo2 className="w-3.5 h-3.5 text-text-primary" />
            <span className="text-xs font-medium text-text-primary">Undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent active:scale-95"
            title={`Redo (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Shift+Z)`}
          >
            <Redo2 className="w-3.5 h-3.5 text-text-primary" />
            <span className="text-xs font-medium text-text-primary">Redo</span>
          </button>
        </div>

        <div className="h-4 w-px bg-surface-border" />

        <div className="flex items-center gap-3">
          <button
            onClick={openProblemsTab}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            title={errors.length > 0 ? errors.join('\n') : 'No problems'}
          >
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            <span className={`text-xs font-medium ${errorCount > 0 ? 'text-red-400' : 'text-text-primary'}`}>
              {errorCount}
            </span>
          </button>
          <span className="text-xs font-medium text-text-muted">/</span>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-medium text-text-primary">{warningCount}</span>
          </div>
        </div>

        <div className="h-4 w-px bg-surface-border" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">{diagramType}</span>
          <span className="text-xs font-medium text-text-primary">{fileName}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          className="flex items-center gap-1.5 text-text-primary hover:text-blue-400 transition-colors"
          title={t('statusbar.umlValidator')}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{t('statusbar.umlValidator')}</span>
        </button>

        <div className="h-4 w-px bg-surface-border" />

        <button 
          className="flex items-center gap-1.5 text-text-primary hover:text-blue-400 transition-colors"
          title={t('statusbar.languageMode')}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{languageLabel}</span>
        </button>

        <div className="h-4 w-px bg-surface-border" />

        <div 
          className="flex items-center gap-1.5"
          title={isCloudConnected ? t('statusbar.cloudSynced') : t('statusbar.cloudDisconnected')}
        >
          {isCloudConnected ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-medium text-text-primary">{t('statusbar.cloudSynced')}</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-medium text-text-muted">{t('statusbar.cloudDisconnected')}</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
