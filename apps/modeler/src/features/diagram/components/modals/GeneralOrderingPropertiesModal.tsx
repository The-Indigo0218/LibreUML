import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRGeneralOrdering, IRMessage } from '../../../../core/domain/vfs/vfs.types';

type End = 'SEND' | 'RECEIVE';

export default function GeneralOrderingPropertiesModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'general-ordering-props' && !!editingId;

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

  const getOrdering = (): IRGeneralOrdering | null => {
    if (!editingId) return null;
    return getModel()?.generalOrderings?.[editingId] ?? null;
  };

  // Messages on the active interaction, ordered, as ordering endpoints.
  const messages = useMemo(() => {
    const model = getModel();
    return Object.values(model?.messages ?? {})
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((m: IRMessage) => ({
        id: m.id,
        label: `${m.sequenceNumber}: ${m.name || m.messageKind.toLowerCase()}`,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  const [beforeMessageId, setBeforeMessageId] = useState('');
  const [beforeEnd, setBeforeEnd] = useState<End>('RECEIVE');
  const [afterMessageId, setAfterMessageId] = useState('');
  const [afterEnd, setAfterEnd] = useState<End>('SEND');

  useEffect(() => {
    if (!isOpen) return;
    const go = getOrdering();
    if (!go) return;
    setBeforeMessageId(go.beforeMessageId);
    setBeforeEnd(go.beforeEnd);
    setAfterMessageId(go.afterMessageId);
    setAfterEnd(go.afterEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const ordering = getOrdering();
  if (!ordering) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch: Partial<IRGeneralOrdering> = {
      beforeMessageId,
      beforeEnd,
      afterMessageId,
      afterEnd,
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateGeneralOrdering(editingId, patch);
    } else {
      useModelStore.getState().updateGeneralOrdering(editingId, patch);
    }
    closeModals();
  };

  const handleDelete = () => {
    if (!editingId) return;
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).deleteGeneralOrdering(editingId);
    } else {
      useModelStore.getState().deleteGeneralOrdering(editingId);
    }
    closeModals();
  };

  const selectCls =
    'w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5 ' +
    'text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]';

  const renderEndpoint = (
    title: string,
    msgId: string,
    setMsg: (v: string) => void,
    end: End,
    setEnd: (v: End) => void,
  ) => (
    <div>
      <label className="block text-xs font-semibold text-[#94a3b8] mb-1">{title}</label>
      <div className="flex gap-2">
        <select className={selectCls} value={msgId} onChange={(e) => setMsg(e.target.value)}>
          <option value="">— message —</option>
          {messages.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          className="bg-[#0f1623] border border-[#2a3358] rounded px-2 py-1.5 text-sm text-[#e2e8f0]
                     focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
          value={end}
          onChange={(e) => setEnd(e.target.value as End)}
        >
          <option value="SEND">send</option>
          <option value="RECEIVE">receive</option>
        </select>
      </div>
    </div>
  );

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
            <p className="text-xs text-[#475569] font-mono italic">before → after</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">General Ordering</h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {renderEndpoint('Before (earlier)', beforeMessageId, setBeforeMessageId, beforeEnd, setBeforeEnd)}
          {renderEndpoint('After (later)', afterMessageId, setAfterMessageId, afterEnd, setAfterEnd)}
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
