import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeftRight, Trash2, Check, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../../store/uiStore';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { isDiagramView } from '../../hooks/useVFSCanvasController';
import type { VFSFile, RelationKind, SemanticModel } from '../../../../core/domain/vfs/vfs.types';

const CLASS_RELATION_KINDS: { value: RelationKind; label: string }[] = [
  { value: 'ASSOCIATION',    label: 'Association' },
  { value: 'GENERALIZATION', label: 'Generalization (Inheritance)' },
  { value: 'REALIZATION',    label: 'Realization (Implementation)' },
  { value: 'DEPENDENCY',     label: 'Dependency' },
  { value: 'AGGREGATION',    label: 'Aggregation' },
  { value: 'COMPOSITION',    label: 'Composition' },
];

const MULTIPLICITY_KINDS = new Set<RelationKind>([
  'ASSOCIATION', 'AGGREGATION', 'COMPOSITION',
]);

const MULTIPLICITY_PRESETS = ['1', '*', '0..1', '1..*', '0..*'];

function isValidMultiplicity(v: string): boolean {
  const s = v.trim();
  if (!s) return true;
  if (MULTIPLICITY_PRESETS.includes(s)) return true;
  const n = parseInt(s, 10);
  return !isNaN(n) && n > 0 && String(n) === s;
}

function getElementName(model: SemanticModel, elementId: string): string {
  return (
    model.classes[elementId]?.name ??
    model.interfaces[elementId]?.name ??
    model.enums[elementId]?.name ??
    elementId
  );
}

const PRESET_BTN_BASE =
  'text-[10px] px-1.5 py-0.5 rounded border transition-all';
const PRESET_BTN_ACTIVE =
  'bg-indigo-900/40 border-indigo-500 text-indigo-300 font-bold';
const PRESET_BTN_IDLE =
  'bg-surface-primary border-surface-border text-text-secondary hover:border-indigo-400';

export default function VfsEdgeActionModal() {
  const { t } = useTranslation();
  const { activeModal, editingId, closeModals } = useUiStore();
  const project = useVFSStore((s) => s.project);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);
  const model = useModelStore((s) => s.model);
  const updateRelation = useModelStore((s) => s.updateRelation);
  const deleteRelation = useModelStore((s) => s.deleteRelation);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);

  const isOpen = activeModal === 'vfs-edge-action' && !!editingId;

  const { viewEdge, relation } = useMemo(() => {
    if (!isOpen || !editingId || !project || !model || !activeTabId)
      return { viewEdge: undefined, relation: undefined };
    const fileNode = project.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') return { viewEdge: undefined, relation: undefined };
    const content = (fileNode as VFSFile).content;
    if (!isDiagramView(content)) return { viewEdge: undefined, relation: undefined };
    const ve = content.edges.find((e) => e.id === editingId);
    if (!ve) return { viewEdge: undefined, relation: undefined };
    const rel = model.relations[ve.relationId];
    return { viewEdge: ve, relation: rel ?? undefined };
  }, [isOpen, editingId, project, model, activeTabId]);

  const [kind, setKind] = useState<RelationKind>('ASSOCIATION');
  const [reversed, setReversed] = useState(false);
  const [sourceRole, setSourceRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [sourceMul, setSourceMul] = useState('');
  const [targetMul, setTargetMul] = useState('');
  const [anchorLocked, setAnchorLocked] = useState(false);

  useEffect(() => {
    if (isOpen && viewEdge && relation) {
      setKind(relation.kind);
      setReversed(false);
      setSourceRole(viewEdge.sourceRole ?? '');
      setTargetRole(viewEdge.targetRole ?? '');
      setSourceMul(viewEdge.sourceMultiplicity ?? '');
      setTargetMul(viewEdge.targetMultiplicity ?? '');
      setAnchorLocked(viewEdge.anchorLocked ?? false);
    }
  }, [isOpen, viewEdge, relation]);

  if (!isOpen || !viewEdge || !relation || !model) return null;

  const sourceName = getElementName(model, relation.sourceId);
  const targetName = getElementName(model, relation.targetId);
  const displaySource = reversed ? targetName : sourceName;
  const displayTarget = reversed ? sourceName : targetName;

  const showMultiplicity = MULTIPLICITY_KINDS.has(kind);
  const srcMulValid = isValidMultiplicity(sourceMul);
  const tgtMulValid = isValidMultiplicity(targetMul);
  const canSave = srcMulValid && tgtMulValid;

  const handleSave = () => {
    if (!canSave) return;

    updateRelation(relation.id, {
      kind,
      ...(reversed
        ? { sourceId: relation.targetId, targetId: relation.sourceId }
        : {}),
    });

    const freshProject = useVFSStore.getState().project;
    if (!activeTabId || !freshProject) { closeModals(); return; }
    const fileNode = freshProject.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') { closeModals(); return; }
    const content = (fileNode as VFSFile).content;
    if (!isDiagramView(content)) { closeModals(); return; }

    const updatedEdges = content.edges.map((e) =>
      e.id === viewEdge.id
        ? {
            ...e,
            sourceRole,
            targetRole,
            sourceMultiplicity: sourceMul,
            targetMultiplicity: targetMul,
            anchorLocked,
          }
        : e,
    );
    updateFileContent(activeTabId, { ...content, edges: updatedEdges });
    closeModals();
  };

  const handleDelete = () => {
    deleteRelation(relation.id);
    const freshProject = useVFSStore.getState().project;
    if (activeTabId && freshProject) {
      const fileNode = freshProject.nodes[activeTabId];
      if (fileNode && fileNode.type === 'FILE') {
        const content = (fileNode as VFSFile).content;
        if (isDiagramView(content)) {
          updateFileContent(activeTabId, {
            ...content,
            edges: content.edges.filter((e) => e.id !== viewEdge.id),
          });
        }
      }
    }
    closeModals();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-[520px] max-w-[95vw] text-text-primary flex flex-col animate-in zoom-in-95 duration-200">

        <div className="px-5 py-3 border-b border-surface-border flex justify-between items-center bg-surface-secondary/50">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">
            Editar Relación
          </h2>
          <button onClick={closeModals} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">

          <div className="space-y-3">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
              Tipo de Relación
            </label>
            <select
              className="w-full bg-surface-secondary border border-surface-border rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-uml-class-border"
              value={kind}
              onChange={(e) => setKind(e.target.value as RelationKind)}
            >
              {CLASS_RELATION_KINDS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="flex items-center gap-3 bg-surface-secondary/50 rounded-lg p-3 border border-surface-border">
              <div className="flex-1 text-center min-w-0">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{t('vfsEdgeAction.origin')}</div>
                <div className="text-sm font-semibold text-indigo-400 truncate">{displaySource}</div>
              </div>
              <button
                onClick={() => setReversed((r) => !r)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all shrink-0 ${
                  reversed
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-surface-primary border-surface-border text-text-secondary hover:border-indigo-500 hover:text-indigo-400'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                {reversed ? 'Revertido ✓' : 'Cambiar Dirección'}
              </button>
              <div className="flex-1 text-center min-w-0">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{t('vfsEdgeAction.destination')}</div>
                <div className="text-sm font-semibold text-indigo-400 truncate">{displayTarget}</div>
              </div>
            </div>
          </div>

          {showMultiplicity && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                Multiplicidad & Roles
              </label>
              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    ◄ {displaySource}
                  </div>
                  <input
                    type="text"
                    value={sourceRole}
                    onChange={(e) => setSourceRole(e.target.value)}
                    placeholder="Rol (ej: empleado)"
                    className="w-full bg-surface-secondary border border-surface-border rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono"
                  />
                  <input
                    type="text"
                    value={sourceMul}
                    onChange={(e) => setSourceMul(e.target.value)}
                    placeholder="Multiplicidad"
                    className={`w-full bg-surface-secondary border rounded px-2 py-1.5 text-xs outline-none font-mono text-center ${
                      srcMulValid
                        ? 'border-surface-border focus:border-indigo-500 text-text-primary'
                        : 'border-red-500 text-red-400'
                    }`}
                  />
                  <div className="flex flex-wrap gap-1">
                    {MULTIPLICITY_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setSourceMul(p)}
                        className={`${PRESET_BTN_BASE} ${sourceMul === p ? PRESET_BTN_ACTIVE : PRESET_BTN_IDLE}`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setSourceMul('')}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-l border-surface-border/50 pl-4">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    {displayTarget} ►
                  </div>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="Rol (ej: empresa)"
                    className="w-full bg-surface-secondary border border-surface-border rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono"
                  />
                  <input
                    type="text"
                    value={targetMul}
                    onChange={(e) => setTargetMul(e.target.value)}
                    placeholder="Multiplicidad"
                    className={`w-full bg-surface-secondary border rounded px-2 py-1.5 text-xs outline-none font-mono text-center ${
                      tgtMulValid
                        ? 'border-surface-border focus:border-indigo-500 text-text-primary'
                        : 'border-red-500 text-red-400'
                    }`}
                  />
                  <div className="flex flex-wrap gap-1">
                    {MULTIPLICITY_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setTargetMul(p)}
                        className={`${PRESET_BTN_BASE} ${targetMul === p ? PRESET_BTN_ACTIVE : PRESET_BTN_IDLE}`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setTargetMul('')}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10"
                    >
                      ✕
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={anchorLocked}
              onChange={(e) => setAnchorLocked(e.target.checked)}
              className="accent-indigo-500 w-3.5 h-3.5"
            />
            <Lock className={`w-3.5 h-3.5 transition-colors ${anchorLocked ? 'text-indigo-400' : 'text-text-muted'}`} />
            <span className="text-xs text-text-secondary font-medium group-hover:text-text-primary transition-colors">
              Bloquear puntos de conexión
            </span>
          </label>

        </div>

        <div className="px-5 py-3 bg-surface-secondary/30 border-t border-surface-border flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 rounded transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar
          </button>
          <div className="flex gap-2">
            <button
              onClick={closeModals}
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-2 px-4 py-2 bg-uml-class-border text-white text-xs font-bold rounded shadow-sm hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-3 h-3" />
              Guardar
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body,
  );
}
