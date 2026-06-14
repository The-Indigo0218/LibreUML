import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type {
  IRInteractionFragment,
  IRInteractionOperand,
  IRGate,
} from '../../../../core/domain/vfs/vfs.types';
import { MULTI_OPERAND_FRAGMENT_KINDS } from '../../../../core/domain/vfs/vfs.types';

export default function FragmentPropertiesModal() {
  const { t } = useTranslation();
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'fragment-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId &&
    project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as { standalone?: boolean }).standalone === true
  );

  const getFragment = (): IRInteractionFragment | null => {
    if (!editingId) return null;
    if (isStandalone && activeTabId) {
      return getLocalModel(activeTabId)?.interactionFragments?.[editingId] ?? null;
    }
    return useModelStore.getState().model?.interactionFragments?.[editingId] ?? null;
  };

  const getModel = () =>
    isStandalone && activeTabId
      ? getLocalModel(activeTabId)
      : useModelStore.getState().model;

  const ops = () =>
    isStandalone && activeTabId ? standaloneModelOps(activeTabId) : useModelStore.getState();

  const [operands, setOperands] = useState<IRInteractionOperand[]>([]);
  const [fragmentKind, setFragmentKind] = useState<IRInteractionFragment['fragmentKind']>('ALT');
  const [gates, setGates] = useState<IRGate[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const frag = getFragment();
    if (!frag) return;
    // Deep-clone operands so edits don't mutate the live model state.
    setOperands(
      frag.operands.map((op) => ({
        id: op.id,
        guard: op.guard ?? '',
        messageIds: [...op.messageIds],
        fragmentIds: [...op.fragmentIds],
      })),
    );
    setFragmentKind(frag.fragmentKind);
    setGates(
      Object.values(getModel()?.gates ?? {}).filter((g) => g.ownerFragmentId === editingId),
    );
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const fragment = getFragment();
  if (!fragment) return null;

  const allowMulti = MULTI_OPERAND_FRAGMENT_KINDS.has(fragmentKind);

  const handleAddOperand = () => {
    if (!allowMulti) return;
    setOperands((prev) => [
      ...prev,
      { id: crypto.randomUUID(), guard: '', messageIds: [], fragmentIds: [] },
    ]);
  };

  const handleRemoveOperand = (operandId: string) => {
    if (operands.length <= 1) return;
    setOperands((prev) => {
      const removedIdx = prev.findIndex((op) => op.id === operandId);
      if (removedIdx === -1) return prev;
      const removed = prev[removedIdx];
      // Migrate the removed operand's messages + sub-fragments to the previous
      // operand (or the first one if the user removed the first).
      const survivors = prev.filter((op) => op.id !== operandId);
      const mergeTargetIdx = Math.max(0, removedIdx - 1);
      survivors[mergeTargetIdx] = {
        ...survivors[mergeTargetIdx],
        messageIds: [...survivors[mergeTargetIdx].messageIds, ...removed.messageIds],
        fragmentIds: [...survivors[mergeTargetIdx].fragmentIds, ...removed.fragmentIds],
      };
      return survivors;
    });
  };

  const handleGuardChange = (operandId: string, value: string) => {
    setOperands((prev) =>
      prev.map((op) => (op.id === operandId ? { ...op, guard: value } : op)),
    );
  };

  const commitOperands = () => {
    if (!editingId) return;
    ops().updateFragment(editingId, { operands });
  };

  const handleAddGate = (side: IRGate['side']) => {
    if (!editingId) return;
    commitOperands(); // preserve in-progress operand edits before switching modal
    const afterSequenceNumber = Object.keys(getModel()?.messages ?? {}).length;
    const newId = ops().createGate({ name: '', ownerFragmentId: editingId, side, afterSequenceNumber });
    useUiStore.getState().openGateProps(newId);
  };

  const handleEditGate = (gateId: string) => {
    commitOperands();
    useUiStore.getState().openGateProps(gateId);
  };

  const handleRemoveGate = (gateId: string) => {
    ops().deleteGate(gateId);
    setGates((prev) => prev.filter((g) => g.id !== gateId));
  };

  const handleSave = () => {
    if (!editingId) return;
    const patch = { operands };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateFragment(editingId, patch);
    } else {
      useModelStore.getState().updateFragment(editingId, patch);
    }
    closeModals();
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={closeModals}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && closeModals()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358]">
          <div>
            <p className="text-xs text-[#475569] font-mono italic">{fragmentKind.toLowerCase()}</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              {t('fragment.title')}
            </h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Operands list */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-2">
              {t('fragment.operands')} ({operands.length})
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {operands.map((op, idx) => (
                <div
                  key={op.id}
                  className="flex items-center gap-2 bg-[#0f1623] border border-[#2a3358] rounded px-2 py-2"
                >
                  <span className="text-[10px] text-[#475569] font-mono w-6 shrink-0">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    className="flex-1 bg-transparent text-sm text-[#e2e8f0] placeholder-[#475569]
                               focus:outline-none"
                    placeholder={t('fragment.guard.placeholder')}
                    value={op.guard ?? ''}
                    onChange={(e) => handleGuardChange(op.id, e.target.value)}
                  />
                  <span className="text-[10px] text-[#64748b] shrink-0">
                    {t('fragment.messageCount', { count: op.messageIds.length })}
                  </span>
                  <button
                    onClick={() => handleRemoveOperand(op.id)}
                    disabled={operands.length <= 1}
                    title={
                      operands.length <= 1
                        ? t('fragment.warning.lastOperand')
                        : t('fragment.removeOperand')
                    }
                    className="p-1 rounded text-[#64748b] hover:text-red-400 hover:bg-[#1e2738]
                               transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                               disabled:hover:text-[#64748b] disabled:hover:bg-transparent"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add operand button */}
          {allowMulti ? (
            <button
              onClick={handleAddOperand}
              className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded
                         text-xs font-medium text-[#94a3b8] hover:text-[#e2e8f0]
                         bg-[#0f1623] hover:bg-[#1e2738] border border-dashed border-[#2a3358]
                         hover:border-[#7C83FF] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('fragment.addOperand')}
            </button>
          ) : (
            <p className="text-[10px] text-[#475569] italic px-1">
              {t('fragment.warning.singleOperandOnly')}
            </p>
          )}

          {/* Gates (UML 2.5 connection points on the fragment boundary) */}
          <div className="pt-1 border-t border-[#2a3358]">
            <label className="block text-xs font-semibold text-[#94a3b8] mb-2 mt-2">
              {t('fragment.gates')} ({gates.length})
            </label>
            {gates.length > 0 && (
              <div className="space-y-2 mb-2">
                {gates.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-2 bg-[#0f1623] border border-[#2a3358] rounded px-2 py-1.5"
                  >
                    <span className="text-[9px] font-mono uppercase text-[#475569] w-9 shrink-0">
                      {g.side}
                    </span>
                    <button
                      onClick={() => handleEditGate(g.id)}
                      className="flex-1 text-left text-sm text-[#e2e8f0] hover:text-[#7C83FF] truncate"
                    >
                      {g.name || <span className="text-[#475569] italic">{t('fragment.gateUnnamed')}</span>}
                    </button>
                    <button
                      onClick={() => handleRemoveGate(g.id)}
                      title={t('fragment.removeGate')}
                      className="p-1 rounded text-[#64748b] hover:text-red-400 hover:bg-[#1e2738] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleAddGate('LEFT')}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded
                           text-xs font-medium text-[#94a3b8] hover:text-[#e2e8f0]
                           bg-[#0f1623] hover:bg-[#1e2738] border border-dashed border-[#2a3358]
                           hover:border-[#7C83FF] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('fragment.addGateLeft')}
              </button>
              <button
                onClick={() => handleAddGate('RIGHT')}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded
                           text-xs font-medium text-[#94a3b8] hover:text-[#e2e8f0]
                           bg-[#0f1623] hover:bg-[#1e2738] border border-dashed border-[#2a3358]
                           hover:border-[#7C83FF] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('fragment.addGateRight')}
              </button>
            </div>
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
