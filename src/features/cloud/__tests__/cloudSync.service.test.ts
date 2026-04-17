// src/features/cloud/__tests__/cloudSync.service.test.ts
//
// Integration tests for CloudSyncService.
// The diagrams API module is mocked (same pattern as auth.store.test.ts) so
// tests verify that CloudSyncService correctly drives useSyncStore transitions
// and calls the right API endpoints with the right arguments.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cloudSyncService } from '../services/cloudSync.service';
import { useSyncStore } from '../../../store/sync.store';
import { useAuthStore } from '../../auth/store/auth.store';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import type { DiagramDetailResponse } from '../../../api/types';
import type { LibreUMLProject } from '../../../core/domain/vfs/vfs.types';

// ── Module mock ───────────────────────────────────────────────────────────────

vi.mock('../../../api/diagrams.api', () => ({
  createDiagram: vi.fn(),
  updateDiagram: vi.fn(),
  getDiagram:    vi.fn(),
  deleteDiagram: vi.fn(),
}));

import * as diagApi from '../../../api/diagrams.api';

// ── Fixtures ──────────────────────────────────────────────────────────────────

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
  id:         'diag-1',
  ownerId:    'user-1',
  title:      'Test Project',
  type:       'CLASS',
  visibility: 'PRIVATE',
  content:    { project: mockProject, model: null },
  version:    1,
  createdAt:  new Date().toISOString(),
  updatedAt:  new Date().toISOString(),
};

// ── Reset helpers ─────────────────────────────────────────────────────────────

function resetStores() {
  useSyncStore.setState({
    cloudDiagramId:           null,
    version:                  0,
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
  useModelStore.setState({ model: null });
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
  it('creates a new cloud diagram and links the project on success', async () => {
    vi.mocked(diagApi.createDiagram).mockResolvedValueOnce(mockResponse);

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(true);
    expect(diagApi.createDiagram).toHaveBeenCalledOnce();

    const { cloudDiagramId, version, storageMode, syncStatus } = useSyncStore.getState();
    expect(cloudDiagramId).toBe('diag-1');
    expect(version).toBe(1);
    expect(storageMode).toBe('cloud');
    expect(syncStatus).toBe('saved');
  });

  it('sends the project name as title', async () => {
    vi.mocked(diagApi.createDiagram).mockResolvedValueOnce(mockResponse);

    await cloudSyncService.saveToCloud();

    const [req] = vi.mocked(diagApi.createDiagram).mock.calls[0];
    expect(req.title).toBe('Test Project');
  });

  it('sets error state when API rejects', async () => {
    vi.mocked(diagApi.createDiagram).mockRejectedValueOnce(new Error('Network error'));

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(false);
    expect(useSyncStore.getState().syncStatus).toBe('error');
  });

  it('returns false without calling the API when no project is open', async () => {
    useVFSStore.setState({ project: null, isLoading: false });

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(false);
    expect(diagApi.createDiagram).not.toHaveBeenCalled();
  });

  it('returns false without calling the API when not authenticated', async () => {
    useAuthStore.setState({ isAuthenticated: false });

    const ok = await cloudSyncService.saveToCloud();

    expect(ok).toBe(false);
    expect(diagApi.createDiagram).not.toHaveBeenCalled();
  });
});

// ── forceSyncNow() — PATCH path ───────────────────────────────────────────────

describe('CloudSyncService.forceSyncNow() — PATCH path', () => {
  beforeEach(() => {
    useSyncStore.setState({
      cloudDiagramId: 'diag-1',
      version:        1,
      storageMode:    'cloud',
    });
  });

  it('sends PATCH and updates version on success', async () => {
    const v2Response = { ...mockResponse, version: 2 };
    vi.mocked(diagApi.updateDiagram).mockResolvedValueOnce(v2Response);

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(true);
    expect(diagApi.updateDiagram).toHaveBeenCalledWith(
      'diag-1',
      expect.objectContaining({ version: 1 }),
    );
    expect(useSyncStore.getState().version).toBe(2);
    expect(useSyncStore.getState().syncStatus).toBe('saved');
  });

  it('includes the current version in the PATCH body (optimistic lock)', async () => {
    useSyncStore.setState({ version: 7 });
    vi.mocked(diagApi.updateDiagram).mockResolvedValueOnce({ ...mockResponse, version: 8 });

    await cloudSyncService.forceSyncNow();

    const [, req] = vi.mocked(diagApi.updateDiagram).mock.calls[0];
    expect(req.version).toBe(7);
  });

  it('sets conflict state and records conflictDetails on HTTP 409', async () => {
    const conflictError = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: { status: 409, data: { version: 5, message: 'Version conflict' } },
    });
    vi.mocked(diagApi.updateDiagram).mockRejectedValueOnce(conflictError);

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    const { syncStatus, conflictDetails } = useSyncStore.getState();
    expect(syncStatus).toBe('conflict');
    expect(conflictDetails).not.toBeNull();
    expect(conflictDetails?.serverVersion).toBe(5);
    expect(conflictDetails?.localPayload).toBeDefined();
  });

  it('sets error state with message on HTTP 422', async () => {
    const quotaError = Object.assign(new Error('Quota exceeded'), {
      isAxiosError: true,
      response: { status: 422, data: { message: 'Storage quota exceeded' } },
    });
    vi.mocked(diagApi.updateDiagram).mockRejectedValueOnce(quotaError);

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    const { syncStatus, error } = useSyncStore.getState();
    expect(syncStatus).toBe('error');
    expect(error).toContain('Storage quota exceeded');
  });

  it('adds to offline queue on network error (no HTTP response)', async () => {
    const networkError = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response:     undefined,
    });
    vi.mocked(diagApi.updateDiagram).mockRejectedValueOnce(networkError);

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    const { syncStatus, offlineQueue } = useSyncStore.getState();
    expect(syncStatus).toBe('offline');
    expect(offlineQueue).toHaveLength(1);
    expect(offlineQueue[0].id).toBe('diag-1');
    expect(offlineQueue[0].attempts).toBe(0);
  });
});

// ── forceSyncNow() — guard conditions ────────────────────────────────────────

describe('CloudSyncService.forceSyncNow() — guard conditions', () => {
  it('skips PATCH when not authenticated', async () => {
    useAuthStore.setState({ isAuthenticated: false });
    useSyncStore.setState({ cloudDiagramId: 'diag-1', storageMode: 'cloud', version: 1 });

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    expect(diagApi.updateDiagram).not.toHaveBeenCalled();
  });

  it('skips PATCH in local storage mode', async () => {
    useSyncStore.setState({ cloudDiagramId: 'diag-1', storageMode: 'local', version: 1 });

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    expect(diagApi.updateDiagram).not.toHaveBeenCalled();
  });

  it('skips PATCH when cloudDiagramId is null', async () => {
    useSyncStore.setState({ cloudDiagramId: null, storageMode: 'cloud', version: 0 });

    const ok = await cloudSyncService.forceSyncNow();

    expect(ok).toBe(false);
    expect(diagApi.updateDiagram).not.toHaveBeenCalled();
  });
});

// ── loadFromCloud() ───────────────────────────────────────────────────────────

describe('CloudSyncService.loadFromCloud()', () => {
  it('fetches diagram, sets the cloud link, and returns content', async () => {
    vi.mocked(diagApi.getDiagram).mockResolvedValueOnce(mockResponse);

    const content = await cloudSyncService.loadFromCloud('diag-1');

    expect(content).not.toBeNull();
    expect((content as Record<string, unknown>)?.project).toBeDefined();
    expect(useSyncStore.getState().cloudDiagramId).toBe('diag-1');
    expect(useSyncStore.getState().version).toBe(1);
  });

  it('returns null when the API rejects', async () => {
    vi.mocked(diagApi.getDiagram).mockRejectedValueOnce(new Error('Not found'));

    const content = await cloudSyncService.loadFromCloud('diag-1');

    expect(content).toBeNull();
  });
});

// ── useSyncStore — state transitions ─────────────────────────────────────────

describe('useSyncStore state transitions', () => {
  it('setCloudDiagram sets cloud mode and stores id + version', () => {
    useSyncStore.getState().setCloudDiagram('abc', 3);

    const { cloudDiagramId, version, storageMode } = useSyncStore.getState();
    expect(cloudDiagramId).toBe('abc');
    expect(version).toBe(3);
    expect(storageMode).toBe('cloud');
  });

  it('clearCloudLink resets everything to local-only', () => {
    useSyncStore.setState({ cloudDiagramId: 'x', version: 5, storageMode: 'cloud' });
    useSyncStore.getState().clearCloudLink();

    const { cloudDiagramId, version, storageMode } = useSyncStore.getState();
    expect(cloudDiagramId).toBeNull();
    expect(version).toBe(0);
    expect(storageMode).toBe('local');
  });

  it('enqueue + dequeue manages the offline queue', () => {
    const item = { id: 'q-1', payload: {}, attempts: 0, lastAttemptAt: Date.now() };
    useSyncStore.getState().enqueue(item);
    expect(useSyncStore.getState().offlineQueue).toHaveLength(1);

    useSyncStore.getState().dequeue('q-1');
    expect(useSyncStore.getState().offlineQueue).toHaveLength(0);
  });

  it('enqueue deduplicates by id', () => {
    const item = { id: 'q-1', payload: {}, attempts: 0, lastAttemptAt: Date.now() };
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
