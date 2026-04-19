/**
 * useAutoSave — three-level autosave lifecycle hook.
 *
 * Level 1 — Local (always active)
 *   Writes {project, model, savedAt} to localStorage every 3 s via setInterval.
 *   Runs even in local-only mode; state is read at flush time to avoid stale closures.
 *
 * Level 2 — Cloud (cloud mode only)
 *   Delegates to CloudSyncService, which debounces PATCH requests by 30 s after the
 *   last store mutation. Active only when isAuthenticated + storageMode === 'cloud'.
 *
 * Level 3 — Hard-close flush (cloud mode only)
 *   a) visibilitychange → 'hidden': flushes local + calls forceSyncNow() while the
 *      page is still alive (normal async request, no special handling needed).
 *   b) beforeunload: flushes local + sends a keepalive PATCH that the browser keeps
 *      alive after page teardown. Do NOT await — beforeunload handlers must be sync.
 *
 * Integration in KonvaCanvas (or any top-level canvas wrapper):
 *
 *   import { useAutoSave } from '../features/cloud/hooks/useAutoSave';
 *
 *   export default function KonvaCanvas() {
 *     useAutoSave();
 *     // ... rest of component
 *   }
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore }     from '../../auth/store/auth.store';
import { useSyncStore }     from '../../../store/sync.store';
import { useVFSStore }      from '../../../store/project-vfs.store';
import { useModelStore }    from '../../../store/model.store';
import { cloudSyncService } from '../services/cloudSync.service';
import { autoSaveQueue }    from '../services/autoSaveQueue';

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCAL_SAVE_KEY         = 'libreuml-autosave-snapshot';
const LOCAL_SAVE_INTERVAL_MS = 3_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiBase(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
}

/**
 * Fires a keepalive PATCH with the current project + model state.
 * Intentionally fire-and-forget — do NOT await in a beforeunload handler.
 */
function sendKeepalivePatch(cloudDiagramId: string, version: number): void {
  const payload = {
    project: useVFSStore.getState().project,
    model:   useModelStore.getState().model,
  };

  void fetch(`${apiBase()}/diagrams/${cloudDiagramId}`, {
    method:      'PATCH',
    keepalive:   true,          // survives page teardown
    credentials: 'include',     // sends __Host-jwt cookie
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ version, content: payload }),
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutoSave(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storageMode     = useSyncStore((s) => s.storageMode);
  const projectId       = useVFSStore((s) => s.project?.id ?? null);

  const localIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable reference — reads store state at call time, never captures stale values.
  const flushLocal = useCallback((): void => {
    const project = useVFSStore.getState().project;
    const model   = useModelStore.getState().model;
    if (!project && !model) return;

    try {
      localStorage.setItem(
        LOCAL_SAVE_KEY,
        JSON.stringify({ project, model, savedAt: Date.now() }),
      );
    } catch {
      // localStorage quota exceeded — best-effort, silent failure
    }
  }, []);

  useEffect(() => {
    // Level 1: always active, even when the project is local-only.
    localIntervalRef.current = setInterval(flushLocal, LOCAL_SAVE_INTERVAL_MS);

    const cloudActive = isAuthenticated && storageMode === 'cloud' && projectId !== null;

    if (cloudActive) {
      cloudSyncService.start();
      autoSaveQueue.start();
    }

    // Level 3a: tab hidden — page still alive, so normal async request is fine.
    const handleVisibilityChange = (): void => {
      if (document.visibilityState !== 'hidden') return;
      flushLocal();
      if (cloudActive) void cloudSyncService.forceSyncNow();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Level 3b: page close — keepalive flag keeps the request alive after teardown.
    const handleBeforeUnload = (): void => {
      flushLocal();
      if (!cloudActive || !cloudSyncService.hasPendingDebounce()) return;
      cloudSyncService.cancelDebounce();
      const { cloudDiagramId, version } = useSyncStore.getState();
      if (cloudDiagramId) sendKeepalivePatch(cloudDiagramId, version);
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
