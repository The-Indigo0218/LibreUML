import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { useEditingEntity } from '../../../../store/useEditingEntity';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { isValidMultiplicity } from '../../../../core/domain/multiplicity.utils';
import MultiplicitySelector from '../shared/MultiplicitySelector';
import { isDiagramView } from '../../hooks/useVFSCanvasController';

type Navigability = boolean | undefined;

/**
 * NavigabilitySelector — 3-state UML navigability control for one association end.
 *   —  unspecified (default; no arrowhead, matches EA/StarUML)
 *   →  navigable (open arrow)   ·   ✕  not navigable
 */
function NavigabilitySelector({
  value,
  onChange,
}: {
  value: Navigability;
  onChange: (v: Navigability) => void;
}) {
  const opts: { key: string; v: Navigability; glyph: string; title: string }[] = [
    { key: 'u', v: undefined, glyph: '—', title: 'Sin especificar' },
    { key: 'n', v: true, glyph: '→', title: 'Navegable' },
    { key: 'x', v: false, glyph: '✕', title: 'No navegable' },
  ];
  return (
    <div className="flex rounded border border-[#2a3358] overflow-hidden w-max">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.key}
            type="button"
            title={o.title}
            onClick={() => onChange(o.v)}
            className={
              'px-2.5 py-1 text-sm font-mono transition-colors ' +
              (active
                ? 'bg-[#f59e0b] text-white'
                : 'bg-[#0f1419] text-[#64748b] hover:text-[#94a3b8]')
            }
          >
            {o.glyph}
          </button>
        );
      })}
    </div>
  );
}

export default function DomainAssociationPropsModal() {
  const { isOpen, editingId, closeModals, getEntity: getRelation, getOps, getModel, activeTabId } = useEditingEntity(
    'domain-association-props',
    (model, id) => model?.relations?.[id] ?? null,
  );

  const getEntityName = (id: string): string =>
    getModel()?.domainEntities?.[id]?.name ?? '—';

  const [verb, setVerb] = useState('');
  const [srcMul, setSrcMul] = useState('');
  const [tgtMul, setTgtMul] = useState('');
  const [srcNav, setSrcNav] = useState<Navigability>(undefined);
  const [tgtNav, setTgtNav] = useState<Navigability>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    const rel = getRelation();
    if (!rel) return;
    setVerb(rel.name ?? '');
    setSrcMul(rel.sourceEnd?.multiplicity ?? '');
    setTgtMul(rel.targetEnd?.multiplicity ?? '');
    setSrcNav(rel.sourceEnd?.isNavigable);
    setTgtNav(rel.targetEnd?.isNavigable);
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const relation = getRelation();
  if (!relation) return null;

  const srcName = getEntityName(relation.sourceId);
  const tgtName = getEntityName(relation.targetId);

  const srcMulValid = isValidMultiplicity(srcMul);
  const tgtMulValid = isValidMultiplicity(tgtMul);
  // Verb label is optional (UML association names are optional); only the
  // multiplicities must be valid to save.
  const canSave = srcMulValid && tgtMulValid;

  const handleDelete = () => {
    if (!editingId) return;
    if (activeTabId) {
      const project = useVFSStore.getState().project;
      const file = project?.nodes[activeTabId];
      if (file?.type === 'FILE' && isDiagramView((file as any).content)) {
        const content = (file as any).content;
        useVFSStore.getState().updateFileContent(activeTabId, {
          ...content,
          edges: content.edges.filter((e: any) => e.relationId !== editingId),
        });
      }
    }
    getOps().deleteRelation(editingId);
    closeModals();
  };

  const handleSave = () => {
    if (!editingId || !canSave) return;
    const patch = {
      name: verb.trim(),
      sourceEnd: {
        elementId: relation.sourceId,
        multiplicity: srcMul.trim() || undefined,
        ...(srcNav !== undefined ? { isNavigable: srcNav } : {}),
      },
      targetEnd: {
        elementId: relation.targetId,
        multiplicity: tgtMul.trim() || undefined,
        ...(tgtNav !== undefined ? { isNavigable: tgtNav } : {}),
      },
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
            <p className="text-xs text-[#475569] font-mono">{relation.kind.toLowerCase()}</p>
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
              Verb label <span className="text-[#475569] normal-case font-normal">(optional)</span>
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
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] uppercase tracking-wide text-[#64748b]">Navegabilidad</span>
              <NavigabilitySelector value={srcNav} onChange={setSrcNav} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-1.5">
              Target multiplicity
              <span className="ml-1 font-mono text-[#e2e8f0] normal-case">({tgtName})</span>
            </label>
            <MultiplicitySelector value={tgtMul} onChange={setTgtMul} invalid={!tgtMulValid} />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] uppercase tracking-wide text-[#64748b]">Navegabilidad</span>
              <NavigabilitySelector value={tgtNav} onChange={setTgtNav} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-4">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <div className="flex gap-2">
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
    </div>
  );

  return createPortal(modal, document.body);
}
