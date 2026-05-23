// src/features/cloud/services/autoSaveQueue.ts
//
// AutoSaveQueue — exponential-backoff retry queue for transient HTTP 5xx errors.
//
// Handles three resource kinds: 'metadata', 'model', 'diagram'.
// State is always read at fire time to avoid stale-snapshot races.
//
// Backoff: 2^attempt × 1 s, capped at 30 s.
// Max attempts: 6 before dropping the item and setting 'error' status.

import axios from 'axios';
import { useVFSStore }   from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { useSyncStore }  from '../../../store/sync.store';
import { useAuthStore }  from '../../auth/store/auth.store';
import { cloudAdapter }  from '../../../adapters/storage/cloud.adapter';
import { invalidateQuota } from '../hooks/useQuota';
import { buildVfsSnapshot } from './vfsSnapshot';
import type { VFSFile } from '../../../core/domain/vfs/vfs.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS  = 6;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS  = 30_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RetryItem {
  id: string;
  kind: 'metadata' | 'model' | 'diagram';
  projectId: string;
  vfsDiagramId?: string;
  attempts: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function backoffMs(attempts: number): number {
  return Math.min(Math.pow(2, attempts) * BASE_DELAY_MS, MAX_DELAY_MS);
}

// ── AutoSaveQueue ─────────────────────────────────────────────────────────────

class AutoSaveQueue {
  private queue: RetryItem[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  start(): void {
    this.isRunning = true;
    this.scheduleNext();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  enqueue(
    projectId: string,
    kind: 'metadata' | 'model' | 'diagram' = 'model',
    vfsDiagramId?: string,
  ): void {
    const dedupKey = `${projectId}:${kind}:${vfsDiagramId ?? ''}`;
    const exists = this.queue.some((i) => i.id === dedupKey);
    if (exists) return;

    this.queue.push({ id: dedupKey, kind, projectId, vfsDiagramId, attempts: 0 });
    if (this.isRunning) this.scheduleNext();
  }

  dequeue(id: string): void {
    this.queue = this.queue.filter((i) => i.id !== id);
  }

  get size(): number { return this.queue.length; }
  getQueue(): readonly RetryItem[] { return this.queue; }

  private scheduleNext(): void {
    if (this.timer !== null) return;
    if (this.queue.length === 0) return;
    const item = this.queue[0];
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.processNext();
    }, backoffMs(item.attempts));
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0 || !this.isRunning) return;

    const item = this.queue[0];

    if (!useAuthStore.getState().isAuthenticated) {
      this.queue = [];
      return;
    }

    const { cloudProjectId, storageMode } = useSyncStore.getState();
    if (storageMode !== 'cloud' || !cloudProjectId) {
      this.dequeue(item.id);
      this.scheduleNext();
      return;
    }

    useSyncStore.getState().setSyncStatus('saving');

    try {
      if (item.kind === 'model') {
        const { modelVersion } = useSyncStore.getState();
        const model = useModelStore.getState().model;
        const resp = await cloudAdapter.updateModelInCloud(cloudProjectId, {
          data:    model as unknown as Record<string, unknown>,
          version: modelVersion,
        });
        useSyncStore.getState().updateModelVersion(resp.version);
      } else if (item.kind === 'diagram' && item.vfsDiagramId) {
        const { cloudDiagrams } = useSyncStore.getState();
        const entry = cloudDiagrams[item.vfsDiagramId];
        if (!entry) { this.dequeue(item.id); this.scheduleNext(); return; }
        const file = useVFSStore.getState().project?.nodes[item.vfsDiagramId] as VFSFile | undefined;
        if (!file) { this.dequeue(item.id); this.scheduleNext(); return; }
        const resp = await cloudAdapter.updateDiagramInCloud(cloudProjectId, entry.cloudId, {
          viewData: (file.content ?? {}) as Record<string, unknown>,
          version:  entry.version,
        });
        useSyncStore.getState().updateDiagramVersion(item.vfsDiagramId, resp.version);
      } else if (item.kind === 'metadata') {
        const project = useVFSStore.getState().project;
        if (!project) { this.dequeue(item.id); this.scheduleNext(); return; }
        // Match the full payload shape of cloudSync.service.syncMetadata so a
        // retry doesn't silently drop description/author/lang/basePackage/VFS
        // structure and uses the right version field for the optimistic lock.
        const resp = await cloudAdapter.updateProjectInCloud(cloudProjectId, {
          name:           project.projectName,
          description:    project.description,
          author:         project.author,
          targetLanguage: project.targetLanguage,
          basePackage:    project.basePackage,
          vfsSnapshot:    buildVfsSnapshot(project),
          version:        useSyncStore.getState().projectVersion,
        });
        useSyncStore.getState().updateProjectVersion(resp.version);
      }

      useSyncStore.getState().setSyncStatus('saved');
      invalidateQuota();
      this.dequeue(item.id);
      this.scheduleNext();
    } catch (err: unknown) {
      this.handleRetryError(err, item);
    }
  }

  private handleRetryError(err: unknown, item: RetryItem): void {
    const syncStore = useSyncStore.getState();

    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      if (status === 409) {
        // Conflict — let the ConflictResolutionDialog handle it.
        // Backend may return the server version under either `serverVersion`
        // (cloudSync.service convention) or `version`; accept both.
        const data = err.response?.data as
          | { serverVersion?: number; version?: number; serverData?: Record<string, unknown> }
          | undefined;
        const serverVersion: number = data?.serverVersion ?? data?.version ?? 0;

        if (item.kind === 'model') {
          const serverData = data?.serverData ?? {};
          syncStore.setConflictDetails({
            kind: 'model',
            serverVersion,
            serverData,
            localPayload: {},
          });
        } else if (item.kind === 'diagram') {
          const { cloudDiagrams } = syncStore;
          const entry = item.vfsDiagramId ? cloudDiagrams[item.vfsDiagramId] : undefined;
          syncStore.setConflictDetails({
            kind: 'diagram',
            vfsDiagramId:   item.vfsDiagramId ?? '',
            cloudDiagramId: entry?.cloudId ?? '',
            serverVersion,
            localPayload: {},
          });
        } else {
          // metadata — without these details the ConflictResolutionDialog
          // bails out (it short-circuits on `!conflictDetails`).
          syncStore.setConflictDetails({
            kind: 'metadata',
            serverVersion,
            localPayload: {},
          });
        }
        syncStore.setSyncStatus('conflict');
        this.dequeue(item.id);
        this.scheduleNext();
        return;
      }

      if (status === 422) {
        const message = (err.response?.data as { message?: string })?.message ??
          'Storage quota exceeded.';
        syncStore.setSyncStatus('error', message);
        this.dequeue(item.id);
        this.scheduleNext();
        return;
      }
    }

    item.attempts += 1;
    if (item.attempts >= MAX_ATTEMPTS) {
      syncStore.setSyncStatus('error', 'Auto-save failed after multiple retries.');
      this.dequeue(item.id);
    } else {
      syncStore.setSyncStatus('offline');
    }
    this.scheduleNext();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const autoSaveQueue = new AutoSaveQueue();
