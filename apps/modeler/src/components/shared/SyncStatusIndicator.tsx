// src/components/shared/SyncStatusIndicator.tsx
//
// Compact animated badge showing the current cloud sync state.
// Renders nothing when the project is local-only (storageMode === 'local').
//
// States:
//   saving   → pulsing cloud-upload icon + "Saving…"
//   saved    → green check + "Saved" (fades out after 2 s)
//   error    → red warning + message (clickable to retry)
//   conflict → yellow alert + "Conflict" (clickable to open resolution dialog)
//   offline  → grey cloud-off + "Offline"
//   idle     → nothing (or last-synced hint on hover)

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CloudUpload,
  CheckCircle,
  AlertTriangle,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useSyncStore } from '../../store/sync.store';
import { cloudSyncService } from '../../features/cloud/services/cloudSync.service';

export default function SyncStatusIndicator() {
  const { t } = useTranslation();
  const { syncStatus, storageMode, error } = useSyncStore();
  const [savedVisible, setSavedVisible] = useState(false);

  // Fade out "Saved" badge after 2 s
  useEffect(() => {
    if (syncStatus === 'saved') {
      setSavedVisible(true);
      const timer = setTimeout(() => setSavedVisible(false), 2_000);
      return () => clearTimeout(timer);
    } else {
      setSavedVisible(false);
    }
  }, [syncStatus]);

  // Only render for cloud-linked projects
  if (storageMode !== 'cloud') return null;

  if (syncStatus === 'idle' || (syncStatus === 'saved' && !savedVisible)) {
    return null;
  }

  if (syncStatus === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-text-muted animate-pulse">
        <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-xs font-medium">{t('cloud.sync.saving')}</span>
      </div>
    );
  }

  if (syncStatus === 'saved' && savedVisible) {
    return (
      <div className="flex items-center gap-1.5 text-green-400">
        <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-xs font-medium">{t('cloud.sync.saved')}</span>
      </div>
    );
  }

  if (syncStatus === 'conflict') {
    return (
      <button
        className="flex items-center gap-1.5 text-yellow-400 hover:text-yellow-300 transition-colors"
        title={t('cloud.sync.conflictHint')}
      >
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-xs font-medium">{t('cloud.sync.conflict')}</span>
      </button>
    );
  }

  if (syncStatus === 'error') {
    return (
      <button
        onClick={() => void cloudSyncService.forceSyncNow()}
        className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors"
        title={error ?? t('cloud.sync.error')}
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-xs font-medium">{t('cloud.sync.error')}</span>
      </button>
    );
  }

  if (syncStatus === 'offline') {
    return (
      <div
        className="flex items-center gap-1.5 text-text-muted"
        title={t('cloud.sync.offlineHint')}
      >
        <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-xs font-medium">{t('cloud.sync.offline')}</span>
      </div>
    );
  }

  return null;
}
