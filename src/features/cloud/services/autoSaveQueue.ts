// src/features/cloud/services/autoSaveQueue.ts
//
// AutoSaveQueue — exponential-backoff retry queue for transient HTTP 5xx errors.
//
// Distinct from the "offline queue" in useSyncStore (which handles
// no-network scenarios and retries on window.online). This queue handles
// cases where the server is reachable but temporarily failing, and retries
// automatically after a delay, regardless of network state.
//
// Backoff schedule (capped at 30 s):
//   attempt 0 → first retry after  1 s  (2^0 × 1 000 ms)
//   attempt 1 → second retry after 2 s  (2^1 × 1 000 ms)
//   attempt 2 → third retry after  4 s  (2^2 × 1 000 ms)
//   attempt 3 → fourth retry after 8 s  (2^3 × 1 000 ms)
//   …
//   attempt ≥5 → capped at 30 s
//
// Critical invariants:
//   • State is read at fire time via getState() — never captured in a closure
//     at enqueue/schedule time.  This prevents the "timer fires with stale
//     snapshot" race condition (see §Non-trivial decisions in the tracking doc).
//   • 409 conflict is NEVER added here; it is handled immediately by
//     ConflictResolutionDialog.
//   • 422 quota errors are NEVER retried; user action is required.
//   • One queue item per cloudDiagramId — duplicates are ignored.
//   • Exceeding MAX_ATTEMPTS → item is dropped and 'error' status is set.

import axios from 'axios';
import { useVFSStore }   from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { useSyncStore }  from '../../../store/sync.store';
import { useAuthStore }  from '../../auth/store/auth.store';
import { cloudAdapter }  from '../../../adapters/storage/cloud.adapter';
import { invalidateQuota } from '../hooks/useQuota';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS  = 6;        // after this many failures the item is dropped
const BASE_DELAY_MS = 1_000;    // 1 s (first retry)
const MAX_DELAY_MS  = 30_000;   // 30 s cap

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RetryItem {
  /** Unique item ID (cloudDiagramId + timestamp). */
  id: string;
  /** Backend diagram UUID. */
  cloudDiagramId: string;
  /**
   * Number of failed retry attempts completed so far.
   * 0 = no retries yet; scheduleNext() uses backoffMs(attempts) for the delay.
   */
  attempts: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the delay in ms before the next retry attempt. */
export function backoffMs(attempts: number): number {
  return Math.min(Math.pow(2, attempts) * BASE_DELAY_MS, MAX_DELAY_MS);
}

/**
 * Builds the current project + model payload reading from stores at call time.
 *
 * CRITICAL: always call this at the moment the request fires, never in advance.
 * Capturing `project` or `model` at timer-schedule time causes the "stale
 * snapshot" race — the timer fires 1-30 seconds later with outdated content.
 */
function buildCurrentPayload(): Record<string, unknown> {
  return {
    project: useVFSStore.getState().project,
    model:   useModelStore.getState().model,
  };
}

// ── AutoSaveQueue ─────────────────────────────────────────────────────────────

class AutoSaveQueue {
  private queue: RetryItem[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    this.isRunning = true;
    this.scheduleNext();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  // ── Queue management ───────────────────────────────────────────────────────

  /**
   * Adds a retry item for the given diagram.
   * Deduplicates by cloudDiagramId — if an item already exists the call is a
   * no-op (the existing item's next retry will pick up the latest state).
   */
  enqueue(cloudDiagramId: string): void {
    const exists = this.queue.some((i) => i.cloudDiagramId === cloudDiagramId);
    if (exists) return;

    this.queue.push({
      id:             `${cloudDiagramId}-${Date.now()}`,
      cloudDiagramId,
      attempts:       0,
    });

    if (this.isRunning) this.scheduleNext();
  }

  dequeue(cloudDiagramId: string): void {
    this.queue = this.queue.filter((i) => i.cloudDiagramId !== cloudDiagramId);
  }

  get size(): number {
    return this.queue.length;
  }

  // Exposed for tests
  getQueue(): readonly RetryItem[] {
    return this.queue;
  }

  // ── Scheduling ─────────────────────────────────────────────────────────────

  private scheduleNext(): void {
    if (this.timer !== null) return;  // already scheduled
    if (this.queue.length === 0) return;

    const item = this.queue[0];
    const delay = backoffMs(item.attempts);

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.processNext();
    }, delay);
  }

  // ── Core retry ─────────────────────────────────────────────────────────────

  private async processNext(): Promise<void> {
    if (this.queue.length === 0 || !this.isRunning) return;

    const item = this.queue[0];

    // Guard: auth must still be valid
    if (!useAuthStore.getState().isAuthenticated) {
      this.queue = [];
      return;
    }

    // Guard: must still be in cloud mode with a linked diagram
    const { cloudDiagramId: currentId, version, storageMode } =
      useSyncStore.getState();

    if (storageMode !== 'cloud' || !currentId) {
      this.dequeue(item.cloudDiagramId);
      this.scheduleNext();
      return;
    }

    // ─── Read current state at fire time ───
    // Both the payload and the version are read HERE, not at enqueue time.
    // This is the key invariant that prevents stale-snapshot races.
    const payload  = buildCurrentPayload();
    const project  = useVFSStore.getState().project;

    useSyncStore.getState().setSyncStatus('saving');

    try {
      const response = await cloudAdapter.updateInCloud(
        currentId,
        version,          // optimistic-lock version read at fire time
        payload,
        project?.projectName,
      );

      // Success — update version, clear status, dequeue
      useSyncStore.getState().updateVersion(response.version);
      useSyncStore.getState().setSyncStatus('saved');
      invalidateQuota();
      this.dequeue(item.cloudDiagramId);
      this.scheduleNext();
    } catch (err: unknown) {
      this.handleRetryError(err, item);
    }
  }

  private handleRetryError(err: unknown, item: RetryItem): void {
    const syncStore = useSyncStore.getState();

    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      // 409 — version conflict: open dialog, do NOT retry
      if (status === 409) {
        const serverVersion: number =
          (err.response?.data as { version?: number })?.version ??
          syncStore.version + 1;

        syncStore.setConflictDetails({
          serverVersion,
          localPayload: buildCurrentPayload(),
        });
        syncStore.setSyncStatus('conflict');
        this.dequeue(item.cloudDiagramId);
        this.scheduleNext();
        return;
      }

      // 422 — quota exceeded: user action required, do NOT retry
      if (status === 422) {
        const message =
          (err.response?.data as { message?: string })?.message ??
          'Storage quota exceeded. Delete old diagrams to free space.';
        syncStore.setSyncStatus('error', message);
        this.dequeue(item.cloudDiagramId);
        this.scheduleNext();
        return;
      }
    }

    // 5xx or other network-level error — bump attempts and reschedule
    item.attempts += 1;

    if (item.attempts >= MAX_ATTEMPTS) {
      syncStore.setSyncStatus(
        'error',
        'Auto-save failed after multiple retries. Please check your connection.',
      );
      this.dequeue(item.cloudDiagramId);
      this.scheduleNext();
      return;
    }

    // Show 'offline' while retrying so the user knows we are attempting recovery
    syncStore.setSyncStatus('offline');
    this.scheduleNext(); // delay = backoffMs(item.attempts) after the bump
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────
// Shared with CloudSyncService and useAutoSave hook.

export const autoSaveQueue = new AutoSaveQueue();
