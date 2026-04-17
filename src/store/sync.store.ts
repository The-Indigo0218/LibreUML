// src/store/sync.store.ts
// Persisted cloud-sync state for the currently open project.
// One entry per workspace session — the cloudDiagramId links the local
// LibreUMLProject to a specific backend /diagrams record.
//
// Lifecycle:
//   local-only  →  "Save to Cloud" → cloudDiagramId set → auto-sync active
//   auto-sync   →  PATCH fires on every 5 s debounce → version increments
//   conflict    →  409 → syncStatus = 'conflict' → ConflictResolutionDialog
//   offline     →  network error → offlineQueue → retry on window.online

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

export interface OfflineQueueItem {
  /** Stable per-item ID for deduplication. */
  id: string;
  /** Serialised project+model payload to retry. */
  payload: Record<string, unknown>;
  attempts: number;
  lastAttemptAt: number;
}

export interface ConflictDetails {
  /** Version the server returned in the 409 body (server's current version). */
  serverVersion: number;
  /** Snapshot of local payload that caused the conflict. */
  localPayload: Record<string, unknown>;
}

interface SyncStoreState {
  // ── Cloud link ─────────────────────────────────────────────────────────────
  /** null = project is local-only; UUID = linked to a backend diagram. */
  cloudDiagramId: string | null;
  /**
   * Optimistic-lock version echoed back by the backend on every successful
   * PATCH. Must be included in the next PATCH body unchanged.
   */
  version: number;
  /** Whether the user has explicitly opted for cloud mode for this project. */
  storageMode: 'local' | 'cloud';

  // ── Sync status ────────────────────────────────────────────────────────────
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  conflictDetails: ConflictDetails | null;

  // ── Offline queue ──────────────────────────────────────────────────────────
  offlineQueue: OfflineQueueItem[];

  // ── Per-project migration flag ─────────────────────────────────────────────
  /**
   * Set of project IDs for which the user has already responded to the
   * "Upload local project?" dialog. Prevents re-showing on every login.
   */
  declinedUploadProjectIds: string[];

  // ── Actions ────────────────────────────────────────────────────────────────
  setCloudDiagram: (id: string, version: number) => void;
  updateVersion: (version: number) => void;
  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  setConflictDetails: (details: ConflictDetails | null) => void;
  clearCloudLink: () => void;
  enterCloudMode: () => void;
  enterLocalMode: () => void;

  enqueue: (item: OfflineQueueItem) => void;
  dequeue: (id: string) => void;
  bumpAttempts: (id: string) => void;

  markDeclinedUpload: (projectId: string) => void;
  hasDeclinedUpload: (projectId: string) => boolean;

  /** Full reset — called on project close or logout. */
  reset: () => void;
}

// ── Default state ──────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  cloudDiagramId: null,
  version: 0,
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

      setCloudDiagram: (id, version) =>
        set({ cloudDiagramId: id, version, storageMode: 'cloud', error: null }),

      updateVersion: (version) => set({ version }),

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
          cloudDiagramId: null,
          version: 0,
          storageMode: 'local',
          syncStatus: 'idle',
          error: null,
          conflictDetails: null,
          offlineQueue: [],
        }),

      enterCloudMode: () => set({ storageMode: 'cloud' }),
      enterLocalMode: () => set({ storageMode: 'local' }),

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
          cloudDiagramId: null,
          version: 0,
          storageMode: 'local',
          syncStatus: 'idle',
          lastSyncedAt: null,
          error: null,
          conflictDetails: null,
          offlineQueue: [],
          // declinedUploadProjectIds is intentionally kept across resets
        }),
    }),
    {
      name: 'libreuml-sync-storage',
      version: 1,
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
      // Transient fields are not persisted — they reset on page reload.
      partialize: (state) => ({
        cloudDiagramId: state.cloudDiagramId,
        version: state.version,
        storageMode: state.storageMode,
        lastSyncedAt: state.lastSyncedAt,
        offlineQueue: state.offlineQueue,
        declinedUploadProjectIds: state.declinedUploadProjectIds,
      }),
    },
  ),
);
