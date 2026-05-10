import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useActiveSemanticModelOps } from '../../../../store/useActiveSemanticModelOps';
import type { IRDomainEntity, IRDomainAttribute } from '../../../../core/domain/vfs/vfs.types';

interface AttrRow {
  id: string;
  name: string;
}

export default function DomainEntityPropsModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'domain-entity-props' && !!editingId;

  const { getModel, getOps } = useActiveSemanticModelOps();

  const getEntity = (): IRDomainEntity | null => {
    if (!editingId) return null;
    return getModel()?.domainEntities?.[editingId] ?? null;
  };

  const getAttributes = (entity: IRDomainEntity): IRDomainAttribute[] => {
    const model = getModel();
    return entity.attributeIds
      .map((id) => model?.domainAttributes?.[id])
      .filter((a): a is IRDomainAttribute => !!a);
  };

  const [name, setName] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [attrs, setAttrs] = useState<AttrRow[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const entity = getEntity();
    if (!entity) return;
    setName(entity.name);
    setDocumentation(entity.documentation ?? '');
    setAttrs(getAttributes(entity).map((a) => ({ id: a.id, name: a.name })));
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const addAttr = () =>
    setAttrs((prev) => [...prev, { id: crypto.randomUUID(), name: '' }]);

  const removeAttr = (id: string) =>
    setAttrs((prev) => prev.filter((a) => a.id !== id));

  const moveAttr = (id: string, dir: -1 | 1) =>
    setAttrs((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });

  const updateAttrName = (id: string, value: string) =>
    setAttrs((prev) => prev.map((a) => (a.id === id ? { ...a, name: value } : a)));

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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                Attributes
              </label>
              <button
                onClick={addAttr}
                className="flex items-center gap-1 text-xs text-[#f59e0b] hover:text-[#fbbf24] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            <div className="space-y-1.5">
              {attrs.length === 0 && (
                <p className="text-xs text-[#475569] py-2 text-center">
                  No attributes — click Add to define one
                </p>
              )}
              {attrs.map((attr, i) => (
                <div key={attr.id} className="flex items-center gap-1.5">
                  <input
                    value={attr.name}
                    onChange={(e) => updateAttrName(attr.id, e.target.value)}
                    placeholder="attributeName"
                    className="flex-1 bg-[#0f1419] border border-[#2a3358] rounded px-2 py-1 text-sm text-[#e2e8f0] placeholder-[#374151] focus:outline-none focus:border-[#f59e0b] transition-colors font-mono"
                  />
                  <button
                    onClick={() => moveAttr(attr.id, -1)}
                    disabled={i === 0}
                    className="p-1 text-[#475569] hover:text-[#94a3b8] disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveAttr(attr.id, 1)}
                    disabled={i === attrs.length - 1}
                    className="p-1 text-[#475569] hover:text-[#94a3b8] disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeAttr(attr.id)}
                    className="p-1 text-[#475569] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
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
