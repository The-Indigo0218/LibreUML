import React, { useState, useRef, useEffect } from "react";
import {
  XCircle, AlertTriangle, Shield, Globe,
  Cloud, CloudOff, CloudUpload, CheckCircle,
  WifiOff, RefreshCw, LogIn, Wifi, WifiZero,
  Undo2, Redo2, Grid3X3,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useProjectProblems } from "../../hooks/useProjectProblems";
import { useLayoutStore } from "../../../../store/layout.store";
import { useCodeGenerationStore, LANGUAGE_OPTIONS } from "../../../../store/codeGeneration.store";
import { useUndoManager } from "../../../../core/undo/useUndoManager";
import { undoManager } from "../../../../core/undo/instance";
import { useAuthStore } from "../../../auth/store/auth.store";
import { useQuota } from "../../../cloud/hooks/useQuota";
import { useAutoSave } from "../../../cloud/hooks/useAutoSave";
import { useSyncStore } from "../../../../store/sync.store";
import { cloudSyncService } from "../../../cloud/services/cloudSync.service";
import { useSettingsStore, type GridType } from "../../../../store/settingsStore";
import { DotsPreview, LinesPreview, GridPreview, NonePreview } from "../../../../components/shared/GridTypePreviews";
import StorageQuotaBar from "../../../../components/shared/StorageQuotaBar";
import QuotaWarningDialog from "../../../cloud/components/QuotaWarningDialog";
import ConflictResolutionDialog from "../../../cloud/components/ConflictResolutionDialog";
import UploadLocalProject from "../../../cloud/components/UploadLocalProject";

// ─── Grid picker ──────────────────────────────────────────────────────────────

const GRID_OPTIONS: { type: GridType; labelKey: string; Preview: () => React.ReactElement }[] = [
  { type: 'dots',  labelKey: 'canvas.gridPicker.dots',  Preview: DotsPreview  },
  { type: 'lines', labelKey: 'canvas.gridPicker.lines', Preview: LinesPreview },
  { type: 'grid',  labelKey: 'canvas.gridPicker.solid', Preview: GridPreview  },
  { type: 'none',  labelKey: 'canvas.gridPicker.none',  Preview: NonePreview  },
];

function GridStatusButton() {
  const { t } = useTranslation();
  const gridType    = useSettingsStore((s) => s.gridType);
  const setGridType = useSettingsStore((s) => s.setGridType);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = t(GRID_OPTIONS.find(o => o.type === gridType)?.labelKey ?? 'canvas.gridPicker.dots');

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-text-primary hover:text-blue-400 transition-colors"
        title={t('statusbar.gridType')}
      >
        <Grid3X3 className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">{currentLabel}</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 z-50 bg-surface-primary border border-surface-border rounded-xl shadow-2xl p-1 flex gap-0.5 animate-in fade-in zoom-in-95 duration-150">
          {GRID_OPTIONS.map(({ type, labelKey, Preview }) => {
            const active = gridType === type;
            const label  = t(labelKey);
            return (
              <button
                key={type}
                onClick={() => { setGridType(type); setOpen(false); }}
                title={label}
                className={`flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-lg transition-all duration-150 ${
                  active
                    ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
                    : 'text-text-muted hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                <Preview />
                <span className="text-[9px] leading-none font-medium tracking-wide uppercase">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Cloud status ─────────────────────────────────────────────────────────────

function CloudStatusButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { syncStatus, storageMode, cloudProjectId, enterLocalMode, enterCloudMode } = useSyncStore();
  const { quota } = useQuota();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Determine icon + label for the trigger button ──────────────────────────
  let icon: React.ReactElement;
  let label: string;
  let iconColor: string;

  if (!isAuthenticated) {
    icon      = <CloudOff className="w-3.5 h-3.5" />;
    label     = t('statusbar.cloudDisconnected');
    iconColor = 'text-text-muted';
  } else if (storageMode === 'cloud') {
    if (syncStatus === 'saving') {
      icon      = <CloudUpload className="w-3.5 h-3.5 animate-pulse" />;
      label     = t('cloud.sync.saving');
      iconColor = 'text-text-muted';
    } else if (syncStatus === 'saved') {
      icon      = <CheckCircle className="w-3.5 h-3.5" />;
      label     = t('cloud.sync.saved');
      iconColor = 'text-green-400';
    } else if (syncStatus === 'conflict') {
      icon      = <AlertTriangle className="w-3.5 h-3.5" />;
      label     = t('cloud.sync.conflict');
      iconColor = 'text-yellow-400';
    } else if (syncStatus === 'error') {
      icon      = <RefreshCw className="w-3.5 h-3.5" />;
      label     = t('cloud.sync.error');
      iconColor = 'text-red-400';
    } else if (syncStatus === 'offline') {
      icon      = <WifiOff className="w-3.5 h-3.5" />;
      label     = t('cloud.sync.offline');
      iconColor = 'text-text-muted';
    } else {
      icon      = <Cloud className="w-3.5 h-3.5" />;
      label     = t('statusbar.cloudSynced');
      iconColor = 'text-blue-400';
    }
  } else {
    // authenticated but local mode
    icon      = <CloudOff className="w-3.5 h-3.5" />;
    label     = t('statusbar.cloudOffline');
    iconColor = 'text-text-muted';
  }

  // ── Popover content ────────────────────────────────────────────────────────
  const renderPopover = () => {
    if (!isAuthenticated) {
      return (
        <div className="w-56 p-4 space-y-3">
          <div className="flex items-center gap-2 text-text-primary">
            <CloudOff className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-sm font-semibold">{t('statusbar.cloudPopover.notLoggedTitle')}</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {t('statusbar.cloudPopover.notLoggedBody')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { navigate('/login'); setOpen(false); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t('auth.loginButton')}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              {t('statusbar.cloudPopover.notNow')}
            </button>
          </div>
        </div>
      );
    }

    if (storageMode === 'cloud') {
      return (
        <div className="w-56 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-sm font-semibold text-text-primary">{t('statusbar.cloudPopover.onlineTitle')}</span>
          </div>
          {quota && <StorageQuotaBar quota={quota} variant="compact" />}
          {syncStatus === 'error' && (
            <button
              onClick={() => { void cloudSyncService.forceSyncNow(); setOpen(false); }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface-hover text-xs text-red-400 hover:text-red-300 rounded-md border border-red-400/30 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('statusbar.cloudPopover.retrySync')}
            </button>
          )}
          <button
            onClick={() => { enterLocalMode(); setOpen(false); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface-secondary border border-surface-border text-xs text-text-secondary hover:text-text-primary rounded-md transition-colors"
          >
            <WifiZero className="w-3.5 h-3.5" />
            {t('statusbar.cloudPopover.goOffline')}
          </button>
        </div>
      );
    }

    // authenticated + local mode
    return (
      <div className="w-56 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CloudOff className="w-4 h-4 text-text-muted shrink-0" />
          <span className="text-sm font-semibold text-text-primary">{t('statusbar.cloudPopover.offlineTitle')}</span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          {t('statusbar.cloudPopover.offlineBody')}
        </p>
        {cloudProjectId && (
          <button
            onClick={() => { enterCloudMode(); setOpen(false); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors"
          >
            <Wifi className="w-3.5 h-3.5" />
            {t('statusbar.cloudPopover.goOnline')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 transition-colors hover:opacity-80 ${iconColor}`}
        title={label}
      >
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 z-50 bg-surface-primary border border-surface-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          {renderPopover()}
        </div>
      )}
    </div>
  );
}

// ─── StatusBar ─────────────────────────────────────────────────────────────────

export default function StatusBar() {
  const { t } = useTranslation();
  const { activeTabId } = useWorkspaceStore();
  const { project } = useVFSStore();
  const { openProblemsTab } = useLayoutStore();
  const { canUndo, canRedo, undo: handleUndo, redo: handleRedo } = useUndoManager(undoManager, activeTabId ?? undefined);

  const activeNode = activeTabId && project?.nodes[activeTabId];
  const activeFile = activeNode && activeNode.type === "FILE" ? activeNode : null;

  const fileName    = activeFile?.name || t('statusbar.untitled');
  const diagramType = activeFile?.diagramType || "UNSPECIFIED";
  const { errorCount, warningCount, problems } = useProjectProblems();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { quota } = useQuota();

  useAutoSave();

  const targetLanguage = useCodeGenerationStore((s) => s.config.targetLanguage);
  const languageLabel  = LANGUAGE_OPTIONS.find((o) => o.value === targetLanguage)?.label ?? 'Java';

  return (
    <>
      {isAuthenticated && quota && <QuotaWarningDialog quota={quota} />}
      <ConflictResolutionDialog />
      <UploadLocalProject />

      <footer className="h-8 w-full bg-surface-primary border-t border-surface-border flex justify-between items-center px-4 py-1 select-none shrink-0">
        {/* ── Left ── */}
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
              title={problems.length > 0 ? problems.map((p) => p.message).join('\n') : 'No problems'}
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

        {/* ── Right ── */}
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

          {/* Grid type picker */}
          <GridStatusButton />

          <div className="h-4 w-px bg-surface-border" />

          {/* Cloud sync */}
          <CloudStatusButton />
        </div>
      </footer>
    </>
  );
}
