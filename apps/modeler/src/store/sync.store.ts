// src/store/sync.store.ts
// Persisted cloud-sync state for the currently open project.
//
// Cloud link uses cloudProjectId (new 3-table architecture):
//   • cloudProjectId    → /projects/{id}
//   • modelVersion      → optimistic lock for PATCH /projects/{id}/model
//   • cloudDiagrams     → per-diagram {cloudId, version} keyed by VFS file UUID
//
// Legacy migration:
//   Store version 1 had cloudDiagramId pointing to the old /diagrams endpoint.
//   On first load after upgrade, legacyCloudDiagramId is set from that value
//   so the migration banner can offer the user a one-time migration flow.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storageAdapter } from '../adapters/storage/storage.adapter';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SyncStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'error'
  | 'conflict'
  | 'offline';

/** Per-diagram cloud link: the backend-assigned UUID and its current version. */
export interface CloudDiagramEntry {
  cloudId: string;
  version: number;
}

export interface OfflineQueueItem {
  /** Stable dedup key. */
  id: string;
  kind: 'metadata' | 'model' | 'diagram';
  projectId: string;
  /** Only present when kind === 'diagram'. VFS file UUID. */
  vfsDiagramId?: string;
  /** Only present when kind === 'diagram'. Backend diagram UUID. */
  cloudDiagramId?: string;
  /** Serialised payload to retry. */
  payload: Record<string, unknown>;
  attempts: number;
  lastAttemptAt: number;
}

export type ConflictDetails =
  | {
      kind: 'metadata';
      serverVersion: number;
      localPayload: Record<string, unknown>;
    }
  | {
      kind: 'model';
      serverVersion: number;
      serverData: Record<string, unknown>;
      localPayload: Record<string, unknown>;
    }
  | {
      kind: 'diagram';
      vfsDiagramId: string;
      cloudDiagramId: string;
      serverVersion: number;
      localPayload: Record<string, unknown>;
    };

interface SyncStoreState {
  // ── Cloud link (new architecture) ──────────────────────────────────────────
  cloudProjectId: string | null;
  projectVersion: number;
  modelVersion: number;
  cloudDiagrams: Record<string, CloudDiagramEntry>;

  // ── Legacy migration ───────────────────────────────────────────────────────
  /** Non-null when the user has an old-format cloud link that needs migration. */
  legacyCloudDiagramId: string | null;

  storageMode: 'local' | 'cloud';

  // ── Sync status ────────────────────────────────────────────────────────────
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  conflictDetails: ConflictDetails | null;

  // ── Offline queue ──────────────────────────────────────────────────────────
  offlineQueue: OfflineQueueItem[];

  // ── Per-project upload declined flag ──────────────────────────────────────
  declinedUploadProjectIds: string[];

  // ── Actions ────────────────────────────────────────────────────────────────
  setCloudProject: (
    projectId: string,
    projectVersion: number,
    modelVersion: number,
    diagrams: Record<string, CloudDiagramEntry>,
  ) => void;

  updateProjectVersion: (version: number) => void;
  updateModelVersion: (version: number) => void;
  setDiagramCloudEntry: (vfsId: string, entry: CloudDiagramEntry) => void;
  updateDiagramVersion: (vfsId: string, version: number) => void;
  removeDiagramCloudEntry: (vfsId: string) => void;

  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  setConflictDetails: (details: ConflictDetails | null) => void;

  clearCloudLink: () => void;
  enterCloudMode: () => void;
  enterLocalMode: () => void;
  clearLegacyLink: () => void;

  enqueue: (item: OfflineQueueItem) => void;
  dequeue: (id: string) => void;
  bumpAttempts: (id: string) => void;

  markDeclinedUpload: (projectId: string) => void;
  hasDeclinedUpload: (projectId: string) => boolean;

  reset: () => void;
}

// ── Default state ──────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  cloudProjectId: null,
  projectVersion: 0,
  modelVersion: 0,
  cloudDiagrams: {} as Record<string, CloudDiagramEntry>,
  legacyCloudDiagramId: null,
  storageMode: 'local' as const,
  syncStatus: 'idle' as SyncStatus,
  lastSyncedAt: null,
  error: null,
  conflictDetails: null,
  offlineQueue: [] as OfflineQueueItem[],
  declinedUploadProjectIds: [] as string[],
};

// ── Store ──────────────────────────────────────────────────────────────────────

export const useSyncStore = create<SyncStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setCloudProject: (projectId, projectVersion, modelVersion, diagrams) =>
        set({
          cloudProjectId: projectId,
          projectVersion,
          modelVersion,
          cloudDiagrams: diagrams,
          storageMode: 'cloud',
          error: null,
          legacyCloudDiagramId: null,
        }),

      updateProjectVersion: (version) => set({ projectVersion: version }),
      updateModelVersion: (version) => set({ modelVersion: version }),

      setDiagramCloudEntry: (vfsId, entry) =>
        set((s) => ({
          cloudDiagrams: { ...s.cloudDiagrams, [vfsId]: entry },
        })),

      updateDiagramVersion: (vfsId, version) =>
        set((s) => {
          const existing = s.cloudDiagrams[vfsId];
          if (!existing) return s;
          return {
            cloudDiagrams: {
              ...s.cloudDiagrams,
              [vfsId]: { ...existing, version },
            },
          };
        }),

      removeDiagramCloudEntry: (vfsId) =>
        set((s) => {
          const next = { ...s.cloudDiagrams };
          delete next[vfsId];
          return { cloudDiagrams: next };
        }),

      setSyncStatus: (status, error = null) =>
        set({
          syncStatus: status,
          error: error ?? null,
          ...(status === 'saved' ? { lastSyncedAt: Date.now() } : {}),
          ...(status !== 'conflict' ? { conflictDetails: null } : {}),
        }),

      setConflictDetails: (details) => set({ conflictDetails: details }),

      clearCloudLink: () =>
        set({
          cloudProjectId: null,
          projectVersion: 0,
          modelVersion: 0,
          cloudDiagrams: {},
          storageMode: 'local',
          syncStatus: 'idle',
          error: null,
          conflictDetails: null,
          offlineQueue: [],
        }),

      enterCloudMode: () => set({ storageMode: 'cloud' }),
      enterLocalMode: () => set({ storageMode: 'local' }),
      clearLegacyLink: () => set({ legacyCloudDiagramId: null }),

      enqueue: (item) =>
        set((s) => ({
          offlineQueue: [
            ...s.offlineQueue.filter((q) => q.id !== item.id),
            item,
          ],
        })),

      dequeue: (id) =>
        set((s) => ({
          offlineQueue: s.offlineQueue.filter((q) => q.id !== id),
        })),

      bumpAttempts: (id) =>
        set((s) => ({
          offlineQueue: s.offlineQueue.map((q) =>
            q.id === id
              ? { ...q, attempts: q.attempts + 1, lastAttemptAt: Date.now() }
              : q,
          ),
        })),

      markDeclinedUpload: (projectId) =>
        set((s) => ({
          declinedUploadProjectIds: s.declinedUploadProjectIds.includes(projectId)
            ? s.declinedUploadProjectIds
            : [...s.declinedUploadProjectIds, projectId],
        })),

      hasDeclinedUpload: (projectId) =>
        get().declinedUploadProjectIds.includes(projectId),

      reset: () =>
        set({
          cloudProjectId: null,
          projectVersion: 0,
          modelVersion: 0,
          cloudDiagrams: {},
          storageMode: 'local',
          syncStatus: 'idle',
          lastSyncedAt: null,
          error: null,
          conflictDetails: null,
          offlineQueue: [],
          // legacyCloudDiagramId and declinedUploadProjectIds survive reset
        }),
    }),
    {
      name: 'libreuml-sync-storage',
      version: 3,
      migrate: (persistedState, fromVersion) => {
        if (fromVersion === 2) {
          return { ...(persistedState as SyncStoreState), projectVersion: 0 };
        }
        if (fromVersion === 1) {
          const old = persistedState as {
            cloudDiagramId?: string | null;
            version?: number;
            storageMode?: 'local' | 'cloud';
            lastSyncedAt?: number | null;
            declinedUploadProjectIds?: string[];
          };
          return {
            ...DEFAULT_STATE,
            storageMode: old.storageMode ?? 'local',
            lastSyncedAt: old.lastSyncedAt ?? null,
            declinedUploadProjectIds: old.declinedUploadProjectIds ?? [],
            // Carry forward the old diagram ID as a legacy migration flag
            legacyCloudDiagramId: old.cloudDiagramId ?? null,
            // If user was in cloud mode, keep them there — they'll see migration banner
            ...(old.storageMode === 'cloud'
              ? { storageMode: 'local' as const }
              : {}),
          } as SyncStoreState;
        }
        return persistedState as SyncStoreState;
      },
      storage: {
        getItem: (name) => {
          const value = storageAdapter.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          storageAdapter.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          storageAdapter.removeItem(name);
        },
      },
      partialize: (state) => ({
        cloudProjectId: state.cloudProjectId,
        projectVersion: state.projectVersion,
        modelVersion: state.modelVersion,
        cloudDiagrams: state.cloudDiagrams,
        legacyCloudDiagramId: state.legacyCloudDiagramId,
        storageMode: state.storageMode,
        lastSyncedAt: state.lastSyncedAt,
        offlineQueue: state.offlineQueue,
        declinedUploadProjectIds: state.declinedUploadProjectIds,
      }) as SyncStoreState,
    },
  ),
);
