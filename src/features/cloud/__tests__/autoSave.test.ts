// src/features/cloud/__tests__/autoSave.test.ts
//
// Unit tests for the auto-save pipeline:
//   • AutoSaveQueue — exponential-backoff retry, 5xx vs 409 vs offline
//   • cloudSync.service debounce — only 1 PATCH after rapid edits
//   • useAutoSave flush behaviors — visibilitychange + beforeunload keepalive
//
// Uses vi.useFakeTimers() throughout so timers are deterministic.

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { autoSaveQueue, backoffMs } from '../services/autoSaveQueue';
import { cloudSyncService }         from '../services/cloudSync.service';
import { useSyncStore }             from '../../../store/sync.store';
import { useAuthStore }             from '../../auth/store/auth.store';
import { useVFSStore }              from '../../../store/project-vfs.store';
import { useModelStore }            from '../../../store/model.store';
import type { DiagramDetailResponse } from '../../../api/types';
import type { LibreUMLProject }       from '../../../core/domain/vfs/vfs.types';

// ── API mock ──────────────────────────────────────────────────────────────────

vi.mock('../../../api/diagrams.api', () => ({
  createDiagram: vi.fn(),
  updateDiagram: vi.fn(),
  getDiagram:    vi.fn(),
  deleteDiagram: vi.fn(),
}));

import * as diagApi from '../../../api/diagrams.api';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DIAG_ID = 'diag-abc';
const VERSION = 3;

const mockProject: LibreUMLProject = {
  id:            'proj-1',
  projectName:   'Test Project',
  version:       '1.0.0',
  domainModelId: 'model-1',
  nodes:         {},
  createdAt:     Date.now(),
  updatedAt:     Date.now(),
};

const mockResponse: DiagramDetailResponse = {
  id:         DIAG_ID,
  ownerId:    'user-1',
  title:      'Test Project',
  type:       'CLASS',
  visibility: 'PRIVATE',
  content:    { project: mockProject, model: null },
  version:    VERSION + 1,
  createdAt:  new Date().toISOString(),
  updatedAt:  new Date().toISOString(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setCloudReady() {
  useAuthStore.setState({
    user:            {
      id: 'user-1', fullName: 'Test User', email: 't@t.com',
      role: 'DEVELOPER', academicDegrees: [], organization: [], stacks: [],
    },
    isAuthenticated: true,
    isLoading:       false,
    isLocalMode:     false,
    error:           null,
  });
  useSyncStore.setState({
    cloudDiagramId:           DIAG_ID,
    version:                  VERSION,
    storageMode:              'cloud',
    syncStatus:               'idle',
    lastSyncedAt:             null,
    error:                    null,
    conflictDetails:          null,
    offlineQueue:             [],
    declinedUploadProjectIds: [],
  });
  useVFSStore.setState({ project: mockProject, isLoading: false });
  useModelStore.setState({ model: null });
}

function make5xxError(status: number) {
  return Object.assign(new Error(`${status}`), {
    isAxiosError: true,
    response:     { status, data: { message: 'Server error' } },
  });
}

function make409Error(serverVersion: number) {
  return Object.assign(new Error('Conflict'), {
    isAxiosError: true,
    response:     { status: 409, data: { version: serverVersion, message: 'Conflict' } },
  });
}

function make422Error() {
  return Object.assign(new Error('Quota'), {
    isAxiosError: true,
    response:     { status: 422, data: { message: 'Storage quota exceeded' } },
  });
}

function makeNetworkError() {
  return Object.assign(new Error('Network Error'), {
    isAxiosError: true,
    response:     undefined,
  });
}

// ── backoffMs utility ─────────────────────────────────────────────────────────

describe('backoffMs()', () => {
  it('attempt 0 → 1 s', () => expect(backoffMs(0)).toBe(1_000));
  it('attempt 1 → 2 s', () => expect(backoffMs(1)).toBe(2_000));
  it('attempt 2 → 4 s', () => expect(backoffMs(2)).toBe(4_000));
  it('attempt 3 → 8 s', () => expect(backoffMs(3)).toBe(8_000));
  it('attempt 4 → 16 s', () => expect(backoffMs(4)).toBe(16_000));
  it('attempt 5 → 30 s (cap)', () => expect(backoffMs(5)).toBe(30_000));
  it('attempt 6 → 30 s (cap)', () => expect(backoffMs(6)).toBe(30_000));
});

// ── AutoSaveQueue — retry with exponential backoff ────────────────────────────

describe('AutoSaveQueue — 5xx exponential backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setCloudReady();
    vi.clearAllMocks();
    autoSaveQueue.stop();
    // Drain internal queue by re-instantiation not possible (singleton); reset via stop+start
  });

  afterEach(() => {
    autoSaveQueue.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries on 500 after 1 s, then 2 s, then 4 s', async () => {
    vi.mocked(diagApi.updateDiagram)
      .mockRejectedValueOnce(make5xxError(500))  // first try → fail
      .mockRejectedValueOnce(make5xxError(503))  // second try → fail
      .mockRejectedValueOnce(make5xxError(502))  // third try → fail
      .mockResolvedValue(mockResponse);           // fourth try → success

    autoSaveQueue.start();
    autoSaveQueue.enqueue(DIAG_ID);

    // ── First attempt fires after 1 s (backoffMs(0))
    await vi.advanceTimersByTimeAsync(1_000);
    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().syncStatus).toBe('offline');

    // ── Second attempt fires after 2 s (backoffMs(1))
    await vi.advanceTimersByTimeAsync(2_000);
    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(2);

    // ── Third attempt fires after 4 s (backoffMs(2))
    await vi.advanceTimersByTimeAsync(4_000);
    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(3);

    // ── Fourth attempt fires after 8 s (backoffMs(3)) — succeeds
    await vi.advanceTimersByTimeAsync(8_000);
    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(4);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
    expect(autoSaveQueue.size).toBe(0);
  });

  it('sets error status and drops item after MAX_ATTEMPTS failures', async () => {
    vi.mocked(diagApi.updateDiagram).mockRejectedValue(make5xxError(500));

    autoSaveQueue.start();
    autoSaveQueue.enqueue(DIAG_ID);

    // Advance through all 6 attempts: 1+2+4+8+16+30 = 61 s total
    for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]) {
      await vi.advanceTimersByTimeAsync(delay);
    }

    expect(useSyncStore.getState().syncStatus).toBe('error');
    expect(autoSaveQueue.size).toBe(0);
  });

  it('deduplicates: enqueueing the same diagram twice adds only one item', () => {
    autoSaveQueue.start();
    autoSaveQueue.enqueue(DIAG_ID);
    autoSaveQueue.enqueue(DIAG_ID);
    expect(autoSaveQueue.size).toBe(1);
  });

  it('reads version from store at fire time, not at enqueue time', async () => {
    vi.mocked(diagApi.updateDiagram).mockResolvedValue(mockResponse);

    // Change version after enqueue but before retry fires
    autoSaveQueue.start();
    autoSaveQueue.enqueue(DIAG_ID);
    useSyncStore.setState({ version: 99 }); // update AFTER enqueue

    await vi.advanceTimersByTimeAsync(1_000);

    // The PATCH should use the current version (99), not the one at enqueue time (3)
    const [, req] = vi.mocked(diagApi.updateDiagram).mock.calls[0];
    expect(req.version).toBe(99);
  });
});

// ── AutoSaveQueue — 409 and 422 are NOT retried ───────────────────────────────

describe('AutoSaveQueue — conflict and quota errors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setCloudReady();
    vi.clearAllMocks();
    autoSaveQueue.stop();
  });

  afterEach(() => {
    autoSaveQueue.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('409 → sets conflict status, drops item, does NOT retry', async () => {
    vi.mocked(diagApi.updateDiagram).mockRejectedValue(make409Error(10));

    autoSaveQueue.start();
    autoSaveQueue.enqueue(DIAG_ID);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(useSyncStore.getState().syncStatus).toBe('conflict');
    expect(useSyncStore.getState().conflictDetails?.serverVersion).toBe(10);
    expect(autoSaveQueue.size).toBe(0);

    // No further retries after another 30 s
    await vi.advanceTimersByTimeAsync(30_000);
    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(1);
  });

  it('422 → sets error status with quota message, drops item, does NOT retry', async () => {
    vi.mocked(diagApi.updateDiagram).mockRejectedValue(make422Error());

    autoSaveQueue.start();
    autoSaveQueue.enqueue(DIAG_ID);

    await vi.advanceTimersByTimeAsync(1_000);

    const { syncStatus, error } = useSyncStore.getState();
    expect(syncStatus).toBe('error');
    expect(error).toContain('quota exceeded');
    expect(autoSaveQueue.size).toBe(0);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(1);
  });
});

// ── CloudSyncService debounce — rapid edits produce 1 PATCH ──────────────────

describe('CloudSyncService debounce', () => {
  const DEBOUNCE = 5_000;

  beforeEach(() => {
    vi.useFakeTimers();
    setCloudReady();
    vi.clearAllMocks();
    cloudSyncService.stop();
  });

  afterEach(() => {
    cloudSyncService.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fires exactly 1 PATCH after 5 s debounce regardless of how many edits', async () => {
    vi.mocked(diagApi.updateDiagram).mockResolvedValue(mockResponse);

    cloudSyncService.start();

    // Simulate 10 rapid VFS mutations
    for (let i = 0; i < 10; i++) {
      useVFSStore.setState({
        project: { ...mockProject, updatedAt: Date.now() + i },
        isLoading: false,
      });
      await vi.advanceTimersByTimeAsync(200); // 200 ms between edits
    }

    // Before the debounce window closes: no PATCH yet
    expect(diagApi.updateDiagram).not.toHaveBeenCalled();

    // Advance past the debounce window
    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
  });

  it('each new edit resets the debounce timer', async () => {
    vi.mocked(diagApi.updateDiagram).mockResolvedValue(mockResponse);

    cloudSyncService.start();

    // Edit → 4.9 s → edit again → only fires after another 5 s
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });
    await vi.advanceTimersByTimeAsync(4_900);
    expect(diagApi.updateDiagram).not.toHaveBeenCalled();

    // Reset the debounce with a new edit
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 2 }, isLoading: false });
    await vi.advanceTimersByTimeAsync(4_900);
    expect(diagApi.updateDiagram).not.toHaveBeenCalled();

    // Now let it fire
    await vi.advanceTimersByTimeAsync(200);
    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(1);
  });

  it('reads version from store at PATCH fire time, not at debounce-schedule time', async () => {
    vi.mocked(diagApi.updateDiagram).mockResolvedValue(mockResponse);

    cloudSyncService.start();

    // Trigger debounce
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    // Change version AFTER scheduling but BEFORE timer fires
    useSyncStore.setState({ version: 42 });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    const [, req] = vi.mocked(diagApi.updateDiagram).mock.calls[0];
    expect(req.version).toBe(42); // must be the version at fire time
  });

  it('5xx during debounce-fired PATCH adds item to autoSaveQueue', async () => {
    vi.mocked(diagApi.updateDiagram).mockRejectedValueOnce(make5xxError(500));

    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(useSyncStore.getState().syncStatus).toBe('offline');
    expect(autoSaveQueue.size).toBe(1);

    // cleanup
    autoSaveQueue.stop();
    // drain queue internals
    autoSaveQueue.dequeue(DIAG_ID);
  });

  it('network error (no response) adds to offline queue, NOT autoSaveQueue', async () => {
    vi.mocked(diagApi.updateDiagram).mockRejectedValueOnce(makeNetworkError());

    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(useSyncStore.getState().syncStatus).toBe('offline');
    expect(useSyncStore.getState().offlineQueue).toHaveLength(1);
    expect(autoSaveQueue.size).toBe(0); // NOT in autoSaveQueue
  });
});

// ── CloudSyncService — hasPendingDebounce / cancelDebounce ───────────────────

describe('CloudSyncService — debounce inspection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setCloudReady();
    vi.clearAllMocks();
    cloudSyncService.stop();
  });

  afterEach(() => {
    cloudSyncService.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('hasPendingDebounce() is false when no edits have been made', () => {
    cloudSyncService.start();
    expect(cloudSyncService.hasPendingDebounce()).toBe(false);
  });

  it('hasPendingDebounce() is true while debounce timer is active', () => {
    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });
    expect(cloudSyncService.hasPendingDebounce()).toBe(true);
  });

  it('cancelDebounce() stops the timer and hasPendingDebounce() returns false', () => {
    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    cloudSyncService.cancelDebounce();

    expect(cloudSyncService.hasPendingDebounce()).toBe(false);
  });

  it('cancelDebounce() prevents the PATCH from firing', async () => {
    vi.mocked(diagApi.updateDiagram).mockResolvedValue(mockResponse);

    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });
    cloudSyncService.cancelDebounce();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(diagApi.updateDiagram).not.toHaveBeenCalled();
  });
});

// ── forceSyncNow — flush-on-demand ────────────────────────────────────────────

describe('CloudSyncService.forceSyncNow() — flush on demand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setCloudReady();
    vi.clearAllMocks();
    cloudSyncService.stop();
  });

  afterEach(() => {
    cloudSyncService.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cancels pending debounce and fires PATCH immediately', async () => {
    vi.mocked(diagApi.updateDiagram).mockResolvedValue(mockResponse);

    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    expect(cloudSyncService.hasPendingDebounce()).toBe(true);
    const result = await cloudSyncService.forceSyncNow();

    expect(result).toBe(true);
    expect(cloudSyncService.hasPendingDebounce()).toBe(false);
    expect(diagApi.updateDiagram).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
  });
});
