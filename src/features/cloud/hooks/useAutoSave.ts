// src/features/cloud/hooks/useAutoSave.ts
//
// useAutoSave — cloud auto-save lifecycle hook.
//
// Replaces the simpler useCloudSync hook in StatusBar.tsx.  Activates the
// CloudSyncService + AutoSaveQueue when the user is authenticated and the
// project is cloud-linked, and adds two flush behaviors that useCloudSync
// does not provide:
//
//   1. Flush on tab-hide (visibilitychange → hidden)
//      Calls cloudSyncService.forceSyncNow() while still in page context.
//      The resulting request completes normally since the page is still alive.
//
//   2. Flush on page unload (beforeunload)
//      If a debounce is pending (unsaved edits), cancels the timer and sends
//      a PATCH via fetch(..., { keepalive: true }).  The keepalive flag
//      instructs the browser to keep the request alive after the page is gone,
//      so the server still receives the final state even if the user closes
//      the tab immediately.  We do NOT await it — that would block unload.
//
// Race-condition note: The beforeunload flush reads current store state via
// useSyncStore.getState() and useVFSStore.getState() at the moment the event
// fires, not at mount time.  See §Non-trivial decisions in the tracking doc.

import { useEffect } from 'react';
import { useAuthStore }       from '../../auth/store/auth.store';
import { useSyncStore }       from '../../../store/sync.store';
import { useVFSStore }        from '../../../store/project-vfs.store';
import { useModelStore }      from '../../../store/model.store';
import { cloudSyncService }   from '../services/cloudSync.service';
import { autoSaveQueue }      from '../services/autoSaveQueue';

// ── Keepalive beacon helpers ──────────────────────────────────────────────────

/** Reads the backend base URL from Vite env, falling back to the same-origin path. */
function apiBase(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
}

/**
 * Fires a keepalive PATCH with the current project+model state.
 * This is intentionally fire-and-forget — do NOT await this in a
 * beforeunload handler (awaiting would block or be cancelled by the browser).
 */
function sendKeepalivePatch(cloudDiagramId: string, version: number): void {
  const payload = {
    project: useVFSStore.getState().project,
    model:   useModelStore.getState().model,
  };

  void fetch(`${apiBase()}/diagrams/${cloudDiagramId}`, {
    method:      'PATCH',
    keepalive:   true,          // survives page unload
    credentials: 'include',    // send __Host-jwt cookie
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ version, content: payload }),
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutoSave(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storageMode     = useSyncStore((s) => s.storageMode);
  const projectId       = useVFSStore((s) => s.project?.id ?? null);

  useEffect(() => {
    const active = isAuthenticated && storageMode === 'cloud' && projectId !== null;

    if (!active) {
      cloudSyncService.stop();
      autoSaveQueue.stop();
      return;
    }

    cloudSyncService.start();
    autoSaveQueue.start();

    // ── Flush on tab hide ──────────────────────────────────────────────────
    // When the user switches away (mobile background, Alt-Tab, etc.) we flush
    // any pending debounce immediately.  The page is still alive, so a normal
    // async request is fine.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void cloudSyncService.forceSyncNow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── Flush on page unload (keepalive beacon) ────────────────────────────
    // If the debounce timer is pending when the user closes / navigates away,
    // we cancel the timer and immediately POST via fetch keepalive so the
    // request survives page teardown.
    //
    // State is read at event-fire time (not at hook-mount time) to avoid
    // the stale-snapshot race.  See §Non-trivial decisions in the tracking doc.
    const handleBeforeUnload = () => {
      if (!cloudSyncService.hasPendingDebounce()) return;

      // Cancel the timer so it does not fire after we've already sent the beacon
      cloudSyncService.cancelDebounce();

      // Read current store state AT THIS MOMENT
      const { cloudDiagramId, version } = useSyncStore.getState();
      if (!cloudDiagramId) return;

      sendKeepalivePatch(cloudDiagramId, version);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cloudSyncService.stop();
      autoSaveQueue.stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, storageMode, projectId]);
}
