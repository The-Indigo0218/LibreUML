import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRTimeConstraint, IRMessage } from '../../../../core/domain/vfs/vfs.types';

type End = 'SEND' | 'RECEIVE';

export default function TimeConstraintPropertiesModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'time-constraint-props' && !!editingId;

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

  const getTc = (): IRTimeConstraint | null => {
    if (!editingId) return null;
    return getModel()?.timeConstraints?.[editingId] ?? null;
  };

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

  const [fromMessageId, setFromMessageId] = useState('');
  const [fromEnd, setFromEnd] = useState<End>('RECEIVE');
  const [toMessageId, setToMessageId] = useState('');
  const [toEnd, setToEnd] = useState<End>('RECEIVE');
  const [expression, setExpression] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const tc = getTc();
    if (!tc) return;
    setFromMessageId(tc.fromMessageId);
    setFromEnd(tc.fromEnd);
    setToMessageId(tc.toMessageId ?? '');
    setToEnd(tc.toEnd ?? 'RECEIVE');
    setExpression(tc.expression);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const tc = getTc();
  if (!tc) return null;
  const isDuration = tc.constraintKind === 'DURATION';

  const handleSave = () => {
    if (!editingId) return;
    const patch: Partial<IRTimeConstraint> = {
      fromMessageId,
      fromEnd,
      expression: expression.trim(),
      ...(isDuration ? { toMessageId, toEnd } : {}),
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateTimeConstraint(editingId, patch);
    } else {
      useModelStore.getState().updateTimeConstraint(editingId, patch);
    }
    closeModals();
  };

  const handleDelete = () => {
    if (!editingId) return;
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).deleteTimeConstraint(editingId);
    } else {
      useModelStore.getState().deleteTimeConstraint(editingId);
    }
    closeModals();
  };

  const selectCls =
    'w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5 ' +
    'text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]';
  const endCls =
    'bg-[#0f1623] border border-[#2a3358] rounded px-2 py-1.5 text-sm text-[#e2e8f0] ' +
    'focus:outline-none focus:ring-1 focus:ring-[#7C83FF]';

  const renderAnchor = (
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
        <select className={endCls} value={end} onChange={(e) => setEnd(e.target.value as End)}>
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
            <p className="text-xs text-[#475569] font-mono italic">
              {isDuration ? 'duration' : 'time'}
            </p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              {isDuration ? 'Duration Constraint' : 'Time Constraint'}
            </h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {renderAnchor(
            isDuration ? 'From (start)' : 'At occurrence',
            fromMessageId,
            setFromMessageId,
            fromEnd,
            setFromEnd,
          )}
          {isDuration && renderAnchor('To (end)', toMessageId, setToMessageId, toEnd, setToEnd)}

          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
              Expression
            </label>
            <input
              type="text"
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] placeholder-[#475569]
                         focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              placeholder={isDuration ? 'e.g. 0..3s' : 'e.g. t=now'}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              autoFocus
            />
            <p className="mt-1 text-[10px] text-[#475569]">Rendered between {'{ }'} on the canvas.</p>
          </div>
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
