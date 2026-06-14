import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRLifeline, VFSFile } from '../../../../core/domain/vfs/vfs.types';

/**
 * Lifeline properties — currently scoped to UML 2.5 §17.4 decomposition (C5):
 * point the lifeline at a sub-interaction so it can be navigated to.
 */
export default function LifelinePropertiesModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'lifeline-props' && !!editingId;

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

  const getLifeline = (): IRLifeline | null => {
    if (!editingId) return null;
    return getModel()?.lifelines?.[editingId] ?? null;
  };

  // Other sequence diagrams in the project this lifeline can decompose to.
  const targets = useMemo(() => {
    if (!project) return [] as Array<{ id: string; name: string }>;
    return Object.values(project.nodes)
      .filter(
        (n): n is VFSFile =>
          n.type === 'FILE' &&
          (n as VFSFile).diagramType === 'SEQUENCE_DIAGRAM' &&
          n.id !== activeTabId,
      )
      .map((f) => ({ id: f.id, name: f.name }));
  }, [project, activeTabId]);

  const [decomposedAs, setDecomposedAs] = useState('');
  const [decomposedName, setDecomposedName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const ll = getLifeline();
    if (!ll) return;
    setDecomposedAs(ll.decomposedAs ?? '');
    setDecomposedName(ll.decomposedName ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen) return null;
  const ll = getLifeline();
  if (!ll) return null;

  const handlePickTarget = (id: string) => {
    setDecomposedAs(id);
    const target = targets.find((t) => t.id === id);
    setDecomposedName(target ? target.name : '');
  };

  const handleSave = () => {
    if (!editingId) return;
    const patch: Partial<IRLifeline> = {
      decomposedAs: decomposedAs || undefined,
      decomposedName: decomposedAs ? decomposedName.trim() || undefined : undefined,
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateLifeline(editingId, patch);
    } else {
      useModelStore.getState().updateLifeline(editingId, patch);
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
            <p className="text-xs text-[#475569] font-mono italic">decomposedAs</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Decompose Lifeline</h2>
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
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
              Sub-interaction
            </label>
            <select
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                         text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
              value={decomposedAs}
              onChange={(e) => handlePickTarget(e.target.value)}
            >
              <option value="">— none —</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {targets.length === 0 && (
              <p className="mt-1 text-[10px] text-[#475569]">
                Create another sequence diagram to decompose into.
              </p>
            )}
          </div>

          {decomposedAs && (
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
                Display label
              </label>
              <input
                type="text"
                className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                           text-sm text-[#e2e8f0] placeholder-[#475569]
                           focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
                placeholder="e.g. ProcessOrder"
                value={decomposedName}
                onChange={(e) => setDecomposedName(e.target.value)}
                autoFocus
              />
              <p className="mt-1 text-[10px] text-[#475569]">
                Shown as <span className="font-mono">ref {decomposedName || '…'}</span>; double-click the
                lifeline to open it.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
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
