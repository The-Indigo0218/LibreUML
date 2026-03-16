import { XCircle, AlertTriangle, Shield, Globe, Cloud, CloudOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/vfs.store";

export default function StatusBar() {
  const { t } = useTranslation();
  const { activeTabId } = useWorkspaceStore();
  const { project } = useVFSStore();
  
  const activeNode = activeTabId && project?.nodes[activeTabId];
  const activeFile = activeNode && activeNode.type === "FILE" ? activeNode : null;
  
  const fileName = activeFile?.name || t('statusbar.untitled');
  const diagramType = activeFile?.diagramType || "UNSPECIFIED";
  const errorCount = 0;
  const warningCount = 0;
  const isCloudConnected = false;

  return (
    <footer className="h-8 w-full bg-surface-primary border-t border-surface-border flex justify-between items-center px-4 py-1 select-none shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-medium text-text-primary">{errorCount}</span>
          </div>
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
          <span className="text-xs font-medium">Java</span>
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
