import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRActivity } from '../../../../core/domain/vfs/vfs.types';

/**
 * Activity (diagram-level) properties — the setter half of the
 * activity→use-case trace (ADR-0010). Opened from the canvas background
 * context menu, since an Activity has no node of its own to double-click.
 */
export default function ActivityPropertiesModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'activity-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId &&
    project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as { standalone?: boolean }).standalone === true
  );

  const getModel = () =>
    isStandalone && activeTabId ? getLocalModel(activeTabId) : useModelStore.getState().model;

  const getActivity = (): IRActivity | null => {
    if (!editingId) return null;
    return getModel()?.activities?.[editingId] ?? null;
  };

  const useCases = useMemo(() => {
    if (!isOpen) return [] as Array<{ id: string; name: string }>;
    const model = getModel();
    if (!model) return [];
    return Object.values(model.useCases ?? {})
      .map((uc) => ({ id: uc.id, name: uc.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId, activeTabId]);

  const [realizesUseCaseId, setRealizesUseCaseId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const activity = getActivity();
    setRealizesUseCaseId(activity?.realizesUseCaseId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const activity = getActivity();
  if (!activity) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch = { realizesUseCaseId: realizesUseCaseId || undefined };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateActivity(editingId, patch);
    } else {
      useModelStore.getState().updateActivity(editingId, patch);
    }
    closeModals();
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={closeModals}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeModals();
          if (e.key === 'Enter') handleSave();
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358]">
          <div>
            <p className="text-xs text-[#475569] font-mono italic">realizesUseCaseId</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Activity Properties — {activity.name}</h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Realizes use case</label>
            <select
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              value={realizesUseCaseId}
              onChange={(e) => setRealizesUseCaseId(e.target.value)}
              autoFocus
            >
              <option value="">— none —</option>
              {useCases.map((uc) => (
                <option key={uc.id} value={uc.id}>
                  {uc.name}
                </option>
              ))}
            </select>
            {useCases.length === 0 && (
              <p className="mt-1 text-[10px] text-[#475569]">
                Create a use case somewhere in the project first.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            onClick={closeModals}
            className="px-3 py-1.5 rounded text-xs text-[#64748b] hover:text-[#94a3b8]
                       hover:bg-[#1e2738] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[#7C83FF]
                       hover:bg-[#9499ff] text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
