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

vi.mock('../../../api/projects.api', () => ({
  createProject:       vi.fn(),
  updateProject:      vi.fn(),
  updateProjectModel: vi.fn(),
  getProjectFull:     vi.fn(),
  deleteProject:      vi.fn(),
  createProjectDiagram:  vi.fn(),
  updateProjectDiagram:   vi.fn(),
  deleteProjectDiagram:   vi.fn(),
}));

vi.mock('../../../adapters/storage/cloud.adapter', () => ({
  cloudAdapter: {
    createProjectInCloud: vi.fn(),
    updateProjectInCloud: vi.fn(),
    loadProjectFull:      vi.fn(),
    updateModelInCloud:   vi.fn(),
    createDiagramInCloud: vi.fn(),
    updateDiagramInCloud: vi.fn(),
  },
}));

// Silence quota/posthog side-effects in tests.
vi.mock('../hooks/useQuota', () => ({
  invalidateQuota: vi.fn(),
  useQuota:        vi.fn(),
}));
vi.mock('../../telemetry/posthog.client', () => ({
  track: vi.fn(),
}));

import * as diagApi from '../../../api/diagrams.api';
import { cloudAdapter } from '../../../adapters/storage/cloud.adapter';

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
    cloudProjectId:           mockProject.id,
    modelVersion:             VERSION,
    cloudDiagrams:            {},
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
    vi.mocked(cloudAdapter.updateModelInCloud)
      .mockRejectedValueOnce(make5xxError(500))
      .mockRejectedValueOnce(make5xxError(503))
      .mockRejectedValueOnce(make5xxError(502))
      .mockResolvedValueOnce({ id: 'mock-id', version: VERSION + 1, updatedAt: '2024-01-01' });

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'model');

    await vi.advanceTimersByTimeAsync(1_000);
    expect(cloudAdapter.updateModelInCloud).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().syncStatus).toBe('offline');

    await vi.advanceTimersByTimeAsync(2_000);
    expect(cloudAdapter.updateModelInCloud).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(cloudAdapter.updateModelInCloud).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(8_000);
    expect(cloudAdapter.updateModelInCloud).toHaveBeenCalledTimes(4);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
    expect(autoSaveQueue.size).toBe(0);
  });

  it('sets error status and drops item after MAX_ATTEMPTS failures', async () => {
    vi.mocked(cloudAdapter.updateModelInCloud).mockRejectedValue(make5xxError(500));

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'model');

    for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]) {
      await vi.advanceTimersByTimeAsync(delay);
    }

    expect(useSyncStore.getState().syncStatus).toBe('error');
    expect(autoSaveQueue.size).toBe(0);
  });

  it('deduplicates: enqueueing the same diagram twice adds only one item', () => {
    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'model');
    autoSaveQueue.enqueue(mockProject.id, 'model');
    expect(autoSaveQueue.size).toBe(1);
  });

  it('reads version from store at fire time, not at enqueue time', async () => {
    vi.mocked(cloudAdapter.updateModelInCloud).mockResolvedValue({ id: 'mock-id', version: 99, updatedAt: '2024-01-01' });

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'model');
    useSyncStore.setState({ modelVersion: 99 });

    await vi.advanceTimersByTimeAsync(1_000);

    const args = vi.mocked(cloudAdapter.updateModelInCloud).mock.calls[0];
    expect(args[1].version).toBe(99);
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
    vi.mocked(cloudAdapter.updateModelInCloud).mockRejectedValue(
      // autoSaveQueue.handleRetryError reads `serverVersion` from response.data,
      // so the conflict payload must use that key.
      Object.assign(new Error('Conflict'), {
        isAxiosError: true,
        response: { status: 409, data: { serverVersion: 10, message: 'Conflict' } },
      }),
    );

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'model');

    await vi.advanceTimersByTimeAsync(1_000);

    expect(useSyncStore.getState().syncStatus).toBe('conflict');
    expect(useSyncStore.getState().conflictDetails?.serverVersion).toBe(10);
    expect(autoSaveQueue.size).toBe(0);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(cloudAdapter.updateModelInCloud).toHaveBeenCalledTimes(1);
  });

  it('422 → sets error status with quota message, drops item, does NOT retry', async () => {
    vi.mocked(cloudAdapter.updateModelInCloud).mockRejectedValue(make422Error());

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'model');

    await vi.advanceTimersByTimeAsync(1_000);

    const { syncStatus, error } = useSyncStore.getState();
    expect(syncStatus).toBe('error');
    expect(error).toContain('quota exceeded');
    expect(autoSaveQueue.size).toBe(0);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(cloudAdapter.updateModelInCloud).toHaveBeenCalledTimes(1);
  });
});

// ── CloudSyncService debounce — rapid edits produce 1 PATCH ──────────────────
//
// The metadata channel (`updateProjectInCloud`) is driven by VFS changes; the
// model channel (`updateModelInCloud`) is driven by useModelStore changes.
// Both share the same 30 s debounce.

describe('CloudSyncService debounce — metadata channel', () => {
  const DEBOUNCE_MS = 30_000;

  beforeEach(() => {
    vi.useFakeTimers();
    setCloudReady();
    vi.clearAllMocks();
    cloudSyncService.stop();
  });

  afterEach(() => {
    cloudSyncService.stop();
    autoSaveQueue.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fires exactly 1 PATCH after the debounce window regardless of how many edits', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValue({
      id: mockProject.id, version: VERSION + 1, updatedAt: '2024-01-01',
    });

    cloudSyncService.start();

    for (let i = 1; i <= 10; i++) {
      useVFSStore.setState({
        project: { ...mockProject, updatedAt: i },
        isLoading: false,
      });
      await vi.advanceTimersByTimeAsync(200);
    }

    expect(cloudAdapter.updateProjectInCloud).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(cloudAdapter.updateProjectInCloud).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
  });

  it('each new edit resets the debounce timer', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValue({
      id: mockProject.id, version: VERSION + 1, updatedAt: '2024-01-01',
    });

    cloudSyncService.start();

    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 100);
    expect(cloudAdapter.updateProjectInCloud).not.toHaveBeenCalled();

    useVFSStore.setState({ project: { ...mockProject, updatedAt: 2 }, isLoading: false });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 100);
    expect(cloudAdapter.updateProjectInCloud).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(cloudAdapter.updateProjectInCloud).toHaveBeenCalledTimes(1);
  });

  it('reads projectVersion from store at PATCH fire time, not at debounce-schedule time', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValue({
      id: mockProject.id, version: 42, updatedAt: '2024-01-01',
    });

    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    // Bump projectVersion AFTER the debounce was scheduled — the PATCH should
    // pick up the latest value, not the value at scheduling time.
    useSyncStore.setState({ projectVersion: 42 });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    const args = vi.mocked(cloudAdapter.updateProjectInCloud).mock.calls[0];
    expect(args[1].version).toBe(42);
  });

  it('5xx during debounce-fired PATCH enqueues a retry in autoSaveQueue', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockRejectedValueOnce(make5xxError(500));

    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(useSyncStore.getState().syncStatus).toBe('offline');
    expect(autoSaveQueue.size).toBe(1);

    autoSaveQueue.stop();
    autoSaveQueue.dequeue(`${mockProject.id}:metadata:`);
  });

  it('network error (no response) pushes to sync-store offline queue, NOT autoSaveQueue', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockRejectedValueOnce(makeNetworkError());

    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(useSyncStore.getState().syncStatus).toBe('offline');
    expect(useSyncStore.getState().offlineQueue).toHaveLength(1);
    expect(useSyncStore.getState().offlineQueue[0].kind).toBe('metadata');
    expect(autoSaveQueue.size).toBe(0);
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

  it('cancels pending debounce and fires both metadata and model PATCHes immediately', async () => {
    // forceSyncNow always runs metadata + model + pending diagrams in parallel,
    // so both channels need a stub even though only metadata had a pending edit.
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValue({
      id: mockProject.id, version: VERSION + 1, updatedAt: '2024-01-01',
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockResolvedValue({
      id: 'cloud-model-1', version: VERSION + 1, updatedAt: '2024-01-01',
    });

    useModelStore.setState({
      model: {
        id: 'cloud-model-1', name: 'Domain Model', version: '1.0.0',
        packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
        attributes: {}, operations: {}, actors: {}, useCases: {},
        activityNodes: {}, objectInstances: {}, components: {}, nodes: {},
        artifacts: {}, relations: {},
        createdAt: Date.now(), updatedAt: Date.now(),
      },
    });

    cloudSyncService.start();
    useVFSStore.setState({ project: { ...mockProject, updatedAt: 1 }, isLoading: false });

    expect(cloudSyncService.hasPendingDebounce()).toBe(true);
    const result = await cloudSyncService.forceSyncNow();

    expect(result).toBe(true);
    expect(cloudSyncService.hasPendingDebounce()).toBe(false);
    expect(cloudAdapter.updateProjectInCloud).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
  });
});

// ── AutoSaveQueue — metadata retry parity ─────────────────────────────────────
//
// The metadata retry path used to send just `name` + the wrong version field
// (modelVersion instead of projectVersion). These tests pin the corrected
// behaviour against cloudSync.service.syncMetadata's payload shape.

describe('AutoSaveQueue — metadata retry payload', () => {
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

  it('sends the full metadata payload (not just name) and projectVersion (not modelVersion)', async () => {
    useSyncStore.setState({ projectVersion: 5, modelVersion: 99 });
    useVFSStore.setState({
      project: {
        ...mockProject,
        description:    'A description',
        author:         'Indigo',
        targetLanguage: 'Java',
        basePackage:    'com.libreuml',
      },
      isLoading: false,
    });
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValueOnce({
      id: mockProject.id, version: 6, updatedAt: '2024-01-01',
    });

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'metadata');

    await vi.advanceTimersByTimeAsync(1_000);

    expect(cloudAdapter.updateProjectInCloud).toHaveBeenCalledTimes(1);
    const [, payload] = vi.mocked(cloudAdapter.updateProjectInCloud).mock.calls[0];
    expect(payload.name).toBe(mockProject.projectName);
    expect(payload.description).toBe('A description');
    expect(payload.author).toBe('Indigo');
    expect(payload.targetLanguage).toBe('Java');
    expect(payload.basePackage).toBe('com.libreuml');
    expect(payload.vfsSnapshot).toBeDefined();
    expect(payload.version).toBe(5); // projectVersion, NOT modelVersion (99)
  });

  it('captures the response and bumps projectVersion on success', async () => {
    useSyncStore.setState({ projectVersion: 5 });
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValueOnce({
      id: mockProject.id, version: 6, updatedAt: '2024-01-01',
    });

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'metadata');

    await vi.advanceTimersByTimeAsync(1_000);

    expect(useSyncStore.getState().projectVersion).toBe(6);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
    expect(autoSaveQueue.size).toBe(0);
  });
});

// ── AutoSaveQueue — 409 handler covers all kinds + parses both shapes ────────

describe('AutoSaveQueue — 409 conflict details', () => {
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

  it('sets conflictDetails of kind "metadata" on a metadata-retry 409 (was previously skipped, leaving the dialog null-guarded)', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockRejectedValueOnce(
      Object.assign(new Error('Conflict'), {
        isAxiosError: true,
        response: { status: 409, data: { serverVersion: 7 } },
      }),
    );

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'metadata');

    await vi.advanceTimersByTimeAsync(1_000);

    const { syncStatus, conflictDetails } = useSyncStore.getState();
    expect(syncStatus).toBe('conflict');
    expect(conflictDetails).not.toBeNull();
    expect(conflictDetails?.kind).toBe('metadata');
    expect(conflictDetails?.serverVersion).toBe(7);
  });

  it('accepts `data.version` as a fallback when `serverVersion` is absent (cloudSync.service parity)', async () => {
    vi.mocked(cloudAdapter.updateModelInCloud).mockRejectedValueOnce(
      Object.assign(new Error('Conflict'), {
        isAxiosError: true,
        response: { status: 409, data: { version: 11 } }, // no serverVersion key
      }),
    );

    autoSaveQueue.start();
    autoSaveQueue.enqueue(mockProject.id, 'model');

    await vi.advanceTimersByTimeAsync(1_000);

    const { conflictDetails } = useSyncStore.getState();
    expect(conflictDetails?.serverVersion).toBe(11); // not 0
  });
});
