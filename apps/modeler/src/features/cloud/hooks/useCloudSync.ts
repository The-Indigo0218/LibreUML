// src/features/cloud/hooks/useCloudSync.ts
//
// Activates CloudSyncService while the user is authenticated and has a
// cloud-linked project open. Cleans up on logout or project close.

import { useEffect } from 'react';
import { useAuthStore } from '../../auth/store/auth.store';
import { useSyncStore } from '../../../store/sync.store';
import { useVFSStore } from '../../../store/project-vfs.store';
import { cloudSyncService } from '../services/cloudSync.service';

export function useCloudSync(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storageMode     = useSyncStore((s) => s.storageMode);
  const projectId       = useVFSStore((s) => s.project?.id ?? null);

  useEffect(() => {
    if (isAuthenticated && storageMode === 'cloud' && projectId) {
      cloudSyncService.start();
      return () => { cloudSyncService.stop(); };
    }
    cloudSyncService.stop();
    return undefined;
  }, [isAuthenticated, storageMode, projectId]);
}
