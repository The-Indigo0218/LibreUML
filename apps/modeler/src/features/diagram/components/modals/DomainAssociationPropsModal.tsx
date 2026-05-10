import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useActiveSemanticModelOps } from '../../../../store/useActiveSemanticModelOps';
import { isValidMultiplicity } from '../../../../core/domain/multiplicity.utils';
import MultiplicitySelector from '../shared/MultiplicitySelector';

export default function DomainAssociationPropsModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'domain-association-props' && !!editingId;

  const { getModel, getOps } = useActiveSemanticModelOps();

  const getRelation = () => {
    if (!editingId) return null;
    return getModel()?.relations?.[editingId] ?? null;
  };

  const getEntityName = (id: string): string =>
    getModel()?.domainEntities?.[id]?.name ?? '—';

  const [verb, setVerb] = useState('');
  const [srcMul, setSrcMul] = useState('');
  const [tgtMul, setTgtMul] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const rel = getRelation();
    if (!rel) return;
    setVerb(rel.name ?? '');
    setSrcMul(rel.sourceEnd?.multiplicity ?? '');
    setTgtMul(rel.targetEnd?.multiplicity ?? '');
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const relation = getRelation();
  if (!relation) return null;

  const srcName = getEntityName(relation.sourceId);
  const tgtName = getEntityName(relation.targetId);

  const srcMulValid = isValidMultiplicity(srcMul);
  const tgtMulValid = isValidMultiplicity(tgtMul);
  const canSave = verb.trim().length > 0 && srcMulValid && tgtMulValid;

  const handleSave = () => {
    if (!editingId || !canSave) return;
    const patch = {
      name: verb.trim(),
      sourceEnd: { elementId: relation.sourceId, multiplicity: srcMul.trim() || undefined },
      targetEnd: { elementId: relation.targetId, multiplicity: tgtMul.trim() || undefined },
    };
    getOps().updateRelation(editingId, patch);
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
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358]">
          <div>
            <p className="text-xs text-[#475569] font-mono">association</p>
            <div className="flex items-center gap-1.5 text-sm text-[#94a3b8] mt-0.5">
              <span className="text-[#f59e0b] font-medium truncate max-w-[100px]">{srcName}</span>
              <span className="text-[#475569]">→</span>
              <span className="text-[#e2e8f0] font-medium truncate max-w-[100px]">{tgtName}</span>
            </div>
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
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-1.5">
              Verb label <span className="text-red-400 normal-case font-normal">(required)</span>
            </label>
            <input
              value={verb}
              onChange={(e) => setVerb(e.target.value)}
              autoFocus
              placeholder="e.g. places, contains, manages"
              className="w-full bg-[#0f1419] border border-[#2a3358] rounded px-2.5 py-1.5 text-sm text-[#e2e8f0] placeholder-[#374151] focus:outline-none focus:border-[#f59e0b] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-1.5">
              Source multiplicity
              <span className="ml-1 font-mono text-[#f59e0b] normal-case">({srcName})</span>
            </label>
            <MultiplicitySelector value={srcMul} onChange={setSrcMul} invalid={!srcMulValid} />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-1.5">
              Target multiplicity
              <span className="ml-1 font-mono text-[#e2e8f0] normal-case">({tgtName})</span>
            </label>
            <MultiplicitySelector value={tgtMul} onChange={setTgtMul} invalid={!tgtMulValid} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            onClick={closeModals}
            className="px-3 py-1.5 rounded text-xs text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e2738] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[#f59e0b] hover:bg-[#d97706] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
