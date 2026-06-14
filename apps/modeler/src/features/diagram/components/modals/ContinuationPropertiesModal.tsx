import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRContinuation } from '../../../../core/domain/vfs/vfs.types';

export default function ContinuationPropertiesModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'continuation-props' && !!editingId;

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

  const getContinuation = (): IRContinuation | null => {
    if (!editingId) return null;
    return getModel()?.continuations?.[editingId] ?? null;
  };

  const [name, setName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const cont = getContinuation();
    if (!cont) return;
    setName(cont.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const cont = getContinuation();
  if (!cont) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch: Partial<IRContinuation> = { name: name.trim() };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateContinuation(editingId, patch);
    } else {
      useModelStore.getState().updateContinuation(editingId, patch);
    }
    closeModals();
  };

  const handleDelete = () => {
    if (!editingId) return;
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).deleteContinuation(editingId);
    } else {
      useModelStore.getState().deleteContinuation(editingId);
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358]">
          <div>
            <p className="text-xs text-[#475569] font-mono italic">continuation</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Continuation</h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Name</label>
          <input
            type="text"
            className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                       text-sm text-[#e2e8f0] placeholder-[#475569]
                       focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
            placeholder="e.g. loggedIn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="mt-1 text-[10px] text-[#475569]">
            Continuations with the same name mark a jump between flows.
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
