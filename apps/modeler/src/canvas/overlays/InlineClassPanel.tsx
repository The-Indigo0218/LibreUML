/**
 * InlineClassPanel — docked contextual properties panel for the selected
 * classifier (R9): a CLASS, INTERFACE or ENUM node.
 *
 * The classifier-level counterpart of InlineEdgePanel: instead of opening the full
 * SSoTClassEditorModal for the frequent edits, this panel docks to the right of
 * the canvas and edits live —
 *   · CLASS / INTERFACE → name + attributes + operations
 *   · ENUM              → name + literals
 * Each change is one undo entry (committed on blur / Enter / visibility toggle).
 *
 * Parameters, type-derived relations and stereotypes stay in the modal, reachable
 * via the "Advanced…" button.
 *
 * Self-contained — resolves the active model (standalone localModel vs global) and
 * applies through the same ops the modal uses, so it needs only an element id.
 *
 * Uncontrolled inputs are keyed on the member signature so an external change
 * (undo, modal edit) refreshes the field, while in-progress typing is untouched.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Settings2, ChevronRight, ChevronDown } from 'lucide-react';
import { useModelStore } from '../../store/model.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { standaloneModelOps, getLocalModel } from '../../store/standaloneModelOps';
import type {
  SemanticModel,
  VFSFile,
  IRAttribute,
  IROperation,
  IRParameter,
  IREnumLiteral,
  Visibility,
} from '../../core/domain/vfs/vfs.types';

const VIS_SYMBOL: Record<Visibility, string> = {
  public: '+',
  private: '−',
  protected: '#',
  package: '~',
};
const VIS_CYCLE: Visibility[] = ['public', 'private', 'protected', 'package'];

function nextVis(v: Visibility | undefined): Visibility {
  const i = VIS_CYCLE.indexOf(v ?? 'private');
  return VIS_CYCLE[(i + 1) % VIS_CYCLE.length];
}

export interface InlineClassPanelProps {
  /** Element id of the classifier being edited (also part of the parent key). */
  elementId: string;
  /** Open the full modal editor (params, types, relations). */
  onAdvanced: () => void;
  /** Close the panel. */
  onClose: () => void;
}

export default function InlineClassPanel({ elementId, onAdvanced, onClose }: InlineClassPanelProps) {
  const { t } = useTranslation();
  /** Operation whose parameter list is expanded inline (null = all collapsed). */
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const globalModel = useModelStore((s) => s.model);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const isStandalone = useVFSStore((s): boolean => {
    if (!activeTabId || !s.project) return false;
    const node = s.project.nodes[activeTabId];
    return node?.type === 'FILE' && (node as VFSFile).standalone === true;
  });
  // Subscribe to the standalone localModel so the panel re-renders on live edits.
  const localModel = useVFSStore((s): SemanticModel | null => {
    if (!activeTabId || !s.project) return null;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return (node as VFSFile).localModel ?? null;
  });

  const activeModel = isStandalone ? localModel : globalModel;
  const cls = activeModel?.classes[elementId];
  const iface = activeModel?.interfaces[elementId];
  const enm = activeModel?.enums[elementId];
  const classifier = cls ?? iface ?? enm;
  if (!activeModel || !classifier) return null;

  // Ops object — same surface for standalone and global paths (both undoable).
  const ops = isStandalone && activeTabId ? standaloneModelOps(activeTabId) : useModelStore.getState();
  const freshModel = () => (isStandalone && activeTabId ? getLocalModel(activeTabId) : useModelStore.getState().model);

  const rename = (name: string) => {
    const n = name.trim();
    if (!n || n === classifier.name) return;
    if (cls) ops.updateClass(elementId, { name: n });
    else if (iface) ops.updateInterface(elementId, { name: n });
    else ops.updateEnum(elementId, { name: n });
  };

  const fieldCls =
    'bg-surface-secondary border border-surface-border rounded px-1.5 py-1 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono';
  const visBtnCls =
    'w-5 h-6 shrink-0 rounded text-xs font-bold font-mono text-indigo-400 hover:bg-surface-hover transition-colors';
  const delBtnCls = 'shrink-0 text-text-muted hover:text-red-400 transition-colors';

  const onAddKey = (add: (v: string) => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      add((e.target as HTMLInputElement).value);
      (e.target as HTMLInputElement).value = '';
    }
  };

  // ── CLASS / INTERFACE: attributes + operations ─────────────────────────────
  const renderMembers = () => {
    const readMembers = (): { attrs: IRAttribute[]; opsList: IROperation[] } => {
      const m = freshModel();
      const c = m?.classes[elementId] ?? m?.interfaces[elementId];
      const attrs = (c?.attributeIds ?? []).map((id) => m!.attributes[id]).filter((a): a is IRAttribute => !!a);
      const opsList = (c?.operationIds ?? []).map((id) => m!.operations[id]).filter((o): o is IROperation => !!o);
      return { attrs, opsList };
    };
    const commitAttrs = (attrs: IRAttribute[]) => ops.setElementMembers(elementId, attrs, readMembers().opsList);
    const commitOps = (opsList: IROperation[]) => ops.setElementMembers(elementId, readMembers().attrs, opsList);

    const patchAttr = (id: string, patch: Partial<IRAttribute>) =>
      commitAttrs(readMembers().attrs.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const deleteAttr = (id: string) => commitAttrs(readMembers().attrs.filter((a) => a.id !== id));
    const addAttr = (name: string) => {
      const n = name.trim();
      if (!n) return;
      commitAttrs([...readMembers().attrs, { id: crypto.randomUUID(), kind: 'ATTRIBUTE', name: n, type: 'String', visibility: 'private' }]);
    };
    const patchOp = (id: string, patch: Partial<IROperation>) =>
      commitOps(readMembers().opsList.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    const deleteOp = (id: string) => commitOps(readMembers().opsList.filter((o) => o.id !== id));
    const addOp = (name: string) => {
      const n = name.trim();
      if (!n) return;
      commitOps([...readMembers().opsList, { id: crypto.randomUUID(), kind: 'OPERATION', name: n, returnType: 'void', visibility: 'public', parameters: [] }]);
    };

    // ── Operation parameters (R9 #1) — read/commit fresh, one undo each ──
    const readParams = (opId: string): IRParameter[] =>
      readMembers().opsList.find((o) => o.id === opId)?.parameters ?? [];
    const patchParam = (opId: string, i: number, patch: Partial<IRParameter>) => {
      const ps = readParams(opId).slice();
      if (!ps[i]) return;
      ps[i] = { ...ps[i], ...patch };
      patchOp(opId, { parameters: ps });
    };
    const deleteParam = (opId: string, i: number) =>
      patchOp(opId, { parameters: readParams(opId).filter((_, idx) => idx !== i) });
    const addParam = (opId: string, raw: string) => {
      const n = raw.trim();
      if (!n) return;
      patchOp(opId, { parameters: [...readParams(opId), { name: n, type: 'String' }] });
    };

    const { attrs, opsList } = readMembers();
    return (
      <>
        <section className="space-y-1.5">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineClassPanel.attributes')}</div>
          {attrs.map((a) => (
            <div key={`${a.id}:${a.name}:${a.type}:${a.visibility}`} className="flex items-center gap-1">
              <button className={visBtnCls} title={a.visibility ?? 'private'} onClick={() => patchAttr(a.id, { visibility: nextVis(a.visibility) })}>
                {VIS_SYMBOL[a.visibility ?? 'private']}
              </button>
              <input defaultValue={a.name} onBlur={(e) => patchAttr(a.id, { name: e.target.value })} placeholder="name" className={`${fieldCls} flex-1 min-w-0`} />
              <span className="text-text-muted text-xs">:</span>
              <input defaultValue={a.type} onBlur={(e) => patchAttr(a.id, { type: e.target.value })} placeholder="type" className={`${fieldCls} w-20`} />
              <button className={delBtnCls} title={t('inlineClassPanel.remove')} onClick={() => deleteAttr(a.id)}><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input placeholder={t('inlineClassPanel.addAttribute')} onKeyDown={onAddKey(addAttr)} onBlur={(e) => { addAttr(e.target.value); e.target.value = ''; }} className={`${fieldCls} flex-1`} />
          </div>
        </section>

        <section className="space-y-1.5 border-t border-surface-border/50 pt-3">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineClassPanel.operations')}</div>
          {opsList.map((o) => {
            const expanded = expandedOpId === o.id;
            const params = o.parameters ?? [];
            return (
            <div key={`${o.id}:${o.name}:${o.returnType}:${o.visibility}`} className="space-y-1">
              <div className="flex items-center gap-1">
                <button className={visBtnCls} title={o.visibility ?? 'public'} onClick={() => patchOp(o.id, { visibility: nextVis(o.visibility) })}>
                  {VIS_SYMBOL[o.visibility ?? 'public']}
                </button>
                <input defaultValue={o.name} onBlur={(e) => patchOp(o.id, { name: e.target.value })} placeholder="name" className={`${fieldCls} flex-1 min-w-0`} />
                <button
                  className="shrink-0 flex items-center gap-0.5 text-text-muted hover:text-indigo-400 transition-colors text-[10px] font-mono"
                  title={t('inlineClassPanel.parameters')}
                  onClick={() => setExpandedOpId(expanded ? null : o.id)}
                >
                  {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  ({params.length})
                </button>
                <span className="text-text-muted text-xs">:</span>
                <input defaultValue={o.returnType ?? 'void'} onBlur={(e) => patchOp(o.id, { returnType: e.target.value })} placeholder="type" className={`${fieldCls} w-16`} />
                <button className={delBtnCls} title={t('inlineClassPanel.remove')} onClick={() => deleteOp(o.id)}><X className="w-3.5 h-3.5" /></button>
              </div>
              {expanded && (
                <div className="ml-6 pl-1.5 border-l border-surface-border/60 space-y-1">
                  {params.map((p, i) => (
                    <div key={`${i}:${p.name}:${p.type}`} className="flex items-center gap-1">
                      <input defaultValue={p.name} onBlur={(e) => patchParam(o.id, i, { name: e.target.value })} placeholder={t('inlineClassPanel.paramName')} className={`${fieldCls} flex-1 min-w-0`} />
                      <span className="text-text-muted text-xs">:</span>
                      <input defaultValue={p.type} onBlur={(e) => patchParam(o.id, i, { type: e.target.value })} placeholder="type" className={`${fieldCls} w-16`} />
                      <button className={delBtnCls} title={t('inlineClassPanel.remove')} onClick={() => deleteParam(o.id, i)}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <Plus className="w-3 h-3 text-text-muted shrink-0" />
                    <input placeholder={t('inlineClassPanel.addParameter')} onKeyDown={onAddKey((v) => addParam(o.id, v))} onBlur={(e) => { addParam(o.id, e.target.value); e.target.value = ''; }} className={`${fieldCls} flex-1`} />
                  </div>
                </div>
              )}
            </div>
            );
          })}
          <div className="flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input placeholder={t('inlineClassPanel.addOperation')} onKeyDown={onAddKey(addOp)} onBlur={(e) => { addOp(e.target.value); e.target.value = ''; }} className={`${fieldCls} flex-1`} />
          </div>
        </section>
      </>
    );
  };

  // ── ENUM: literals ─────────────────────────────────────────────────────────
  const renderLiterals = () => {
    const readLiterals = (): IREnumLiteral[] => freshModel()?.enums[elementId]?.literals ?? [];
    const commit = (literals: IREnumLiteral[]) => ops.updateEnum(elementId, { literals });
    const patchLit = (i: number, name: string) => {
      const n = name.trim();
      const lits = readLiterals().slice();
      if (!lits[i]) return;
      lits[i] = { ...lits[i], name: n };
      commit(lits);
    };
    const deleteLit = (i: number) => commit(readLiterals().filter((_, idx) => idx !== i));
    const addLit = (name: string) => {
      const n = name.trim();
      if (!n) return;
      commit([...readLiterals(), { name: n }]);
    };

    const literals = readLiterals();
    return (
      <section className="space-y-1.5">
        <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineClassPanel.literals')}</div>
        {literals.map((l, i) => (
          <div key={`${i}:${l.name}`} className="flex items-center gap-1">
            <span className="text-text-muted text-xs font-mono shrink-0">•</span>
            <input defaultValue={l.name} onBlur={(e) => patchLit(i, e.target.value)} placeholder="LITERAL" className={`${fieldCls} flex-1 min-w-0`} />
            <button className={delBtnCls} title={t('inlineClassPanel.remove')} onClick={() => deleteLit(i)}><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input placeholder={t('inlineClassPanel.addLiteral')} onKeyDown={onAddKey(addLit)} onBlur={(e) => { addLit(e.target.value); e.target.value = ''; }} className={`${fieldCls} flex-1`} />
        </div>
      </section>
    );
  };

  return (
    <div
      className="absolute right-4 top-16 z-30 pointer-events-auto w-80 max-h-[80vh] overflow-y-auto custom-scrollbar
                 rounded-xl border border-surface-border bg-surface-primary/97 shadow-2xl backdrop-blur-sm
                 animate-in fade-in slide-in-from-right-2 duration-150"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header — classifier name */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border sticky top-0 bg-surface-primary/97 backdrop-blur-sm">
        {/* Abstract toggle (R9 #1) — class only; flips CLASS ↔ ABSTRACT_CLASS. */}
        {cls && (
          <button
            onClick={() => ops.updateClass(elementId, { isAbstract: !cls.isAbstract })}
            title={t('inlineClassPanel.abstract')}
            aria-pressed={!!cls.isAbstract}
            className={`shrink-0 w-6 h-6 rounded text-sm font-bold italic transition-colors ${
              cls.isAbstract ? 'bg-indigo-500/20 text-indigo-400' : 'text-text-muted hover:bg-surface-hover'
            }`}
          >
            A
          </button>
        )}
        {/* key on the stored name so an external change (undo / modal) refreshes the
            field, while in-progress typing (uncontrolled) is left untouched. */}
        <input
          key={classifier.name}
          defaultValue={classifier.name}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`${fieldCls} flex-1 font-bold`}
          aria-label={t('inlineClassPanel.name')}
        />
        <button onClick={onClose} title={t('inlineClassPanel.close')} className="text-text-secondary hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {enm ? renderLiterals() : renderMembers()}

        {/* Footer */}
        <div className="border-t border-surface-border/50 pt-3">
          <button
            onClick={onAdvanced}
            title={t('inlineClassPanel.advanced')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-surface-border bg-surface-secondary text-xs text-text-secondary hover:border-indigo-500 hover:text-indigo-400 transition-all ml-auto"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {t('inlineClassPanel.advanced')}
          </button>
        </div>
      </div>
    </div>
  );
}
