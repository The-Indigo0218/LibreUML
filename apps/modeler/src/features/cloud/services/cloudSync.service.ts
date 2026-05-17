// src/features/cloud/services/cloudSync.service.ts
//
// CloudSyncService — three independent debounced sync channels.
//
// Channel 1: metadata  — watches project name/description/lang/package + VFS structure
//   → PATCH /projects/{id}
//
// Channel 2: model     — watches model.updatedAt
//   → PATCH /projects/{id}/model
//
// Channel 3: diagrams  — per-VFSFile timer, watches file.updatedAt
//   → POST  /projects/{id}/diagrams   (first time, no cloudId yet)
//   → PATCH /projects/{id}/diagrams/{cloudId}  (subsequent saves)
//
// Initial upload (saveToCloud):
//   POST /projects → PATCH /model → POST /diagrams × N
//   Saves all IDs and versions to useSyncStore.
//
// Conflict handling:
//   409 model     → kind:'model'   → ConflictResolutionDialog shows model diff
//   409 diagram   → kind:'diagram' → ConflictResolutionDialog shows diagram conflict
//   422 quota     → error status, no retry
//   5xx           → autoSaveQueue (exponential backoff)
//   network error → offlineQueue (persisted, retry on window.online)

import axios from 'axios';
import { useVFSStore }   from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { useSyncStore }  from '../../../store/sync.store';
import { useAuthStore }  from '../../auth/store/auth.store';
import { cloudAdapter }  from '../../../adapters/storage/cloud.adapter';
import { canSaveToCloud } from '../utils/payloadSize';
import { invalidateQuota } from '../hooks/useQuota';
import { autoSaveQueue }   from './autoSaveQueue';
import { track } from '../../telemetry/posthog.client';
import type { DiagramType as VfsDiagramType, VFSFile, LibreUMLProject } from '../../../core/domain/vfs/vfs.types';
import type { ProjectDiagramType } from '../../../api/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 30_000;
const MAX_OFFLINE_ATTEMPTS = 3;
const FIVE_MB = 5_242_880;

// ── Diagram type mapping ───────────────────────────────────────────────────────

function toApiDiagramType(vfsType: VfsDiagramType): ProjectDiagramType {
  const map: Record<VfsDiagramType, ProjectDiagramType> = {
    CLASS_DIAGRAM:         'CLASS',
    USE_CASE_DIAGRAM:      'USE_CASE',
    DOMAIN_MODEL_DIAGRAM:  'DOMAIN',
    SEQUENCE_DIAGRAM:      'SEQUENCE',
    ACTIVITY_DIAGRAM:      'ACTIVITY',
    STATE_MACHINE_DIAGRAM: 'STATE',
    COMPONENT_DIAGRAM:     'COMPONENT',
    DEPLOYMENT_DIAGRAM:    'DEPLOYMENT',
    PACKAGE_DIAGRAM:       'PACKAGE',
    OBJECT_DIAGRAM:        'OBJECT',
    ER_DIAGRAM:            'ER',
    UNSPECIFIED:           'UNSPECIFIED',
  };
  return map[vfsType];
}

// ── VFS snapshot builder ───────────────────────────────────────────────────────
// Strips viewData (content) from VFSFile nodes — that lives in the diagrams table.

function buildVfsSnapshot(project: LibreUMLProject): Record<string, unknown> {
  const nodes: Record<string, unknown> = {};
  for (const [id, node] of Object.entries(project.nodes)) {
    if (node.type === 'FILE') {
      const { content, localModel, ...meta } = node as VFSFile;
      void content; void localModel;
      nodes[id] = meta;
    } else {
      nodes[id] = node;
    }
  }
  const { nodes: _nodes, ...projectMeta } = project;
  void _nodes;
  return { ...projectMeta, nodes };
}

// ── Metadata fields that trigger the metadata channel ────────────────────────

function metadataKey(p: LibreUMLProject): string {
  return `${p.projectName}||${p.description ?? ''}||${p.targetLanguage ?? ''}||${p.basePackage ?? ''}||${p.author ?? ''}`;
}

// ── CloudSyncService ──────────────────────────────────────────────────────────

class CloudSyncService {
  private metadataTimer: ReturnType<typeof setTimeout> | null = null;
  private modelTimer:    ReturnType<typeof setTimeout> | null = null;
  private diagramTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private lastMetadataKey = '';
  private lastVfsSnapshot = '';
  private unsubscribers: Array<() => void> = [];
  private isRunning = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Snapshot current state to avoid false-positive triggers on start
    const project = useVFSStore.getState().project;
    if (project) {
      this.lastMetadataKey = metadataKey(project);
      this.lastVfsSnapshot = JSON.stringify(buildVfsSnapshot(project));
    }

    // Channel 1 & 3: VFS store changes
    this.unsubscribers.push(
      useVFSStore.subscribe((state, prev) => {
        const { isAuthenticated } = useAuthStore.getState();
        const { cloudProjectId, storageMode } = useSyncStore.getState();
        if (!isAuthenticated || storageMode !== 'cloud' || !cloudProjectId) return;

        const cur = state.project;
        const pre = prev.project;
        if (!cur || !pre) return;

        // Metadata channel
        const curKey = metadataKey(cur);
        const curSnapshot = JSON.stringify(buildVfsSnapshot(cur));
        if (curKey !== this.lastMetadataKey || curSnapshot !== this.lastVfsSnapshot) {
          this.lastMetadataKey = curKey;
          this.lastVfsSnapshot = curSnapshot;
          this.scheduleMetadataSync();
        }

        // Per-diagram channel: detect changed or new VFSFiles
        for (const [id, node] of Object.entries(cur.nodes)) {
          if (node.type !== 'FILE') continue;
          const prevNode = pre.nodes[id];
          if (!prevNode || prevNode.type !== 'FILE') {
            // New diagram — schedule immediate creation
            this.scheduleDiagramSync(id);
          } else if ((node as VFSFile).updatedAt !== (prevNode as VFSFile).updatedAt) {
            this.scheduleDiagramSync(id);
          }
        }
      }),
    );

    // Channel 2: model store changes
    this.unsubscribers.push(
      useModelStore.subscribe((state, prev) => {
        const { isAuthenticated } = useAuthStore.getState();
        const { cloudProjectId, storageMode } = useSyncStore.getState();
        if (!isAuthenticated || storageMode !== 'cloud' || !cloudProjectId) return;

        if (state.model?.updatedAt !== prev.model?.updatedAt) {
          this.scheduleModelSync();
        }
      }),
    );

    // Retry offline queue when connectivity is restored
    const handleOnline = () => void this.retryOfflineQueue();
    window.addEventListener('online', handleOnline);
    this.unsubscribers.push(() => window.removeEventListener('online', handleOnline));
  }

  stop(): void {
    this.clearMetadataTimer();
    this.clearModelTimer();
    this.diagramTimers.forEach((t) => clearTimeout(t));
    this.diagramTimers.clear();
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    this.isRunning = false;
  }

  // ── Debounce inspection ────────────────────────────────────────────────────

  hasPendingDebounce(): boolean {
    return (
      this.metadataTimer !== null ||
      this.modelTimer !== null ||
      this.diagramTimers.size > 0
    );
  }

  cancelDebounce(): void {
    this.clearMetadataTimer();
    this.clearModelTimer();
    this.diagramTimers.forEach((t) => clearTimeout(t));
    this.diagramTimers.clear();
  }

  // ── Force sync ─────────────────────────────────────────────────────────────

  async forceSyncNow(): Promise<boolean> {
    this.cancelDebounce();
    const results = await Promise.allSettled([
      this.syncMetadata(),
      this.syncModel(),
      ...this.pendingDiagramIds().map((id) => this.syncDiagram(id)),
    ]);
    return results.every((r) => r.status === 'fulfilled' && r.value);
  }

  // ── Initial upload: saveToCloud ────────────────────────────────────────────

  async saveToCloud(): Promise<boolean> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return false;

    const project = useVFSStore.getState().project;
    const model   = useModelStore.getState().model;
    if (!project || !model) return false;

    const quotaResult = canSaveToCloud({ project, model }, 0);
    if (!quotaResult.ok) {
      useSyncStore.getState().setSyncStatus('error', quotaResult.message);
      return false;
    }

    useSyncStore.getState().setSyncStatus('saving');

    try {
      // Step 1: Create project
      const created = await cloudAdapter.createProjectInCloud({
        name:           project.projectName,
        description:    project.description,
        author:         project.author,
        projectVersion: project.version,
        projectKind:    project.projectKind,
        targetLanguage: project.targetLanguage,
        basePackage:    project.basePackage,
        vfsSnapshot:    buildVfsSnapshot(project),
      });

      const projectId = created.id;

      // Step 2: Upload semantic model
      const modelResp = await cloudAdapter.updateModelInCloud(projectId, {
        data:    model as unknown as Record<string, unknown>,
        version: 1,
      });

      // Step 3: Create each VFSFile diagram
      const diagrams: Record<string, { cloudId: string; version: number }> = {};

      for (const [vfsId, node] of Object.entries(project.nodes)) {
        if (node.type !== 'FILE') continue;
        const file = node as VFSFile;
        const diagramResp = await cloudAdapter.createDiagramInCloud(projectId, {
          name:        file.name,
          diagramType: toApiDiagramType(file.diagramType),
          path:        vfsId,
          viewData:    {
            ...(file.content ?? { nodes: [], edges: [] }),
            ...(file.standalone && file.localModel ? { _localModel: file.localModel } : {}),
          } as Record<string, unknown>,
        });
        diagrams[vfsId] = { cloudId: diagramResp.id, version: diagramResp.version };
      }

      useSyncStore.getState().setCloudProject(projectId, created.version, modelResp.version, diagrams);
      useSyncStore.getState().setSyncStatus('saved');
      invalidateQuota();
      track('project_saved_cloud', { trigger: 'manual', diagramCount: Object.keys(diagrams).length });
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const message =
          (err.response?.data as { message?: string })?.message ??
          'Storage quota exceeded. Delete old diagrams to free space.';
        useSyncStore.getState().setSyncStatus('error', message);
      } else {
        const message = extractErrorMessage(err) ?? 'Cloud save failed';
        useSyncStore.getState().setSyncStatus('error', message);
      }
      return false;
    }
  }

  // ── Load full project from cloud ───────────────────────────────────────────

  async loadFromCloud(projectId: string): Promise<Record<string, unknown> | null> {
    try {
      const full = await cloudAdapter.loadProjectFull(projectId);

      // Rebuild cloudDiagrams map for the sync store
      const diagrams: Record<string, { cloudId: string; version: number }> = {};
      for (const d of full.diagrams) {
        // path field stores the VFS UUID (set during upload)
        if (d.path) diagrams[d.path] = { cloudId: d.id, version: d.version };
      }

      useSyncStore.getState().setCloudProject(
        projectId,
        full.project.version,
        full.model.version,
        diagrams,
      );

      return full as unknown as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // ── Private: schedule debounces ────────────────────────────────────────────

  private scheduleMetadataSync(): void {
    this.clearMetadataTimer();
    this.metadataTimer = setTimeout(() => {
      this.metadataTimer = null;
      void this.syncMetadata();
    }, DEBOUNCE_MS);
  }

  private scheduleModelSync(): void {
    this.clearModelTimer();
    this.modelTimer = setTimeout(() => {
      this.modelTimer = null;
      void this.syncModel();
    }, DEBOUNCE_MS);
  }

  private scheduleDiagramSync(vfsFileId: string): void {
    const existing = this.diagramTimers.get(vfsFileId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      this.diagramTimers.delete(vfsFileId);
      void this.syncDiagram(vfsFileId);
    }, DEBOUNCE_MS);
    this.diagramTimers.set(vfsFileId, t);
  }

  private clearMetadataTimer(): void {
    if (this.metadataTimer) { clearTimeout(this.metadataTimer); this.metadataTimer = null; }
  }

  private clearModelTimer(): void {
    if (this.modelTimer) { clearTimeout(this.modelTimer); this.modelTimer = null; }
  }

  private pendingDiagramIds(): string[] {
    return Array.from(this.diagramTimers.keys());
  }

  // ── Private: sync each channel ─────────────────────────────────────────────

  private async syncMetadata(): Promise<boolean> {
    const syncStore = useSyncStore.getState();
    const { cloudProjectId, projectVersion, storageMode } = syncStore;
    if (!this.isActive(cloudProjectId, storageMode)) return false;

    const project = useVFSStore.getState().project;
    if (!project) return false;

    const payload = {
      name:           project.projectName,
      description:    project.description,
      author:         project.author,
      targetLanguage: project.targetLanguage,
      basePackage:    project.basePackage,
      vfsSnapshot:    buildVfsSnapshot(project),
      version:        projectVersion,
    };

    try {
      const response = await cloudAdapter.updateProjectInCloud(cloudProjectId!, payload);
      syncStore.updateProjectVersion(response.version);
      syncStore.setSyncStatus('saved');
      return true;
    } catch (err: unknown) {
      return this.handleSyncError(err, { kind: 'metadata', payload });
    }
  }

  private async syncModel(): Promise<boolean> {
    const syncStore = useSyncStore.getState();
    const { cloudProjectId, modelVersion, storageMode } = syncStore;
    if (!this.isActive(cloudProjectId, storageMode)) return false;

    const model = useModelStore.getState().model;
    if (!model) return false;

    const modelData = model as unknown as Record<string, unknown>;
    const rough = JSON.stringify(modelData).length;
    if (rough > FIVE_MB * 0.95) {
      syncStore.setSyncStatus('error', 'Model exceeds 95% of 5 MB quota.');
      return false;
    }

    syncStore.setSyncStatus('saving');

    try {
      const response = await cloudAdapter.updateModelInCloud(cloudProjectId!, {
        data:    modelData,
        version: modelVersion,
      });
      syncStore.updateModelVersion(response.version);
      syncStore.setSyncStatus('saved');
      invalidateQuota();
      track('model_saved_cloud', { trigger: 'auto' });
      return true;
    } catch (err: unknown) {
      return this.handleSyncError(err, { kind: 'model', payload: { data: modelData, version: modelVersion } });
    }
  }

  private async syncDiagram(vfsFileId: string): Promise<boolean> {
    const syncStore = useSyncStore.getState();
    const { cloudProjectId, cloudDiagrams, storageMode } = syncStore;
    if (!this.isActive(cloudProjectId, storageMode)) return false;

    const project = useVFSStore.getState().project;
    const node = project?.nodes[vfsFileId];
    if (!node || node.type !== 'FILE') return false;

    const file = node as VFSFile;
    const viewData: Record<string, unknown> = {
      ...(file.content ?? { nodes: [], edges: [] }),
      // Standalone diagrams carry their own semantic model in localModel.
      // Embed it in the viewData payload so the backend preserves it.
      ...(file.standalone && file.localModel ? { _localModel: file.localModel } : {}),
    };

    syncStore.setSyncStatus('saving');

    const entry = cloudDiagrams[vfsFileId];

    try {
      if (!entry) {
        // First time syncing this diagram — create it in the backend
        const resp = await cloudAdapter.createDiagramInCloud(cloudProjectId!, {
          name:        file.name,
          diagramType: toApiDiagramType(file.diagramType),
          path:        vfsFileId,
          viewData,
        });
        syncStore.setDiagramCloudEntry(vfsFileId, { cloudId: resp.id, version: resp.version });
      } else {
        const resp = await cloudAdapter.updateDiagramInCloud(
          cloudProjectId!,
          entry.cloudId,
          { viewData, version: entry.version },
        );
        syncStore.updateDiagramVersion(vfsFileId, resp.version);
      }

      syncStore.setSyncStatus('saved');
      invalidateQuota();
      track('diagram_saved_cloud', { trigger: 'auto', diagramType: file.diagramType });
      return true;
    } catch (err: unknown) {
      return this.handleSyncError(err, {
        kind: 'diagram',
        vfsDiagramId: vfsFileId,
        cloudDiagramId: entry?.cloudId ?? '',
        payload: { viewData, version: entry?.version ?? 0 },
      });
    }
  }

  // ── Private: error handling ────────────────────────────────────────────────

  private handleSyncError(
    err: unknown,
    context: {
      kind: 'metadata' | 'model' | 'diagram';
      vfsDiagramId?: string;
      cloudDiagramId?: string;
      payload: Record<string, unknown>;
    },
  ): boolean {
    const syncStore = useSyncStore.getState();
    const { cloudProjectId } = syncStore;
    if (!cloudProjectId) return false;

    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      if (status === 409) {
        const serverVersion: number =
          (err.response?.data as { serverVersion?: number })?.serverVersion ??
          (err.response?.data as { version?: number })?.version ??
          0;

        if (context.kind === 'model') {
          const serverData = (err.response?.data as { serverData?: Record<string, unknown> })?.serverData ?? {};
          syncStore.setConflictDetails({
            kind: 'model',
            serverVersion,
            serverData,
            localPayload: context.payload,
          });
        } else if (context.kind === 'diagram') {
          syncStore.setConflictDetails({
            kind: 'diagram',
            vfsDiagramId:   context.vfsDiagramId!,
            cloudDiagramId: context.cloudDiagramId!,
            serverVersion,
            localPayload: context.payload,
          });
        } else {
          syncStore.setConflictDetails({
            kind: 'metadata',
            serverVersion,
            localPayload: context.payload,
          });
        }
        syncStore.setSyncStatus('conflict');
        return false;
      }

      if (status === 422) {
        const message =
          (err.response?.data as { message?: string })?.message ??
          'Storage quota exceeded. Delete old diagrams to free space.';
        syncStore.setSyncStatus('error', message);
        return false;
      }

      if (status !== undefined && status >= 500) {
        syncStore.setSyncStatus('offline');
        autoSaveQueue.enqueue(cloudProjectId, context.kind, context.vfsDiagramId);
        return false;
      }
    }

    // Network unavailable → offline queue
    syncStore.setSyncStatus('offline');
    syncStore.enqueue({
      id:             `${cloudProjectId}-${context.kind}-${context.vfsDiagramId ?? ''}`,
      kind:           context.kind,
      projectId:      cloudProjectId,
      vfsDiagramId:   context.vfsDiagramId,
      cloudDiagramId: context.cloudDiagramId,
      payload:        context.payload,
      attempts:       0,
      lastAttemptAt:  Date.now(),
    });
    return false;
  }

  // ── Offline queue retry ────────────────────────────────────────────────────

  private async retryOfflineQueue(): Promise<void> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return;

    const { offlineQueue } = useSyncStore.getState();
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
        if (item.kind === 'model') {
          const { modelVersion } = useSyncStore.getState();
          const model = useModelStore.getState().model;
          const resp = await cloudAdapter.updateModelInCloud(item.projectId, {
            data:    model as unknown as Record<string, unknown>,
            version: modelVersion,
          });
          useSyncStore.getState().updateModelVersion(resp.version);
        } else if (item.kind === 'diagram' && item.vfsDiagramId) {
          const { cloudDiagrams } = useSyncStore.getState();
          const entry = cloudDiagrams[item.vfsDiagramId];
          if (!entry) continue;
          const project = useVFSStore.getState().project;
          const file = project?.nodes[item.vfsDiagramId] as VFSFile | undefined;
          if (!file) continue;
          const resp = await cloudAdapter.updateDiagramInCloud(item.projectId, entry.cloudId, {
            viewData: {
              ...(file.content ?? {}),
              ...(file.standalone && file.localModel ? { _localModel: file.localModel } : {}),
            } as Record<string, unknown>,
            version:  entry.version,
          });
          useSyncStore.getState().updateDiagramVersion(item.vfsDiagramId, resp.version);
        }

        useSyncStore.getState().dequeue(item.id);
        useSyncStore.getState().setSyncStatus('saved');
        invalidateQuota();
      } catch {
        useSyncStore.getState().setSyncStatus('offline');
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private isActive(
    cloudProjectId: string | null,
    storageMode: string,
  ): cloudProjectId is string {
    return (
      storageMode === 'cloud' &&
      cloudProjectId !== null &&
      useAuthStore.getState().isAuthenticated
    );
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

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
