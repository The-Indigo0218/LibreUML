// src/features/cloud/__tests__/cloudSync.service.test.ts
//
// Unit tests for cloudSync.service against the project-centric cloud adapter
// (createProjectInCloud, updateModelInCloud, createDiagramInCloud,
// updateDiagramInCloud, loadProjectFull). The legacy diagram-centric API
// (diagApi.createDiagram / updateDiagram) is no longer used here.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cloudSyncService } from '../services/cloudSync.service';
import { useSyncStore } from '../../../store/sync.store';
import { useAuthStore } from '../../auth/store/auth.store';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import type { OfflineQueueItem } from '../../../store/sync.store';
import type { LibreUMLProject, SemanticModel } from '../../../core/domain/vfs/vfs.types';

// ── Module mocks ──────────────────────────────────────────────────────────────
//
// We mock the cloud adapter wholesale. Every test stubs the adapter methods
// it touches via `vi.mocked(cloudAdapter.<method>).mockResolvedValueOnce(...)`.

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

// invalidateQuota touches React Query state; in tests we don't have a client,
// so silence the call and avoid a noisy console.warn.
vi.mock('../hooks/useQuota', () => ({
  invalidateQuota: vi.fn(),
  useQuota:        vi.fn(),
}));

vi.mock('../../telemetry/posthog.client', () => ({
  track: vi.fn(),
}));

import { cloudAdapter } from '../../../adapters/storage/cloud.adapter';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const emptyModel: SemanticModel = {
  id:              'model-1',
  name:            'Domain Model',
  version:         '1.0.0',
  packages:        {},
  classes:         {},
  interfaces:      {},
  enums:           {},
  dataTypes:       {},
  attributes:      {},
  operations:      {},
  actors:          {},
  useCases:        {},
  activityNodes:   {},
  objectInstances: {},
  components:      {},
  nodes:           {},
  artifacts:       {},
  relations:       {},
  createdAt:       Date.now(),
  updatedAt:       Date.now(),
};

const mockProject: LibreUMLProject = {
  id:            'proj-local-1',
  projectName:   'Test Project',
  version:       '1.0.0',
  description:   'Test description',
  author:        'Tester',
  targetLanguage:'Java',
  basePackage:   'com.test',
  domainModelId: 'model-1',
  nodes:         {},
  createdAt:     Date.now(),
  updatedAt:     Date.now(),
};

const isoNow = () => new Date().toISOString();

// ── Reset helpers ─────────────────────────────────────────────────────────────

function resetStores() {
  useSyncStore.setState({
    cloudProjectId:           null,
    projectVersion:           0,
    modelVersion:             0,
    cloudDiagrams:            {},
    legacyCloudDiagramId:     null,
    storageMode:              'local',
    syncStatus:               'idle',
    lastSyncedAt:             null,
    error:                    null,
    conflictDetails:          null,
    offlineQueue:             [],
    declinedUploadProjectIds: [],
  });
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
  useVFSStore.setState({ project: mockProject, isLoading: false });
  useModelStore.setState({ model: emptyModel });
}

beforeEach(() => {
  resetStores();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── saveToCloud() ─────────────────────────────────────────────────────────────

describe('CloudSyncService.saveToCloud()', () => {
  it('creates project, uploads model, and switches to cloud mode on success', async () => {
    vi.mocked(cloudAdapter.createProjectInCloud).mockResolvedValueOnce({
      id: 'cloud-proj-1', modelId: 'cloud-model-1', version: 1, createdAt: isoNow(),
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockResolvedValueOnce({
      id: 'cloud-model-1', version: 1, updatedAt: isoNow(),
    });

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(true);
    expect(cloudAdapter.createProjectInCloud).toHaveBeenCalledOnce();
    expect(cloudAdapter.updateModelInCloud).toHaveBeenCalledOnce();

    const { cloudProjectId, modelVersion, storageMode, syncStatus } = useSyncStore.getState();
    expect(cloudProjectId).toBe('cloud-proj-1');
    expect(modelVersion).toBe(1);
    expect(storageMode).toBe('cloud');
    expect(syncStatus).toBe('saved');
  });

  it('sends the project metadata in the createProject payload', async () => {
    vi.mocked(cloudAdapter.createProjectInCloud).mockResolvedValueOnce({
      id: 'cloud-proj-1', modelId: 'cloud-model-1', version: 1, createdAt: isoNow(),
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockResolvedValueOnce({
      id: 'cloud-model-1', version: 1, updatedAt: isoNow(),
    });

    await cloudSyncService.saveToCloud();

    const [req] = vi.mocked(cloudAdapter.createProjectInCloud).mock.calls[0];
    expect(req.name).toBe('Test Project');
    expect(req.description).toBe('Test description');
    expect(req.author).toBe('Tester');
    expect(req.targetLanguage).toBe('Java');
    expect(req.basePackage).toBe('com.test');
    expect(req.vfsSnapshot).toBeDefined();
  });

  it('uploads the semantic model with version 0 on first save', async () => {
    vi.mocked(cloudAdapter.createProjectInCloud).mockResolvedValueOnce({
      id: 'cloud-proj-1', modelId: 'cloud-model-1', version: 1, createdAt: isoNow(),
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockResolvedValueOnce({
      id: 'cloud-model-1', version: 1, updatedAt: isoNow(),
    });

    await cloudSyncService.saveToCloud();

    const [projectId, req] = vi.mocked(cloudAdapter.updateModelInCloud).mock.calls[0];
    expect(projectId).toBe('cloud-proj-1');
    // The backend creates the empty model at version 0; the first update must send 0.
    expect(req.version).toBe(0);
    expect(req.data).toBeDefined();
  });

  it('sets error state when createProject rejects', async () => {
    vi.mocked(cloudAdapter.createProjectInCloud).mockRejectedValueOnce(
      new Error('Network error'),
    );

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(false);
    expect(useSyncStore.getState().syncStatus).toBe('error');
    expect(useSyncStore.getState().error).toBeTruthy();
  });

  it('sets quota-specific error message on HTTP 422', async () => {
    const quotaErr = Object.assign(new Error('Quota'), {
      isAxiosError: true,
      response:     { status: 422, data: { message: 'Storage quota exceeded' } },
    });
    vi.mocked(cloudAdapter.createProjectInCloud).mockRejectedValueOnce(quotaErr);

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(false);
    expect(useSyncStore.getState().syncStatus).toBe('error');
    expect(useSyncStore.getState().error).toContain('Storage quota exceeded');
  });

  it('returns false without calling the API when no project is open', async () => {
    useVFSStore.setState({ project: null, isLoading: false });

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(false);
    expect(cloudAdapter.createProjectInCloud).not.toHaveBeenCalled();
  });

  it('returns false without calling the API when no model is loaded', async () => {
    useModelStore.setState({ model: null });

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(false);
    expect(cloudAdapter.createProjectInCloud).not.toHaveBeenCalled();
  });

  it('returns false without calling the API when not authenticated', async () => {
    useAuthStore.setState({ isAuthenticated: false });

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(false);
    expect(cloudAdapter.createProjectInCloud).not.toHaveBeenCalled();
  });
});

// ── forceSyncNow() — PATCH path ───────────────────────────────────────────────

describe('CloudSyncService.forceSyncNow() — model channel', () => {
  beforeEach(() => {
    useSyncStore.setState({
      cloudProjectId: 'cloud-proj-1',
      projectVersion: 1,
      modelVersion:   1,
      cloudDiagrams:  {},
      storageMode:    'cloud',
    });
  });

  it('PATCHes the model and bumps modelVersion on success', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValueOnce({
      id: 'cloud-proj-1', version: 2, updatedAt: isoNow(),
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockResolvedValueOnce({
      id: 'cloud-model-1', version: 2, updatedAt: isoNow(),
    });

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(true);
    expect(cloudAdapter.updateModelInCloud).toHaveBeenCalledWith(
      'cloud-proj-1',
      expect.objectContaining({ version: 1 }),
    );
    expect(useSyncStore.getState().modelVersion).toBe(2);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
  });

  it('sends the local modelVersion in the PATCH body (optimistic lock)', async () => {
    useSyncStore.setState({ modelVersion: 7 });
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValueOnce({
      id: 'cloud-proj-1', version: 2, updatedAt: isoNow(),
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockResolvedValueOnce({
      id: 'cloud-model-1', version: 8, updatedAt: isoNow(),
    });

    await cloudSyncService.forceSyncNow();

    const [, req] = vi.mocked(cloudAdapter.updateModelInCloud).mock.calls[0];
    expect(req.version).toBe(7);
  });

  it('sets conflict state with serverVersion and localPayload on HTTP 409 for the model', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValueOnce({
      id: 'cloud-proj-1', version: 2, updatedAt: isoNow(),
    });
    const conflictErr = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: {
        status: 409,
        data: { version: 5, serverVersion: 5, serverData: { foo: 'bar' } },
      },
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockRejectedValueOnce(conflictErr);

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    const { syncStatus, conflictDetails } = useSyncStore.getState();
    expect(syncStatus).toBe('conflict');
    expect(conflictDetails).not.toBeNull();
    expect(conflictDetails?.kind).toBe('model');
    expect(conflictDetails?.serverVersion).toBe(5);
    expect(conflictDetails?.localPayload).toBeDefined();
  });

  it('sets quota-specific error on HTTP 422 for the model', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValueOnce({
      id: 'cloud-proj-1', version: 2, updatedAt: isoNow(),
    });
    const quotaErr = Object.assign(new Error('Quota'), {
      isAxiosError: true,
      response: { status: 422, data: { message: 'Storage quota exceeded' } },
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockRejectedValueOnce(quotaErr);

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    const { syncStatus, error } = useSyncStore.getState();
    expect(syncStatus).toBe('error');
    expect(error).toContain('Storage quota exceeded');
  });

  it('pushes to offlineQueue on a network error (no HTTP response)', async () => {
    vi.mocked(cloudAdapter.updateProjectInCloud).mockResolvedValueOnce({
      id: 'cloud-proj-1', version: 2, updatedAt: isoNow(),
    });
    const networkErr = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response:     undefined,
    });
    vi.mocked(cloudAdapter.updateModelInCloud).mockRejectedValueOnce(networkErr);

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    const { syncStatus, offlineQueue } = useSyncStore.getState();
    expect(syncStatus).toBe('offline');
    expect(offlineQueue).toHaveLength(1);
    expect(offlineQueue[0].kind).toBe('model');
    expect(offlineQueue[0].projectId).toBe('cloud-proj-1');
    expect(offlineQueue[0].attempts).toBe(0);
  });
});

// ── forceSyncNow() — guard conditions ────────────────────────────────────────

describe('CloudSyncService.forceSyncNow() — guard conditions', () => {
  it('skips PATCH when not authenticated', async () => {
    useAuthStore.setState({ isAuthenticated: false });
    useSyncStore.setState({ cloudProjectId: 'cloud-proj-1', storageMode: 'cloud', modelVersion: 1 });

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    expect(cloudAdapter.updateModelInCloud).not.toHaveBeenCalled();
  });

  it('skips PATCH in local storage mode', async () => {
    useSyncStore.setState({ cloudProjectId: 'cloud-proj-1', storageMode: 'local', modelVersion: 1 });

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    expect(cloudAdapter.updateModelInCloud).not.toHaveBeenCalled();
  });

  it('skips PATCH when cloudProjectId is null', async () => {
    useSyncStore.setState({ cloudProjectId: null, storageMode: 'cloud', modelVersion: 0 });

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    expect(cloudAdapter.updateModelInCloud).not.toHaveBeenCalled();
  });
});

// ── loadFromCloud() ───────────────────────────────────────────────────────────

describe('CloudSyncService.loadFromCloud()', () => {
  it('fetches the full project, sets cloud link, and returns the payload', async () => {
    vi.mocked(cloudAdapter.loadProjectFull).mockResolvedValueOnce({
      project: {
        id: 'cloud-proj-1',
        name: 'Test Project',
        projectVersion: '1.0.0',
        visibility: 'PRIVATE',
        version: 4,
        vfsSnapshot: {},
        diagrams: [],
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
      model: {
        id: 'cloud-model-1',
        projectId: 'cloud-proj-1',
        data: {},
        version: 9,
        updatedAt: isoNow(),
      },
      diagrams: [
        {
          id: 'cloud-diag-1',
          projectId: 'cloud-proj-1',
          name: 'Main.luml',
          diagramType: 'CLASS',
          path: 'vfs-file-uuid-1',
          viewData: { nodes: [], edges: [] },
          version: 2,
          createdAt: isoNow(),
          updatedAt: isoNow(),
        },
      ],
    });

    const content = await cloudSyncService.loadFromCloud('cloud-proj-1');

    expect(content).not.toBeNull();
    expect((content as Record<string, unknown>)?.project).toBeDefined();

    const { cloudProjectId, projectVersion, modelVersion, cloudDiagrams } = useSyncStore.getState();
    expect(cloudProjectId).toBe('cloud-proj-1');
    expect(projectVersion).toBe(4);
    expect(modelVersion).toBe(9);
    expect(cloudDiagrams['vfs-file-uuid-1']).toEqual({ cloudId: 'cloud-diag-1', version: 2 });
  });

  it('returns null when the adapter throws', async () => {
    vi.mocked(cloudAdapter.loadProjectFull).mockRejectedValueOnce(new Error('Not found'));

    const content = await cloudSyncService.loadFromCloud('cloud-proj-1');

    expect(content).toBeNull();
  });
});

// ── useSyncStore — state transitions ─────────────────────────────────────────

describe('useSyncStore state transitions', () => {
  it('setCloudProject sets cloud mode and stores id + versions', () => {
    useSyncStore.getState().setCloudProject('abc', 3, 3, {});

    const { cloudProjectId, modelVersion, storageMode } = useSyncStore.getState();
    expect(cloudProjectId).toBe('abc');
    expect(modelVersion).toBe(3);
    expect(storageMode).toBe('cloud');
  });

  it('clearCloudLink resets everything to local-only', () => {
    useSyncStore.setState({ cloudProjectId: 'x', modelVersion: 5, storageMode: 'cloud' });
    useSyncStore.getState().clearCloudLink();

    const { cloudProjectId, modelVersion, storageMode } = useSyncStore.getState();
    expect(cloudProjectId).toBeNull();
    expect(modelVersion).toBe(0);
    expect(storageMode).toBe('local');
  });

  it('enqueue + dequeue manages the offline queue', () => {
    const item: OfflineQueueItem = { id: 'q-1', kind: 'model', projectId: 'proj-1', payload: {}, attempts: 0, lastAttemptAt: Date.now() };
    useSyncStore.getState().enqueue(item);
    expect(useSyncStore.getState().offlineQueue).toHaveLength(1);

    useSyncStore.getState().dequeue('q-1');
    expect(useSyncStore.getState().offlineQueue).toHaveLength(0);
  });

  it('enqueue deduplicates by id', () => {
    const item: OfflineQueueItem = { id: 'q-1', kind: 'model', projectId: 'proj-1', payload: {}, attempts: 0, lastAttemptAt: Date.now() };
    useSyncStore.getState().enqueue(item);
    useSyncStore.getState().enqueue({ ...item, attempts: 1 });

    expect(useSyncStore.getState().offlineQueue).toHaveLength(1);
    expect(useSyncStore.getState().offlineQueue[0].attempts).toBe(1);
  });

  it('markDeclinedUpload is idempotent', () => {
    useSyncStore.getState().markDeclinedUpload('proj-1');
    useSyncStore.getState().markDeclinedUpload('proj-1');

    expect(useSyncStore.getState().declinedUploadProjectIds).toHaveLength(1);
  });

  it('setSyncStatus "saved" records lastSyncedAt', () => {
    useSyncStore.getState().setSyncStatus('saved');

    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
    expect(useSyncStore.getState().syncStatus).toBe('saved');
  });
});
