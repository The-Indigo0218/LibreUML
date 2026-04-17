// src/features/cloud/components/ConflictResolutionDialog.tsx
//
// Shown when useSyncStore.syncStatus === 'conflict' (HTTP 409 from PATCH).
// Three choices:
//   "Keep Mine"   — re-send the local payload using the server's latest version
//   "Keep Theirs" — reload the project from the cloud, discarding local changes
//   "Resolve Later" — dismiss and stay in 'conflict' state (no further auto-saves)

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CloudUpload, Download, X } from 'lucide-react';
import { useSyncStore } from '../../../store/sync.store';
import { cloudAdapter } from '../../../adapters/storage/cloud.adapter';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { invalidateQuota } from '../hooks/useQuota';
import type { LibreUMLProject, SemanticModel } from '../../../core/domain/vfs/vfs.types';

// ── CloudContent shape ─────────────────────────────────────────────────────────

interface CloudContent {
  project: LibreUMLProject;
  model:   SemanticModel;
}

function isCloudContent(value: unknown): value is CloudContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'project' in value &&
    'model' in value
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ConflictResolutionDialog() {
  const { t } = useTranslation();
  const { syncStatus, conflictDetails, cloudDiagramId } = useSyncStore();
  const { setSyncStatus, setConflictDetails, updateVersion } = useSyncStore.getState();
  const loadProject  = useVFSStore((s) => s.loadProject);
  const loadModel    = useModelStore((s) => s.loadModel);

  const [isBusy, setIsBusy] = useState(false);

  if (syncStatus !== 'conflict' || !conflictDetails || !cloudDiagramId) return null;

  // ── Keep Mine — force-overwrite using server's version ───────────────────────

  const handleKeepMine = async () => {
    setIsBusy(true);
    try {
      const response = await cloudAdapter.updateInCloud(
        cloudDiagramId,
        conflictDetails.serverVersion,
        conflictDetails.localPayload,
      );
      updateVersion(response.version);
      setConflictDetails(null);
      setSyncStatus('saved');
      invalidateQuota();
    } catch {
      setSyncStatus('error', t('cloud.conflict.keepMineFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  // ── Keep Theirs — load server version, discard local ─────────────────────────

  const handleKeepTheirs = async () => {
    setIsBusy(true);
    try {
      const response = await cloudAdapter.loadFromCloud(cloudDiagramId);
      const content  = response.content;

      if (isCloudContent(content)) {
        loadProject(content.project);
        loadModel(content.model);
      }

      updateVersion(response.version);
      setConflictDetails(null);
      setSyncStatus('saved');
    } catch {
      setSyncStatus('error', t('cloud.conflict.keepTheirsFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  // ── Resolve Later — dismiss the dialog ────────────────────────────────────────

  const handleResolveLater = () => {
    setConflictDetails(null);
    setSyncStatus('error', t('cloud.conflict.pendingResolution'));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
    >
      <div className="bg-surface-primary border border-surface-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h2
              id="conflict-dialog-title"
              className="text-base font-semibold text-text-primary"
            >
              {t('cloud.conflict.title')}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {t('cloud.conflict.body')}
            </p>
          </div>
          <button
            onClick={handleResolveLater}
            disabled={isBusy}
            className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
            aria-label={t('cloud.conflict.resolveLater')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => void handleKeepMine()}
            disabled={isBusy}
            className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CloudUpload className="w-4 h-4" aria-hidden="true" />
            <span>{t('cloud.conflict.keepMine')}</span>
          </button>

          <button
            onClick={() => void handleKeepTheirs()}
            disabled={isBusy}
            className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium bg-surface-hover hover:bg-surface-border text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{t('cloud.conflict.keepTheirs')}</span>
          </button>

          <button
            onClick={handleResolveLater}
            disabled={isBusy}
            className="px-4 py-2 rounded text-sm font-medium text-text-muted hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('cloud.conflict.resolveLater')}
          </button>
        </div>

        {/* Explanation */}
        <p className="text-xs text-text-muted border-t border-surface-border pt-3">
          {t('cloud.conflict.hint')}
        </p>
      </div>
    </div>
  );
}
