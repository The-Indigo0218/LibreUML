// src/features/cloud/components/CloudDiagramPicker.tsx
//
// Modal that lists the user's cloud projects so they can open one.
// Fetches GET /projects?page=0&size=20, supports load-more pagination.
// On "Open": loads the full project (GET /projects/{id}/full) into local stores.

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Trash2, X, RefreshCw, Layers } from 'lucide-react';
import { listProjects, deleteProject } from '../../../api/projects.api';
import { cloudSyncService } from '../services/cloudSync.service';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { invalidateQuota } from '../hooks/useQuota';
import type { ProjectSummaryResponse, ProjectFullResponse } from '../../../api/types';
import type { LibreUMLProject, SemanticModel, VFSFile, DiagramType } from '../../../core/domain/vfs/vfs.types';
import type { ProjectDiagramType } from '../../../api/types';

function fromApiDiagramType(apiType: ProjectDiagramType): DiagramType {
  const map: Record<ProjectDiagramType, DiagramType> = {
    CLASS:      'CLASS_DIAGRAM',
    USE_CASE:   'USE_CASE_DIAGRAM',
    DOMAIN:     'DOMAIN_MODEL_DIAGRAM',
    SEQUENCE:   'SEQUENCE_DIAGRAM',
    ACTIVITY:   'ACTIVITY_DIAGRAM',
    STATE:      'STATE_MACHINE_DIAGRAM',
    COMPONENT:  'COMPONENT_DIAGRAM',
    DEPLOYMENT: 'DEPLOYMENT_DIAGRAM',
    PACKAGE:    'PACKAGE_DIAGRAM',
    OBJECT:     'OBJECT_DIAGRAM',
    ER:         'ER_DIAGRAM',
    UNSPECIFIED:'UNSPECIFIED',
  };
  return map[apiType] ?? 'UNSPECIFIED';
}

// ── Reconstruct LibreUMLProject from full response ────────────────────────────

function reconstructProject(full: ProjectFullResponse): LibreUMLProject | null {
  const { project, diagrams } = full;

  // Use vfsSnapshot if the backend provides it (preferred)
  if (project.vfsSnapshot) {
    const snapshotProject = project.vfsSnapshot as Partial<LibreUMLProject>;

    // Merge viewData from each diagram into the corresponding VFSFile.content
    const nodes: Record<string, LibreUMLProject['nodes'][string]> = {
      ...(snapshotProject.nodes as Record<string, LibreUMLProject['nodes'][string]> ?? {}),
    };
    for (const diag of diagrams) {
      if (diag.path && nodes[diag.path]?.type === 'FILE') {
        const file = nodes[diag.path] as VFSFile;
        const { _localModel, ...diagramContent } = (diag.viewData ?? {}) as Record<string, unknown>;
        nodes[diag.path] = {
          ...file,
          content: diagramContent,
          ...(file.standalone && _localModel ? { localModel: _localModel as SemanticModel } : {}),
        };
      }
    }

    return {
      id:            project.id,
      projectName:   project.name,
      description:   project.description,
      author:        project.author,
      version:       project.projectVersion,
      targetLanguage: project.targetLanguage,
      basePackage:   project.basePackage,
      domainModelId: (snapshotProject.domainModelId as string | undefined) ?? project.id,
      nodes,
      createdAt:     new Date(project.createdAt).getTime(),
      updatedAt:     new Date(project.updatedAt).getTime(),
    };
  }

  // Fallback: build a flat VFS structure from diagram list (no folder nesting)
  const nodes: Record<string, LibreUMLProject['nodes'][string]> = {};
  for (const diag of diagrams) {
    const vfsId = diag.path || diag.id;
    nodes[vfsId] = {
      id:          vfsId,
      name:        diag.name,
      type:        'FILE',
      parentId:    null,
      diagramType: fromApiDiagramType(diag.diagramType),
      extension:   '.luml',
      isExternal:  false,
      content:     diag.viewData,
      createdAt:   new Date(diag.createdAt).getTime(),
      updatedAt:   new Date(diag.updatedAt).getTime(),
    } satisfies VFSFile;
  }

  return {
    id:            project.id,
    projectName:   project.name,
    description:   project.description,
    author:        project.author,
    version:       project.projectVersion,
    targetLanguage: project.targetLanguage,
    basePackage:   project.basePackage,
    domainModelId: project.id,
    nodes,
    createdAt:     new Date(project.createdAt).getTime(),
    updatedAt:     new Date(project.updatedAt).getTime(),
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

interface CloudDiagramPickerProps {
  isOpen:  boolean;
  onClose: () => void;
}

export default function CloudDiagramPicker({ isOpen, onClose }: CloudDiagramPickerProps) {
  const { t } = useTranslation();
  const loadProject = useVFSStore((s) => s.loadProject);
  const loadModel   = useModelStore((s) => s.loadModel);

  const [projects, setProjects]   = useState<ProjectSummaryResponse[]>([]);
  const [page, setPage]           = useState(0);
  const [isLast, setIsLast]       = useState(true);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listProjects(p, 20);
      setProjects((prev) => replace ? result.content : [...prev, ...result.content]);
      setIsLast(result.isLast);
      setPage(p);
    } catch {
      setError(t('cloud.picker.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) void fetchPage(0, true);
  }, [isOpen, fetchPage]);

  if (!isOpen) return null;

  const handleOpen = async (id: string) => {
    setOpeningId(id);
    const full = await cloudSyncService.loadFromCloud(id);
    setOpeningId(null);

    if (!full) { setError(t('cloud.picker.openError')); return; }

    const fullTyped = full as unknown as ProjectFullResponse;
    const reconstructed = reconstructProject(fullTyped);

    if (reconstructed) {
      loadProject(reconstructed);
      loadModel(fullTyped.model.data as unknown as SemanticModel);
      onClose();
    } else {
      setError(t('cloud.picker.openError'));
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      invalidateQuota();
    } catch {
      setError(t('cloud.picker.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-picker-title"
    >
      <div className="bg-surface-primary border border-surface-border rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <h2 id="cloud-picker-title" className="text-sm font-semibold text-text-primary">
              {t('cloud.picker.title')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchPage(0, true)}
              disabled={loading}
              className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
              aria-label={t('cloud.picker.refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label={t('modals.common.cancel')}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {error && (
            <p className="text-xs text-red-400 px-3 py-2">{error}</p>
          )}

          {!loading && projects.length === 0 && !error && (
            <p className="text-sm text-text-muted px-3 py-6 text-center">
              {t('cloud.picker.empty')}
            </p>
          )}

          <ul className="flex flex-col gap-1">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded hover:bg-surface-hover group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      <Layers className="w-3 h-3" aria-hidden="true" />
                      <span>{p.diagramCount}</span>
                    </div>
                    {p.diagramTypes.length > 0 && (
                      <span className="text-xs text-text-muted">
                        {p.diagramTypes.slice(0, 3).join(' · ')}
                        {p.diagramTypes.length > 3 && ` +${p.diagramTypes.length - 3}`}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => void handleOpen(p.id)}
                    disabled={!!openingId || !!deletingId}
                    className="px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {openingId === p.id ? '…' : t('cloud.picker.open')}
                  </button>
                  <button
                    onClick={() => void handleDelete(p.id)}
                    disabled={!!openingId || !!deletingId}
                    className="p-1 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t('cloud.picker.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        {!isLast && (
          <div className="shrink-0 px-5 py-3 border-t border-surface-border">
            <button
              onClick={() => void fetchPage(page + 1, false)}
              disabled={loading}
              className="w-full py-2 text-xs font-medium text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
            >
              {loading ? t('cloud.picker.loading') : t('cloud.picker.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
