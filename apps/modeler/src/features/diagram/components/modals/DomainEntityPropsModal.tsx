import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEditingEntity } from '../../../../store/useEditingEntity';
import NameOnlyAttributeList, { type NameOnlyAttr } from '../shared/NameOnlyAttributeList';
import type { IRDomainEntity, IRDomainAttribute } from '../../../../core/domain/vfs/vfs.types';

export default function DomainEntityPropsModal() {
  const { isOpen, editingId, closeModals, getEntity, getOps, getModel } = useEditingEntity(
    'domain-entity-props',
    (model, id) => model?.domainEntities?.[id] ?? null,
  );

  const getAttributes = (entity: IRDomainEntity): IRDomainAttribute[] => {
    const model = getModel();
    return entity.attributeIds
      .map((id) => model?.domainAttributes?.[id])
      .filter((a): a is IRDomainAttribute => !!a);
  };

  const [name, setName] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [attrs, setAttrs] = useState<NameOnlyAttr[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const entity = getEntity();
    if (!entity) return;
    setName(entity.name);
    setDocumentation(entity.documentation ?? '');
    setAttrs(getAttributes(entity).map((a) => ({ id: a.id, name: a.name })));
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!editingId) return;
    const trimmedName = name.trim() || 'Entity';
    const newAttrs: IRDomainAttribute[] = attrs
      .filter((a) => a.name.trim())
      .map((a) => ({ id: a.id, kind: 'DOMAIN_ATTRIBUTE' as const, name: a.name.trim() }));

    const ops = getOps();
    ops.updateDomainEntity(editingId, {
      name: trimmedName,
      documentation: documentation.trim() || undefined,
    });
    ops.setDomainEntityAttributes(editingId, newAttrs);
    closeModals();
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={closeModals}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-sm flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && closeModals()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#f59e0b] text-xs font-mono shrink-0">Entity:</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="bg-transparent text-[#e2e8f0] text-base font-semibold focus:outline-none border-b border-transparent focus:border-[#f59e0b] transition-colors min-w-0 flex-1"
            />
          </div>
          <button
            onClick={closeModals}
            className="p-1 hover:bg-[#1e2738] rounded text-[#64748b] hover:text-[#e2e8f0] transition-colors ml-2 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-1.5">
              Documentation
            </label>
            <textarea
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full px-2.5 py-1.5 bg-[#0f1419] border border-[#2a3358] rounded text-[#e2e8f0] text-sm placeholder-[#374151] focus:outline-none focus:border-[#f59e0b] resize-none transition-colors"
            />
          </div>

          <NameOnlyAttributeList attrs={attrs} onChange={setAttrs} />
        </div>

        <div className="flex justify-end gap-3 px-4 pb-4 shrink-0">
          <button
            onClick={closeModals}
            className="px-3 py-1.5 text-sm text-[#94a3b8] bg-[#1e2738] hover:bg-[#2a3358] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm text-white bg-[#f59e0b] hover:bg-[#d97706] rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
