import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRCoregion, IRLifeline } from '../../../../core/domain/vfs/vfs.types';

export default function CoregionPropertiesModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'coregion-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId &&
    project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as { standalone?: boolean }).standalone === true
  );

  const getModel = () =>
    isStandalone && activeTabId
      ? getLocalModel(activeTabId)
      : useModelStore.getState().model;

  const getCoregion = (): IRCoregion | null => {
    if (!editingId) return null;
    return getModel()?.coregions?.[editingId] ?? null;
  };

  const lifelines = useMemo(() => {
    const model = getModel();
    return Object.values(model?.lifelines ?? {}).map((ll: IRLifeline) => ({
      id: ll.id,
      label: ll.alias || ll.name || 'Lifeline',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  const messageCount = useMemo(() => {
    return Object.keys(getModel()?.messages ?? {}).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  const [lifelineId, setLifelineId] = useState('');
  const [fromSequence, setFromSequence] = useState(0);
  const [toSequence, setToSequence] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const cr = getCoregion();
    if (!cr) return;
    setLifelineId(cr.lifelineId);
    setFromSequence(cr.fromSequence);
    setToSequence(cr.toSequence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const cr = getCoregion();
  if (!cr) return null;

  const clamp = (n: number) => Math.max(0, Math.min(messageCount, n));

  const handleSave = () => {
    if (!editingId) return;
    const patch: Partial<IRCoregion> = {
      lifelineId,
      fromSequence: clamp(fromSequence),
      toSequence: clamp(toSequence),
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateCoregion(editingId, patch);
    } else {
      useModelStore.getState().updateCoregion(editingId, patch);
    }
    closeModals();
  };

  const handleDelete = () => {
    if (!editingId) return;
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).deleteCoregion(editingId);
    } else {
      useModelStore.getState().deleteCoregion(editingId);
    }
    closeModals();
  };

  const numCls =
    'w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5 ' +
    'text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]';

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
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358]">
          <div>
            <p className="text-xs text-[#475569] font-mono italic">[ ] unordered</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Coregion</h2>
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
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Lifeline</label>
            <select className={numCls} value={lifelineId} onChange={(e) => setLifelineId(e.target.value)}>
              <option value="">— lifeline —</option>
              {lifelines.map((ll) => (
                <option key={ll.id} value={ll.id}>
                  {ll.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">From slot</label>
              <input
                type="number"
                min={0}
                max={messageCount}
                className={numCls}
                value={fromSequence}
                onChange={(e) => setFromSequence(Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">To slot</label>
              <input
                type="number"
                min={0}
                max={messageCount}
                className={numCls}
                value={toSequence}
                onChange={(e) => setToSequence(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-[10px] text-[#475569]">
            Brackets the lifeline between two message boundaries (0 = top). {messageCount} message(s).
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 pb-4">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-[#64748b]
                       hover:text-red-400 hover:bg-[#1e2738] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <div className="flex gap-2">
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
    </div>
  );

  return createPortal(modal, document.body);
}
