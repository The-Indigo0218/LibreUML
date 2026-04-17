// src/features/cloud/components/CloudDiagramPicker.tsx
//
// Paginated modal that lists the user's cloud diagrams so they can open one.
// Fetches GET /diagrams?page=0&size=20, supports load-more pagination.
// On "Open": loads the diagram content into local stores and sets the cloud link.

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Trash2, X, RefreshCw } from 'lucide-react';
import { listDiagrams, deleteDiagram } from '../../../api/diagrams.api';
import { cloudSyncService } from '../services/cloudSync.service';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import type { DiagramSummaryResponse } from '../../../api/types';
import type { LibreUMLProject, SemanticModel } from '../../../core/domain/vfs/vfs.types';
import { invalidateQuota } from '../hooks/useQuota';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CloudContent {
  project: LibreUMLProject;
  model:   SemanticModel;
}

function isCloudContent(v: unknown): v is CloudContent {
  return typeof v === 'object' && v !== null && 'project' in v && 'model' in v;
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

  const [diagrams, setDiagrams]     = useState<DiagramSummaryResponse[]>([]);
  const [page, setPage]             = useState(0);
  const [isLast, setIsLast]         = useState(true);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [openingId, setOpeningId]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDiagrams(p, 20);
      setDiagrams((prev) => replace ? result.content : [...prev, ...result.content]);
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
    const content = await cloudSyncService.loadFromCloud(id);
    setOpeningId(null);

    if (content && isCloudContent(content)) {
      loadProject(content.project);
      loadModel(content.model);
      onClose();
    } else {
      setError(t('cloud.picker.openError'));
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDiagram(id);
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
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

          {!loading && diagrams.length === 0 && !error && (
            <p className="text-sm text-text-muted px-3 py-6 text-center">
              {t('cloud.picker.empty')}
            </p>
          )}

          <ul className="flex flex-col gap-1">
            {diagrams.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded hover:bg-surface-hover group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{d.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {d.type} · {new Date(d.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => void handleOpen(d.id)}
                    disabled={!!openingId || !!deletingId}
                    className="px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {openingId === d.id ? '…' : t('cloud.picker.open')}
                  </button>
                  <button
                    onClick={() => void handleDelete(d.id)}
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
