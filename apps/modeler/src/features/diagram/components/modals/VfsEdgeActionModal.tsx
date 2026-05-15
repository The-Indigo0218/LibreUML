import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeftRight, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../../store/uiStore';
import AnchorPickerPanel, { toSafeHandle } from './AnchorPickerPanel';
import type { LockedHandle } from '../../../../canvas/edges/geometry';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { undoTransaction } from '../../../../core/undo/undoBridge';
import { isDiagramView } from '../../hooks/useVFSCanvasController';
import type { VFSFile, RelationKind, SemanticModel } from '../../../../core/domain/vfs/vfs.types';
import { isValidMultiplicity } from '../../../../core/domain/multiplicity.utils';
import MultiplicitySelector from '../shared/MultiplicitySelector';

const CLASS_RELATION_KINDS: { value: RelationKind; label: string }[] = [
  { value: 'ASSOCIATION',    label: 'Association' },
  { value: 'GENERALIZATION', label: 'Generalization (Inheritance)' },
  { value: 'REALIZATION',    label: 'Realization (Implementation)' },
  { value: 'DEPENDENCY',     label: 'Dependency' },
  { value: 'AGGREGATION',    label: 'Aggregation' },
  { value: 'COMPOSITION',    label: 'Composition' },
];

const USE_CASE_RELATION_KINDS: { value: RelationKind; label: string; description: string }[] = [
  { value: 'ASSOCIATION',    label: 'Association',     description: 'Actor participates in use case' },
  { value: 'INCLUDE',        label: '«include»',       description: 'Base use case always includes the sub use case' },
  { value: 'EXTEND',         label: '«extend»',        description: 'Extension use case optionally extends the base' },
  { value: 'GENERALIZATION', label: 'Generalization',  description: 'Child inherits from parent (actor or use case)' },
];

const PACKAGE_RELATION_KINDS: { value: RelationKind; label: string; stereotype: string | null; description: string }[] = [
  { value: 'DEPENDENCY',     label: 'Dependency',      stereotype: null,       description: 'Generic dependency between packages' },
  { value: 'PACKAGE_IMPORT', label: '«import»',        stereotype: '«import»', description: 'Public namespace import — exported members are visible to importing package' },
  { value: 'PACKAGE_ACCESS', label: '«access»',        stereotype: '«access»', description: 'Private namespace access — not re-exported to further importers' },
  { value: 'PACKAGE_MERGE',  label: '«merge»',         stereotype: '«merge»',  description: 'Package merge — elements of target are conceptually merged into source' },
];

const MULTIPLICITY_KINDS = new Set<RelationKind>([
  'ASSOCIATION', 'AGGREGATION', 'COMPOSITION',
]);


function getElementName(model: SemanticModel, elementId: string): string {
  return (
    model.classes[elementId]?.name ??
    model.interfaces[elementId]?.name ??
    model.enums[elementId]?.name ??
    model.packages[elementId]?.name ??
    elementId
  );
}


export default function VfsEdgeActionModal() {
  const { t } = useTranslation();
  const { activeModal, editingId, anchorSnapshot, closeModals } = useUiStore();
  const project = useVFSStore((s) => s.project);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);
  const model = useModelStore((s) => s.model);
  const updateRelation = useModelStore((s) => s.updateRelation);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);

  const isOpen = activeModal === 'vfs-edge-action' && !!editingId;

  const { viewEdge, relation, activeModel } = useMemo(() => {
    const none = { viewEdge: undefined, relation: undefined, activeModel: null as SemanticModel | null };
    if (!isOpen || !editingId || !project || !activeTabId) return none;
    const fileNode = project.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') return none;
    const isStandalone = (fileNode as VFSFile).standalone === true;
    const resolvedModel: SemanticModel | null | undefined = isStandalone
      ? ((fileNode as VFSFile).localModel ?? null)
      : model;
    if (!resolvedModel) return none;
    const content = (fileNode as VFSFile).content;
    if (!isDiagramView(content)) return none;
    const ve = content.edges.find((e) => e.id === editingId);
    if (!ve) return none;
    const rel = resolvedModel.relations[ve.relationId];
    return { viewEdge: ve, relation: rel ?? undefined, activeModel: resolvedModel };
  }, [isOpen, editingId, project, model, activeTabId]);

  const [kind, setKind] = useState<RelationKind>('ASSOCIATION');
  const [reversed, setReversed] = useState(false);
  const [sourceRole, setSourceRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [sourceMul, setSourceMul] = useState('');
  const [targetMul, setTargetMul] = useState('');
  const [anchorLocked, setAnchorLocked] = useState(false);
  const [srcHandle, setSrcHandle]       = useState<LockedHandle>('R');
  const [tgtHandle, setTgtHandle]       = useState<LockedHandle>('L');
  const [pickerOpen, setPickerOpen]     = useState(false);

  useEffect(() => {
    if (isOpen && viewEdge && relation) {
      setKind(relation.kind);
      setReversed(false);
      setSourceRole(viewEdge.sourceRole ?? '');
      setTargetRole(viewEdge.targetRole ?? '');
      setSourceMul(viewEdge.sourceMultiplicity ?? '');
      setTargetMul(viewEdge.targetMultiplicity ?? '');
      const locked = viewEdge.anchorLocked ?? false;
      setAnchorLocked(locked);
      setSrcHandle(toSafeHandle(viewEdge.sourceHandle ?? anchorSnapshot?.src, 'R'));
      setTgtHandle(toSafeHandle(viewEdge.targetHandle ?? anchorSnapshot?.tgt, 'L'));
      setPickerOpen(locked);
    }
  // anchorSnapshot intentionally excluded — only run when the edge data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, viewEdge, relation]);

  if (!isOpen || !viewEdge || !relation || !activeModel) return null;

  const isPackageRelation =
    !!(activeModel.packages[relation.sourceId] && activeModel.packages[relation.targetId]);

  const isUseCaseRelation =
    !isPackageRelation && (
      relation.kind === 'INCLUDE' ||
      relation.kind === 'EXTEND' ||
      !!(activeModel.actors?.[relation.sourceId] || activeModel.actors?.[relation.targetId] ||
         activeModel.useCases?.[relation.sourceId] || activeModel.useCases?.[relation.targetId])
    );

  const sourceName = getElementName(activeModel, relation.sourceId);
  const targetName = getElementName(activeModel, relation.targetId);
  const displaySource = reversed ? targetName : sourceName;
  const displayTarget = reversed ? sourceName : targetName;

  const showMultiplicity = !isPackageRelation && !isUseCaseRelation && MULTIPLICITY_KINDS.has(kind);
  const srcMulValid = isValidMultiplicity(sourceMul);
  const tgtMulValid = isValidMultiplicity(targetMul);
  const canSave = srcMulValid && tgtMulValid;

  const handleSave = () => {
    if (!canSave) return;

    const freshProject = useVFSStore.getState().project;
    if (!activeTabId || !freshProject) { closeModals(); return; }
    const fileNode = freshProject.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') { closeModals(); return; }
    const isStandalone = (fileNode as VFSFile).standalone === true;

    const relationPatch = {
      kind,
      ...(reversed
        ? { sourceId: relation.targetId, targetId: relation.sourceId }
        : {}),
    };
    if (isStandalone) {
      standaloneModelOps(activeTabId).updateRelation(relation.id, relationPatch);
    } else {
      updateRelation(relation.id, relationPatch);
    }

    const content = (fileNode as VFSFile).content;
    if (!isDiagramView(content)) { closeModals(); return; }

    const persistSrc = anchorLocked ? srcHandle : undefined;
    const persistTgt = anchorLocked ? tgtHandle : undefined;

    const updatedEdges = content.edges.map((e) =>
      e.id === viewEdge.id
        ? {
            ...e,
            sourceRole,
            targetRole,
            sourceMultiplicity: sourceMul,
            targetMultiplicity: targetMul,
            anchorLocked,
            sourceHandle: persistSrc,
            targetHandle: persistTgt,
          }
        : e,
    );
    updateFileContent(activeTabId, { ...content, edges: updatedEdges });
    closeModals();
  };

  const handleDelete = () => {
    const freshProject = useVFSStore.getState().project;
    if (!activeTabId || !freshProject) { closeModals(); return; }
    const fileNode = freshProject.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') { closeModals(); return; }
    const isStandalone = (fileNode as VFSFile).standalone === true;
    const viewEdgeId = viewEdge.id;
    const relationId = relation.id;

    if (isStandalone) {
      undoTransaction({
        label: 'Delete Relation',
        scope: activeTabId,
        mutations: [{
          store: 'vfs',
          mutate: (draft: any) => {
            const node = draft.project?.nodes[activeTabId];
            if (!node || node.type !== 'FILE') return;
            if (node.localModel?.relations[relationId]) {
              delete node.localModel.relations[relationId];
              node.localModel.updatedAt = Date.now();
            }
            if (isDiagramView(node.content)) {
              node.content.edges = node.content.edges.filter((ve: any) => ve.id !== viewEdgeId);
            }
          },
        }],
      });
    } else {
      undoTransaction({
        label: 'Delete Relation',
        scope: 'global',
        mutations: [
          {
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model?.relations[relationId]) return;
              delete draft.model.relations[relationId];
              draft.model.updatedAt = Date.now();
            },
          },
          {
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
              node.content.edges = node.content.edges.filter((ve: any) => ve.id !== viewEdgeId);
            },
          },
        ],
      });
    }

    closeModals();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-[520px] max-w-[95vw] text-text-primary flex flex-col animate-in zoom-in-95 duration-200">

        <div className="px-5 py-3 border-b border-surface-border flex justify-between items-center bg-surface-secondary/50">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">
            {isPackageRelation ? t('vfsEdgeAction.titlePackage') : t('vfsEdgeAction.title')}
          </h2>
          <button onClick={closeModals} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">

          <div className="space-y-3">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
              {t('vfsEdgeAction.relationType')}
            </label>

            {isPackageRelation ? (
              <div className="flex flex-col gap-1.5">
                {PACKAGE_RELATION_KINDS.map(({ value, label, stereotype: stereo }) => (
                  <button
                    key={value}
                    onClick={() => setKind(value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      kind === value
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-surface-secondary border-surface-border text-text-secondary hover:border-indigo-400/50 hover:text-text-primary'
                    }`}
                  >
                    <span className="w-20 text-center font-mono text-xs font-bold shrink-0 italic">
                      {stereo ?? '→'}
                    </span>
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            ) : isUseCaseRelation ? (
              <div className="flex flex-col gap-1.5">
                {USE_CASE_RELATION_KINDS.map(({ value, label, description }) => (
                  <button
                    key={value}
                    onClick={() => setKind(value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      kind === value
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-surface-secondary border-surface-border text-text-secondary hover:border-blue-400/50 hover:text-text-primary'
                    }`}
                  >
                    <span className="w-24 text-center font-mono text-xs font-bold shrink-0 italic text-blue-400">
                      {label}
                    </span>
                    <span className="text-sm">{description}</span>
                  </button>
                ))}
              </div>
            ) : (
              <select
                className="w-full bg-surface-secondary border border-surface-border rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-uml-class-border"
                value={kind}
                onChange={(e) => setKind(e.target.value as RelationKind)}
              >
                {CLASS_RELATION_KINDS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}

            {isPackageRelation && (
              <div className="mt-2 rounded-lg border border-surface-border bg-surface-secondary/30 p-3 space-y-2">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                  {t('vfsEdgeAction.packageLegend.title')}
                </div>
                {PACKAGE_RELATION_KINDS.map(({ stereotype: stereo, description }) => (
                  <div key={description} className="flex items-start gap-2 text-xs text-text-secondary">
                    <span className="font-mono italic text-indigo-400 w-20 shrink-0 text-center">
                      {stereo ?? '→'}
                    </span>
                    <span>{description}</span>
                  </div>
                ))}
              </div>
            )}

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
                  <MultiplicitySelector
                    value={sourceMul}
                    onChange={setSourceMul}
                    invalid={!srcMulValid}
                    accent="indigo"
                  />
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
                  <MultiplicitySelector
                    value={targetMul}
                    onChange={setTargetMul}
                    invalid={!tgtMulValid}
                    accent="indigo"
                  />
                </div>

              </div>
            </div>
          )}

          {/* Anchor picker — collapsible */}
          <div className="border-t border-surface-border/50 pt-4">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors mb-2"
            >
              <span>{t('vfsEdgeAction.anchorPicker.title')}</span>
              {pickerOpen
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />
              }
            </button>

            {pickerOpen && (
              <AnchorPickerPanel
                srcHandle={srcHandle}
                tgtHandle={tgtHandle}
                direction={anchorSnapshot?.direction ?? { dx: 100, dy: 0 }}
                sourceName={displaySource}
                targetName={displayTarget}
                locked={anchorLocked}
                onChangeSrc={(h) => { setSrcHandle(h); setAnchorLocked(true); }}
                onChangeTgt={(h) => { setTgtHandle(h); setAnchorLocked(true); }}
                onUnlock={() => {
                  setAnchorLocked(false);
                  setSrcHandle(anchorSnapshot?.src ?? 'R');
                  setTgtHandle(anchorSnapshot?.tgt ?? 'L');
                }}
              />
            )}
          </div>

        </div>

        <div className="px-5 py-3 bg-surface-secondary/30 border-t border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 rounded transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('vfsEdgeAction.delete')}
            </button>
          </div>

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
