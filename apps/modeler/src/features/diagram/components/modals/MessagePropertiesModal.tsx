import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRMessage, IRLifeline, IRClass, IRInterface, MessageKind } from '../../../../core/domain/vfs/vfs.types';

const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  SYNC: 'Synchronous (→)',
  ASYNC: 'Asynchronous (→)',
  REPLY: 'Reply (⇢)',
  CREATE: 'Create (⇢ «create»)',
  DESTROY: 'Destroy (→ ✕)',
};

const EDITABLE_KINDS: MessageKind[] = ['SYNC', 'ASYNC', 'REPLY', 'CREATE', 'DESTROY'];

export default function MessagePropertiesModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'message-props' && !!editingId;

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

  const getMessage = (): IRMessage | null => {
    if (!editingId) return null;
    return getModel()?.messages?.[editingId] ?? null;
  };

  const getLifeline = (id: string): IRLifeline | null =>
    getModel()?.lifelines?.[id] ?? null;

  const getOperations = (lifeline: IRLifeline): Array<{ id: string; name: string }> => {
    if (!lifeline.represents) return [];
    const model = getModel();
    if (!model) return [];
    const classifier =
      (model.classes as Record<string, IRClass>)[lifeline.represents] ??
      (model.interfaces as Record<string, IRInterface>)[lifeline.represents];
    if (!classifier) return [];
    return (classifier.operationIds ?? []).flatMap((opId) => {
      const op = model.operations?.[opId];
      return op ? [{ id: opId, name: op.name }] : [];
    });
  };

  const [name, setName] = useState('');
  const [args, setArgs] = useState('');
  const [messageKind, setMessageKind] = useState<MessageKind>('SYNC');
  const [operationId, setOperationId] = useState<string>('');
  const [availableOps, setAvailableOps] = useState<Array<{ id: string; name: string }>>([]);
  const [inReplyToLabel, setInReplyToLabel] = useState<string | null>(null);
  const [sourceGateId, setSourceGateId] = useState<string>('');
  const [targetGateId, setTargetGateId] = useState<string>('');
  const [gates, setGates] = useState<Array<{ id: string; name: string; side: string }>>([]);

  useEffect(() => {
    if (!isOpen) return;
    const msg = getMessage();
    if (!msg) return;
    setName(msg.name ?? '');
    setArgs(msg.arguments ?? '');
    setMessageKind(msg.messageKind);
    setOperationId(msg.operationId ?? '');
    setSourceGateId(msg.sourceGateId ?? '');
    setTargetGateId(msg.targetGateId ?? '');
    setGates(
      Object.values(getModel()?.gates ?? {}).map((g) => ({ id: g.id, name: g.name || g.id.slice(0, 6), side: g.side })),
    );

    const targetLifeline = getLifeline(msg.targetLifelineId);
    setAvailableOps(targetLifeline ? getOperations(targetLifeline) : []);

    if (msg.inReplyTo) {
      const refMsg = getModel()?.messages?.[msg.inReplyTo];
      setInReplyToLabel(refMsg ? (refMsg.name || `Message #${refMsg.sequenceNumber}`) : msg.inReplyTo);
    } else {
      setInReplyToLabel(null);
    }
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const message = getMessage();
  if (!message) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch: Partial<IRMessage> = {
      name: name.trim(),
      arguments: args.trim() || undefined,
      messageKind,
      operationId: operationId || undefined,
      sourceGateId: sourceGateId || undefined,
      targetGateId: targetGateId || undefined,
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateMessage(editingId, patch);
    } else {
      useModelStore.getState().updateMessage(editingId, patch);
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
        onKeyDown={(e) => e.key === 'Escape' && closeModals()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358]">
          <div>
            <p className="text-xs text-[#475569] font-mono italic">
              {message.messageKind.toLowerCase()}
            </p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Message Properties</h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Name</label>
            <input
              type="text"
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] placeholder-[#475569]
                         focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              placeholder="e.g. fetchUser"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Message Kind */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Kind</label>
            <select
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              value={messageKind}
              onChange={(e) => setMessageKind(e.target.value as MessageKind)}
            >
              {EDITABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MESSAGE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          {/* Operation (only when target lifeline has a classifier with operations) */}
          {availableOps.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Operation</label>
              <select
                className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                           text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
                value={operationId}
                onChange={(e) => setOperationId(e.target.value)}
              >
                <option value="">— none —</option>
                {availableOps.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name}()
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Arguments */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Arguments</label>
            <input
              type="text"
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] placeholder-[#475569]
                         focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              placeholder="e.g. userId, name"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
            />
          </div>

          {/* Gate attachment (UML 2.5 — message crosses a fragment boundary) */}
          {gates.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Source gate</label>
                <select
                  className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-2 py-1.5
                             text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
                  value={sourceGateId}
                  onChange={(e) => setSourceGateId(e.target.value)}
                >
                  <option value="">— lifeline —</option>
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.side})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Target gate</label>
                <select
                  className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-2 py-1.5
                             text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
                  value={targetGateId}
                  onChange={(e) => setTargetGateId(e.target.value)}
                >
                  <option value="">— lifeline —</option>
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.side})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* inReplyTo (display-only) */}
          {inReplyToLabel && (
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Reply to</label>
              <p className="text-xs text-[#64748b] bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5">
                {inReplyToLabel}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 pb-4">
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
