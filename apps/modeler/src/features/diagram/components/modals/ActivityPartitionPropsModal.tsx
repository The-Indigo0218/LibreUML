import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRActivityPartition } from '../../../../core/domain/vfs/vfs.types';

/**
 * Swimlane properties — the setter half of the lane→responsible trace
 * (ADR-0010). The display half (the "↗ Name" subtitle) lives in
 * PartitionShape; this is where it gets picked.
 */
export default function ActivityPartitionPropsModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'activity-partition-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId &&
    project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as { standalone?: boolean }).standalone === true
  );

  const getModel = () =>
    isStandalone && activeTabId ? getLocalModel(activeTabId) : useModelStore.getState().model;

  const getPartition = (): IRActivityPartition | null => {
    if (!editingId) return null;
    return getModel()?.activityPartitions?.[editingId] ?? null;
  };

  // Classes and actors are both legal responsible parties (ADR-0010: "class or actor").
  const candidates = useMemo(() => {
    if (!isOpen) return [] as Array<{ id: string; label: string }>;
    const model = getModel();
    if (!model) return [];
    const classes = Object.values(model.classes).map((c) => ({ id: c.id, label: c.name }));
    const actors = Object.values(model.actors ?? {}).map((a) => ({ id: a.id, label: `«actor» ${a.name}` }));
    return [...classes, ...actors].sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId, activeTabId]);

  const [representsId, setRepresentsId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const partition = getPartition();
    setRepresentsId(partition?.representsId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const partition = getPartition();
  if (!partition) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch = { representsId: representsId || undefined };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateActivityPartition(editingId, patch);
    } else {
      useModelStore.getState().updateActivityPartition(editingId, patch);
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
            <p className="text-xs text-[#475569] font-mono italic">representsId</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Lane Properties — {partition.name}</h2>
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
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Responsible class/actor</label>
            <select
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              value={representsId}
              onChange={(e) => setRepresentsId(e.target.value)}
              autoFocus
            >
              <option value="">— none —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="mt-1 text-[10px] text-[#475569]">
                Create a class or an actor somewhere in the project first.
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
