import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRActivityNode } from '../../../../core/domain/vfs/vfs.types';

/**
 * Action / CallOperation properties — the setter half of the action→operation
 * trace (ADR-0010). The display half (the `Class::op()` subtitle) already
 * lives in ActionShape; this is where it gets picked.
 */
export default function ActivityActionPropsModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'activity-action-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId &&
    project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as { standalone?: boolean }).standalone === true
  );

  const getModel = () =>
    isStandalone && activeTabId ? getLocalModel(activeTabId) : useModelStore.getState().model;

  const getNode = (): IRActivityNode | null => {
    if (!editingId) return null;
    return getModel()?.activityNodes?.[editingId] ?? null;
  };

  // Every operation in the model, labelled `Class::op()` / `Interface::op()`
  // — a global list, unlike the sequence Message picker (which scopes to one
  // lifeline's classifier): an action isn't attached to a classifier.
  const operations = useMemo(() => {
    if (!isOpen) return [] as Array<{ id: string; label: string }>;
    const model = getModel();
    if (!model) return [];
    const owners = [...Object.values(model.classes), ...Object.values(model.interfaces)];
    return owners
      .flatMap((owner) =>
        (owner.operationIds ?? []).map((opId) => {
          const op = model.operations?.[opId];
          return op ? { id: opId, label: `${owner.name}::${op.name}()` } : null;
        }),
      )
      .filter((o): o is { id: string; label: string } => o !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId, activeTabId]);

  const [callsOperationId, setCallsOperationId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const node = getNode();
    setCallsOperationId(node?.callsOperationId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const node = getNode();
  if (!node) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch = { callsOperationId: callsOperationId || undefined };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateActivityNode(editingId, patch);
    } else {
      useModelStore.getState().updateActivityNode(editingId, patch);
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
            <p className="text-xs text-[#475569] font-mono italic">callsOperationId</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Action Properties</h2>
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
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Calls operation</label>
            <select
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              value={callsOperationId}
              onChange={(e) => setCallsOperationId(e.target.value)}
              autoFocus
            >
              <option value="">— none —</option>
              {operations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {operations.length === 0 && (
              <p className="mt-1 text-[10px] text-[#475569]">
                Add an operation to a class or interface first.
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
