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
 * Object node properties — the setter half of the node→classifier trace
 * (ADR-0010). The display half (the `[ClassifierName]` subtitle) lives in
 * ObjectNodeShape; this is where it gets picked. Same shape as
 * `ActivityPartitionPropsModal`, one selector wider (classes, interfaces,
 * enums and data types are all legal classifiers for a value in flow).
 *
 * Also opened for an expansion node (v1.1, `useDiagramMenus.ts`'s "Link
 * Classifier…") — it reuses this exact field/modal rather than a parallel
 * one, since "classifier of the element that flows" is the same concept for
 * both; only the modal title reflects which kind is open.
 */
export default function ActivityObjectNodePropsModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'activity-objectnode-props' && !!editingId;

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

  const candidates = useMemo(() => {
    if (!isOpen) return [] as Array<{ id: string; label: string }>;
    const model = getModel();
    if (!model) return [];
    const classes = Object.values(model.classes).map((c) => ({ id: c.id, label: c.name }));
    const interfaces = Object.values(model.interfaces).map((i) => ({ id: i.id, label: `«interface» ${i.name}` }));
    const enums = Object.values(model.enums).map((e) => ({ id: e.id, label: `«enumeration» ${e.name}` }));
    const dataTypes = Object.values(model.dataTypes).map((d) => ({ id: d.id, label: `«dataType» ${d.name}` }));
    return [...classes, ...interfaces, ...enums, ...dataTypes].sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId, activeTabId]);

  const [classifierId, setClassifierId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const node = getNode();
    setClassifierId(node?.classifierId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const node = getNode();
  if (!node) return null;

  const titlePrefix = node.activityType === 'INPUT_EXPANSION_NODE' || node.activityType === 'OUTPUT_EXPANSION_NODE'
    ? 'Expansion Node'
    : 'Object Node';

  const handleSave = () => {
    if (!editingId) return;
    const patch = { classifierId: classifierId || undefined };
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
            <p className="text-xs text-[#475569] font-mono italic">classifierId</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">{titlePrefix} Properties{node.name ? ` — ${node.name}` : ''}</h2>
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
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Classifier</label>
            <select
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              value={classifierId}
              onChange={(e) => setClassifierId(e.target.value)}
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
                Create a class, interface, enum or data type somewhere in the project first.
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
