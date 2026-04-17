// src/features/cloud/services/cloudSync.service.ts
//
// CloudSyncService — orchestrates the debounced cloud auto-save pipeline.
//
// Active when:
//   • user is authenticated (useAuthStore.isAuthenticated === true)
//   • project has a cloud link (useSyncStore.cloudDiagramId !== null)
//
// Pipeline:
//   VFS/Model store mutation
//     → subscribe() fires
//     → 5 s debounce
//     → pre-flight quota check (canSaveToCloud)
//     → PATCH /diagrams/{id} with { content, version }
//     → on success: updateVersion(response.version), setSyncStatus('saved')
//     → on 409:     setSyncStatus('conflict'), setConflictDetails(...)
//     → on 422:     setSyncStatus('error', quotaMessage)
//     → on network: setSyncStatus('offline'), enqueue(item)
//
// Offline queue:
//   Failed saves are queued in useSyncStore.offlineQueue (persisted to
//   localStorage). On window.online the service retries queued items with
//   exponential backoff (max 3 attempts, 2^attempt * 2 s delay).

import axios from 'axios';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { useSyncStore } from '../../../store/sync.store';
import { useAuthStore } from '../../auth/store/auth.store';
import { cloudAdapter } from '../../../adapters/storage/cloud.adapter';
import { canSaveToCloud } from '../utils/payloadSize';
import { invalidateQuota } from '../hooks/useQuota';
import { autoSaveQueue } from './autoSaveQueue';
import type { DiagramType as VfsDiagramType } from '../../../core/domain/vfs/vfs.types';
import type { DiagramType as ApiDiagramType } from '../../../api/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 5_000;
const MAX_OFFLINE_ATTEMPTS = 3;

// ── Type mapping ──────────────────────────────────────────────────────────────

function toApiDiagramType(vfsType: VfsDiagramType): ApiDiagramType {
  const map: Partial<Record<VfsDiagramType, ApiDiagramType>> = {
    CLASS_DIAGRAM:         'CLASS',
    USE_CASE_DIAGRAM:      'USE_CASE',
    SEQUENCE_DIAGRAM:      'SEQUENCE',
    ACTIVITY_DIAGRAM:      'ACTIVITY',
    STATE_MACHINE_DIAGRAM: 'STATE',
    COMPONENT_DIAGRAM:     'COMPONENT',
    DEPLOYMENT_DIAGRAM:    'DEPLOYMENT',
  };
  return map[vfsType] ?? 'CLASS';
}

// ── Serialise local state into the cloud payload ──────────────────────────────

function buildPayload(): Record<string, unknown> {
  const project = useVFSStore.getState().project;
  const model   = useModelStore.getState().model;
  return { project, model };
}

// ── CloudSyncService ──────────────────────────────────────────────────────────

class CloudSyncService {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: Array<() => void> = [];
  private isRunning = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const triggerDebounce = () => {
      const { isAuthenticated } = useAuthStore.getState();
      const { cloudDiagramId, storageMode } = useSyncStore.getState();
      if (!isAuthenticated || storageMode !== 'cloud' || !cloudDiagramId) return;

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => void this.syncNow(), DEBOUNCE_MS);
    };

    // Watch VFS store
    this.unsubscribers.push(
      useVFSStore.subscribe((state, prev) => {
        if (state.project?.updatedAt !== prev.project?.updatedAt) {
          triggerDebounce();
        }
      }),
    );

    // Watch Model store
    this.unsubscribers.push(
      useModelStore.subscribe((state, prev) => {
        if (state.model?.updatedAt !== prev.model?.updatedAt) {
          triggerDebounce();
        }
      }),
    );

    // Retry offline queue when connectivity is restored
    const handleOnline = () => void this.retryOfflineQueue();
    window.addEventListener('online', handleOnline);
    this.unsubscribers.push(() => window.removeEventListener('online', handleOnline));
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    this.isRunning = false;
  }

  // ── Debounce inspection (used by useAutoSave for flush-on-unload) ───────────

  /** Returns true if a debounced save is pending (unsaved local changes). */
  hasPendingDebounce(): boolean {
    return this.debounceTimer !== null;
  }

  /**
   * Cancels any pending debounce without firing.
   * Called by the beforeunload handler before sending a keepalive flush fetch.
   */
  cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // ── Public one-shot save (Ctrl+S, "Save to Cloud" menu item) ───────────────

  /**
   * Immediately cancels any pending debounce and fires a sync.
   * Returns the result of the sync attempt.
   */
  async forceSyncNow(): Promise<boolean> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    return this.syncNow();
  }

  /**
   * Creates a new cloud diagram record and links the current project to it.
   * Called when the user explicitly chooses "Save to Cloud" for the first time
   * (no cloudDiagramId yet).
   */
  async saveToCloud(): Promise<boolean> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return false;

    const project = useVFSStore.getState().project;
    if (!project) return false;

    const payload = buildPayload();
    const quotaResult = canSaveToCloud(payload, useSyncStore.getState().version === 0 ? 0 : 0);

    if (!quotaResult.ok) {
      useSyncStore.getState().setSyncStatus('error', quotaResult.message);
      return false;
    }

    useSyncStore.getState().setSyncStatus('saving');

    try {
      const response = await cloudAdapter.createInCloud(
        project.projectName,
        toApiDiagramType(
          Object.values(project.nodes).find((n) => n.type === 'FILE')
            ? 'CLASS_DIAGRAM'
            : 'CLASS_DIAGRAM',
        ),
        payload,
      );

      useSyncStore.getState().setCloudDiagram(response.id, response.version);
      useSyncStore.getState().setSyncStatus('saved');
      invalidateQuota();
      return true;
    } catch (err: unknown) {
      const message = extractErrorMessage(err) ?? 'Cloud save failed';
      useSyncStore.getState().setSyncStatus('error', message);
      return false;
    }
  }

  /**
   * Loads a diagram from the cloud by ID and applies it to the local stores.
   * Returns the raw DiagramDetailResponse so callers can inspect `content`.
   */
  async loadFromCloud(id: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await cloudAdapter.loadFromCloud(id);
      useSyncStore.getState().setCloudDiagram(response.id, response.version);
      return response.content as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // ── Private sync core ──────────────────────────────────────────────────────

  private async syncNow(): Promise<boolean> {
    const syncStore = useSyncStore.getState();
    const { cloudDiagramId, version, storageMode } = syncStore;
    const { isAuthenticated } = useAuthStore.getState();

    if (!isAuthenticated || storageMode !== 'cloud' || !cloudDiagramId) return false;

    const project = useVFSStore.getState().project;
    if (!project) return false;

    const payload = buildPayload();

    // Pre-flight quota check — use 0 for used bytes; server enforces the real limit.
    // We only block here if the payload itself is clearly too large.
    const FIVE_MB = 5_242_880;
    const rough = JSON.stringify(payload).length;
    if (rough > FIVE_MB * 0.95) {
      syncStore.setSyncStatus('error', 'Payload exceeds 95 % of 5 MB quota. Delete content to continue saving.');
      return false;
    }

    syncStore.setSyncStatus('saving');

    try {
      const response = await cloudAdapter.updateInCloud(
        cloudDiagramId,
        version,
        payload,
        project.projectName,
      );

      useSyncStore.getState().updateVersion(response.version);
      useSyncStore.getState().setSyncStatus('saved');
      invalidateQuota();
      return true;
    } catch (err: unknown) {
      return this.handleSyncError(err, cloudDiagramId, payload);
    }
  }

  private handleSyncError(
    err: unknown,
    cloudDiagramId: string,
    payload: Record<string, unknown>,
  ): boolean {
    const syncStore = useSyncStore.getState();

    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      if (status === 409) {
        // Optimistic lock conflict — server has a newer version.
        // NOT retried: opens the ConflictResolutionDialog.
        const serverVersion: number =
          (err.response?.data as { version?: number })?.version ??
          syncStore.version + 1;

        syncStore.setConflictDetails({ serverVersion, localPayload: payload });
        syncStore.setSyncStatus('conflict');
        return false;
      }

      if (status === 422) {
        // Quota exceeded — user action required, NOT retried.
        const message =
          (err.response?.data as { message?: string })?.message ??
          'Storage quota exceeded. Delete old diagrams to free space.';
        syncStore.setSyncStatus('error', message);
        return false;
      }

      if (status !== undefined && status >= 500 && status < 600) {
        // Transient server error (500/502/503/504) — delegate to autoSaveQueue
        // for exponential-backoff retry (1 s, 2 s, 4 s … 30 s cap).
        // Show 'offline' status while retrying so the user sees we are
        // attempting recovery automatically.
        syncStore.setSyncStatus('offline');
        autoSaveQueue.enqueue(cloudDiagramId);
        return false;
      }
    }

    // No HTTP response (network unavailable) → offline queue.
    // Will be retried when window 'online' event fires.
    syncStore.setSyncStatus('offline');
    syncStore.enqueue({
      id: cloudDiagramId,
      payload,
      attempts: 0,
      lastAttemptAt: Date.now(),
    });
    return false;
  }

  // ── Offline queue retry ────────────────────────────────────────────────────

  private async retryOfflineQueue(): Promise<void> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return;

    const { offlineQueue, cloudDiagramId, version } = useSyncStore.getState();
    if (offlineQueue.length === 0) return;

    for (const item of offlineQueue) {
      if (item.attempts >= MAX_OFFLINE_ATTEMPTS) {
        useSyncStore.getState().dequeue(item.id);
        continue;
      }

      const delay = Math.pow(2, item.attempts) * 2_000;
      if (Date.now() - item.lastAttemptAt < delay) continue;

      useSyncStore.getState().bumpAttempts(item.id);
      useSyncStore.getState().setSyncStatus('saving');

      try {
        const targetId = item.id !== cloudDiagramId ? cloudDiagramId : item.id;
        if (!targetId) continue;

        const response = await cloudAdapter.updateInCloud(
          targetId,
          version,
          item.payload,
        );
        useSyncStore.getState().updateVersion(response.version);
        useSyncStore.getState().dequeue(item.id);
        useSyncStore.getState().setSyncStatus('saved');
        invalidateQuota();
      } catch {
        useSyncStore.getState().setSyncStatus('offline');
      }
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────
// One service instance for the app lifetime. Start/stop called by
// useCloudSync hook based on auth + storageMode state.

export const cloudSyncService = new CloudSyncService();

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message ?? err.message ?? null;
  }
  if (err instanceof Error) return err.message;
  return null;
}
