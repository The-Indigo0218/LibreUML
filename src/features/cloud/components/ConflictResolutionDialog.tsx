import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CloudUpload, Download, X } from 'lucide-react';
import { useSyncStore } from '../../../store/sync.store';
import { cloudAdapter } from '../../../adapters/storage/cloud.adapter';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { invalidateQuota } from '../hooks/useQuota';
import type { SemanticModel, VFSFile } from '../../../core/domain/vfs/vfs.types';

export default function ConflictResolutionDialog() {
  const { t } = useTranslation();
  const { syncStatus, conflictDetails, cloudProjectId } = useSyncStore();
  const { setSyncStatus, setConflictDetails, updateModelVersion, updateDiagramVersion } =
    useSyncStore.getState();
  const loadModel = useModelStore((s) => s.loadModel);

  const [isBusy, setIsBusy] = useState(false);

  if (syncStatus !== 'conflict' || !conflictDetails || !cloudProjectId) return null;

  const kind = conflictDetails.kind;

  // ── Conflict labels ───────────────────────────────────────────────────────

  const kindLabel =
    kind === 'model'    ? t('cloud.conflict.kindModel',    { defaultValue: 'semantic model' }) :
    kind === 'diagram'  ? t('cloud.conflict.kindDiagram',  { defaultValue: 'diagram canvas' }) :
                          t('cloud.conflict.kindMetadata', { defaultValue: 'project settings' });

  const handleKeepMine = async () => {
    setIsBusy(true);
    try {
      if (kind === 'model') {
        const model = useModelStore.getState().model;
        const resp = await cloudAdapter.updateModelInCloud(cloudProjectId, {
          data:    model as unknown as Record<string, unknown>,
          version: conflictDetails.serverVersion,
        });
        updateModelVersion(resp.version);

      } else if (kind === 'diagram') {
        const { cloudDiagrams } = useSyncStore.getState();
        const entry = cloudDiagrams[conflictDetails.vfsDiagramId];
        if (!entry) throw new Error('Diagram cloud entry not found');
        const project = useVFSStore.getState().project;
        const file = project?.nodes[conflictDetails.vfsDiagramId] as VFSFile | undefined;
        const resp = await cloudAdapter.updateDiagramInCloud(
          cloudProjectId,
          entry.cloudId,
          {
            viewData: (file?.content ?? {}) as Record<string, unknown>,
            version:  conflictDetails.serverVersion,
          },
        );
        updateDiagramVersion(conflictDetails.vfsDiagramId, resp.version);

      } else {
        const project = useVFSStore.getState().project;
        if (!project) throw new Error('No project');
        await cloudAdapter.updateProjectInCloud(cloudProjectId, {
          name:    project.projectName,
          version: conflictDetails.serverVersion,
        });
      }

      setConflictDetails(null);
      setSyncStatus('saved');
      invalidateQuota();
    } catch {
      setSyncStatus('error', t('cloud.conflict.keepMineFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleKeepTheirs = async () => {
    setIsBusy(true);
    try {
      const full = await cloudAdapter.loadProjectFull(cloudProjectId);

      if (kind === 'model') {
        loadModel(full.model.data as unknown as SemanticModel);
        updateModelVersion(full.model.version);

      } else if (kind === 'diagram') {
        const serverDiag = full.diagrams.find(
          (d) => d.path === conflictDetails.vfsDiagramId,
        );
        if (serverDiag) {
          useVFSStore.getState().updateNode(conflictDetails.vfsDiagramId, { content: serverDiag.viewData });
          updateDiagramVersion(conflictDetails.vfsDiagramId, serverDiag.version);
        }

      } else {
        // metadata resolved by reloading full project — no local action needed
      }

      setConflictDetails(null);
      setSyncStatus('saved');
    } catch {
      setSyncStatus('error', t('cloud.conflict.keepTheirsFailed'));
    } finally {
      setIsBusy(false);
    }
  };

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

        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h2 id="conflict-dialog-title" className="text-base font-semibold text-text-primary">
              {t('cloud.conflict.title')}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {t('cloud.conflict.body', { kind: kindLabel })}
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

        <p className="text-xs text-text-muted border-t border-surface-border pt-3">
          {t('cloud.conflict.hint')}
        </p>
      </div>
    </div>
  );
}
