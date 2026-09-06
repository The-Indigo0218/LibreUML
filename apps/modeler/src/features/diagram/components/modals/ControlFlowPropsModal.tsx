import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';

/**
 * Edits `guard`/`weight` on a CONTROL_FLOW/OBJECT_FLOW relation (A2, UML 2.5
 * §15.3). Same shape as ExtendEdgePropsModal — a two-field props modal keyed
 * off `editingId` — since both relations are already ordinary `IRRelation`s;
 * only the fields shown differ.
 */
export default function ControlFlowPropsModal() {
  const { t } = useTranslation();
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'control-flow-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId && project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as { standalone?: boolean }).standalone === true
  );

  const getRelation = () => {
    if (!editingId) return null;
    if (isStandalone && activeTabId) return getLocalModel(activeTabId)?.relations?.[editingId] ?? null;
    return useModelStore.getState().model?.relations?.[editingId] ?? null;
  };

  const [guard, setGuard] = useState('');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const rel = getRelation();
    if (!rel) return;
    setGuard(rel.guard ?? '');
    setWeight(rel.weight ?? '');
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const relation = getRelation();
  if (!relation) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch = {
      guard: guard.trim() || undefined,
      weight: weight.trim() || undefined,
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateRelation(editingId, patch);
    } else {
      useModelStore.getState().updateRelation(editingId, patch);
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
              {relation.kind === 'OBJECT_FLOW' ? 'object flow' : 'control flow'}
            </p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              {t('controlFlow.title')}
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
          {/* Guard */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
              {t('controlFlow.guard')}
            </label>
            <input
              type="text"
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-2
                         text-sm text-[#e2e8f0] placeholder-[#475569]
                         focus:outline-none focus:border-[#7C83FF] transition-colors"
              placeholder={t('controlFlow.guard.placeholder')}
              value={guard}
              onChange={(e) => setGuard(e.target.value)}
              autoFocus
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
              {t('controlFlow.weight')}
            </label>
            <input
              type="text"
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-2
                         text-sm text-[#e2e8f0] placeholder-[#475569]
                         focus:outline-none focus:border-[#7C83FF] transition-colors"
              placeholder={t('controlFlow.weight.placeholder')}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            onClick={closeModals}
            className="px-3 py-1.5 rounded text-xs text-[#64748b] hover:text-[#94a3b8]
                       hover:bg-[#1e2738] transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[#7C83FF]
                       hover:bg-[#9499ff] text-white transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
