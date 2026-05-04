// src/features/cloud/components/UploadLocalProject.tsx
//
// One-time migration dialog that appears when a user logs in and has an
// existing local project not yet linked to the cloud.
//
// Conditions for display:
//   • isAuthenticated
//   • storageMode === 'local' (not already cloud-linked)
//   • project !== null
//   • user has not already responded for this project (declinedUploadProjectIds)
//
// Choices:
//   "Upload to Cloud"  — calls cloudSyncService.saveToCloud()
//   "Keep Local"       — marks projectId as decided, hides dialog permanently
//   "Ask Later"        — dismisses for this session without persisting the choice

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, HardDrive, Clock } from 'lucide-react';
import { useAuthStore }  from '../../auth/store/auth.store';
import { useSyncStore }  from '../../../store/sync.store';
import { useVFSStore }   from '../../../store/project-vfs.store';
import { cloudSyncService } from '../services/cloudSync.service';
import { payloadSize, formatQuota, QUOTA_BYTES } from '../utils/payloadSize';
import { useModelStore } from '../../../store/model.store';

// ── Component ──────────────────────────────────────────────────────────────────

export default function UploadLocalProject() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { storageMode, hasDeclinedUpload, markDeclinedUpload } = useSyncStore();
  const project = useVFSStore((s) => s.project);
  const model   = useModelStore((s) => s.model);

  const [dismissed, setDismissed]  = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Gate conditions ───────────────────────────────────────────────────────
  if (
    !isAuthenticated ||
    storageMode !== 'local' ||
    !project ||
    dismissed ||
    hasDeclinedUpload(project.id)
  ) {
    return null;
  }

  // ── Compute payload size for display ──────────────────────────────────────
  const payload     = { project, model };
  const bytes       = payloadSize(payload);
  const sizeLabel   = formatQuota(bytes);
  const tooBig      = bytes >= QUOTA_BYTES * 0.95;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    setIsUploading(true);
    setUploadError(null);
    const ok = await cloudSyncService.saveToCloud();
    setIsUploading(false);
    if (ok) {
      setDismissed(true);
    } else {
      const error = useSyncStore.getState().error;
      setUploadError(error ?? t('cloud.upload.error'));
    }
  };

  const handleKeepLocal = () => {
    markDeclinedUpload(project.id);
    setDismissed(true);
  };

  const handleAskLater = () => {
    setDismissed(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-project-title"
    >
      <div className="bg-surface-primary border border-surface-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start gap-3">
          <CloudUpload className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2
              id="upload-project-title"
              className="text-base font-semibold text-text-primary"
            >
              {t('cloud.upload.title')}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {t('cloud.upload.body', {
                projectName: project.projectName,
                size: sizeLabel,
                quota: formatQuota(QUOTA_BYTES),
              })}
            </p>
          </div>
        </div>

        {/* Too-big warning */}
        {tooBig && (
          <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">
            {t('cloud.upload.tooBig', { quota: formatQuota(QUOTA_BYTES) })}
          </p>
        )}

        {/* Upload error */}
        {uploadError && (
          <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">
            {uploadError}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => void handleUpload()}
            disabled={isUploading || tooBig}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CloudUpload className="w-4 h-4" aria-hidden="true" />
            <span>
              {isUploading
                ? t('cloud.upload.uploading')
                : t('cloud.upload.confirm', { size: sizeLabel })}
            </span>
          </button>

          <button
            onClick={handleKeepLocal}
            disabled={isUploading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm font-medium bg-surface-hover hover:bg-surface-border text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <HardDrive className="w-4 h-4" aria-hidden="true" />
            <span>{t('cloud.upload.keepLocal')}</span>
          </button>

          <button
            onClick={handleAskLater}
            disabled={isUploading}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium text-text-muted hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>{t('cloud.upload.askLater')}</span>
          </button>
        </div>

        <p className="text-xs text-text-muted border-t border-surface-border pt-3">
          {t('cloud.upload.hint')}
        </p>
      </div>
    </div>
  );
}
