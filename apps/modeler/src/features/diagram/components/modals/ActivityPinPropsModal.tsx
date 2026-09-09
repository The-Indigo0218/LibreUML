import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import { getPinParameterCandidates } from '../../../../store/activityModelOps';
import type { IRActivityNode } from '../../../../core/domain/vfs/vfs.types';

/**
 * Pin properties — the setter half of the pin→parameter trace (A6.2,
 * ADR-0010). The display half (the resolved caption under the square) lives
 * in `PinShape`; this is where it gets picked. Same shape as
 * `ActivityObjectNodePropsModal`, one selector narrower: candidates come
 * from the owner action's linked operation, not the whole project.
 */
export default function ActivityPinPropsModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'activity-pin-props' && !!editingId;

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

  const node = isOpen ? getNode() : null;

  const candidates = useMemo(() => {
    if (!isOpen || !node) return [] as Array<{ value: string; label: string }>;
    const model = getModel();
    if (!model) return [];
    const pinKind = node.activityType === 'OUTPUT_PIN' ? 'OUTPUT_PIN' : 'INPUT_PIN';
    return getPinParameterCandidates(model, node.ownerActionId, pinKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId, activeTabId]);

  const [parameterName, setParameterName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setParameterName(getNode()?.parameterName ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen || !node) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch = { parameterName: parameterName || undefined };
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
            <p className="text-xs text-[#475569] font-mono italic">parameterName</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              {node.activityType === 'OUTPUT_PIN' ? 'Output' : 'Input'} Pin Properties
              {node.name ? ` — ${node.name}` : ''}
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
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Parameter</label>
            <select
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              value={parameterName}
              onChange={(e) => setParameterName(e.target.value)}
              autoFocus
            >
              <option value="">— none —</option>
              {candidates.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="mt-1 text-[10px] text-[#475569]">
                Link the owning action to an operation with a matching parameter first
                (Call Operation → &quot;Link Operation…&quot;).
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
