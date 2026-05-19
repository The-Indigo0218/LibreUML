/**
 * useAutoSave — three-level autosave lifecycle hook.
 *
 * Level 1 — Local (always active)
 *   Writes {project, model, savedAt} to localStorage every 3 s via setInterval.
 *
 * Level 2 — Cloud (cloud mode only)
 *   Delegates to CloudSyncService, which runs 3 independent 30 s debounced channels:
 *   metadata, model, and per-diagram canvas.
 *
 * Level 3 — Hard-close flush (cloud mode only)
 *   a) visibilitychange → 'hidden': calls forceSyncNow() (async, page still alive).
 *   b) beforeunload: sends keepalive fetch for model + pending diagrams.
 *      Uses browser keepalive flag so the request survives page teardown.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore }     from '../../auth/store/auth.store';
import { useSyncStore }     from '../../../store/sync.store';
import { useVFSStore }      from '../../../store/project-vfs.store';
import { useModelStore }    from '../../../store/model.store';
import { cloudSyncService } from '../services/cloudSync.service';
import { autoSaveQueue }    from '../services/autoSaveQueue';
import type { VFSFile } from '../../../core/domain/vfs/vfs.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCAL_SAVE_KEY         = 'libreuml-autosave-snapshot';
const LOCAL_SAVE_INTERVAL_MS = 3_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiBase(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
}

/**
 * Sends keepalive PATCH requests for pending channels at page teardown.
 * Fires model + any pending diagrams as independent keepalive fetches.
 * DO NOT await — beforeunload handlers must be synchronous.
 */
function sendKeepaliveFlush(projectId: string, modelVersion: number): void {
  const model   = useModelStore.getState().model;
  const project = useVFSStore.getState().project;
  const { cloudDiagrams } = useSyncStore.getState();
  const base = apiBase();
  const headers = { 'Content-Type': 'application/json' };
  const opts = { method: 'PATCH', keepalive: true, credentials: 'include' as RequestCredentials, headers };

  // Channel 2: model keepalive
  void fetch(`${base}/projects/${projectId}/model`, {
    ...opts,
    body: JSON.stringify({ data: model, version: modelVersion }),
  });

  // Channel 3: per-diagram keepalive for changed diagrams
  if (project) {
    for (const [vfsId, node] of Object.entries(project.nodes)) {
      if (node.type !== 'FILE') continue;
      const entry = cloudDiagrams[vfsId];
      if (!entry) continue;
      void fetch(`${base}/projects/${projectId}/diagrams/${entry.cloudId}`, {
        ...opts,
        body: JSON.stringify({
          viewData: (node as VFSFile).content ?? {},
          version:  entry.version,
        }),
      });
    }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutoSave(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storageMode     = useSyncStore((s) => s.storageMode);
  const projectId       = useVFSStore((s) => s.project?.id ?? null);

  const localIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushLocal = useCallback((): void => {
    const project = useVFSStore.getState().project;
    const model   = useModelStore.getState().model;
    if (!project && !model) return;
    try {
      localStorage.setItem(
        LOCAL_SAVE_KEY,
        JSON.stringify({
          project: model && project ? { ...project, semanticModel: model } : project,
          savedAt: Date.now(),
        }),
      );
    } catch {
      // localStorage quota exceeded — silent failure
    }
  }, []);

  useEffect(() => {
    localIntervalRef.current = setInterval(flushLocal, LOCAL_SAVE_INTERVAL_MS);

    const cloudActive = isAuthenticated && storageMode === 'cloud' && projectId !== null;

    if (cloudActive) {
      cloudSyncService.start();
      autoSaveQueue.start();
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState !== 'hidden') return;
      flushLocal();
      if (cloudActive) void cloudSyncService.forceSyncNow();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBeforeUnload = (): void => {
      flushLocal();
      if (!cloudActive || !cloudSyncService.hasPendingDebounce()) return;
      cloudSyncService.cancelDebounce();
      const { cloudProjectId, modelVersion } = useSyncStore.getState();
      if (cloudProjectId) sendKeepaliveFlush(cloudProjectId, modelVersion);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (localIntervalRef.current) {
        clearInterval(localIntervalRef.current);
        localIntervalRef.current = null;
      }
      if (cloudActive) {
        cloudSyncService.stop();
        autoSaveQueue.stop();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, storageMode, projectId, flushLocal]);
}
