/**
 * InlineDomainPanel — docked contextual properties panel for a DOMAIN_ENTITY node:
 * the domain-model counterpart of InlineClassPanel.
 *
 * Edits live, one undo per commit (blur / Enter):
 *   · name
 *   · attributes (name list — add / rename / delete)
 *
 * Self-contained: resolves the active model (standalone localModel vs global) and
 * applies through the same ops the modal uses, so it needs only an element id.
 * The full props modal stays reachable via "Advanced…".
 */

import { useTranslation } from 'react-i18next';
import { useDismissOnOutsideClick } from '../../hooks/useDismissOnOutsideClick';
import { Plus, X, Settings2 } from 'lucide-react';
import { useModelStore } from '../../store/model.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { standaloneModelOps, getLocalModel } from '../../store/standaloneModelOps';
import type { SemanticModel, VFSFile, IRDomainAttribute } from '../../core/domain/vfs/vfs.types';

export interface InlineDomainPanelProps {
  /** Element id of the domain entity being edited. */
  elementId: string;
  /** Open the full modal editor. */
  onAdvanced: () => void;
  /** Close the panel. */
  onClose: () => void;
}

export default function InlineDomainPanel({ elementId, onAdvanced, onClose }: InlineDomainPanelProps) {
  const { t } = useTranslation();
  const dismissRef = useDismissOnOutsideClick<HTMLDivElement>(onClose);
  const globalModel = useModelStore((s) => s.model);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const isStandalone = useVFSStore((s): boolean => {
    if (!activeTabId || !s.project) return false;
    const node = s.project.nodes[activeTabId];
    return node?.type === 'FILE' && (node as VFSFile).standalone === true;
  });
  const localModel = useVFSStore((s): SemanticModel | null => {
    if (!activeTabId || !s.project) return null;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return (node as VFSFile).localModel ?? null;
  });

  const activeModel = isStandalone ? localModel : globalModel;
  const entity = activeModel?.domainEntities?.[elementId];
  if (!activeModel || !entity) return null;

  const ops = isStandalone && activeTabId ? standaloneModelOps(activeTabId) : useModelStore.getState();
  const freshModel = () => (isStandalone && activeTabId ? getLocalModel(activeTabId) : useModelStore.getState().model);

  const readAttrs = (): IRDomainAttribute[] => {
    const m = freshModel();
    const e = m?.domainEntities?.[elementId];
    return (e?.attributeIds ?? [])
      .map((id) => m?.domainAttributes?.[id])
      .filter((a): a is IRDomainAttribute => !!a);
  };
  const commit = (attrs: IRDomainAttribute[]) => ops.setDomainEntityAttributes(elementId, attrs);
  const patchAttr = (id: string, name: string) =>
    commit(readAttrs().map((a) => (a.id === id ? { ...a, name: name.trim() } : a)));
  const deleteAttr = (id: string) => commit(readAttrs().filter((a) => a.id !== id));
  const addAttr = (raw: string) => {
    const n = raw.trim();
    if (!n) return;
    commit([...readAttrs(), { id: crypto.randomUUID(), kind: 'DOMAIN_ATTRIBUTE', name: n }]);
  };

  const rename = (name: string) => {
    const n = name.trim();
    if (!n || n === entity.name) return;
    ops.updateDomainEntity(elementId, { name: n });
  };

  const fieldCls =
    'bg-surface-secondary border border-surface-border rounded px-1.5 py-1 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono';
  const delBtnCls = 'shrink-0 text-text-muted hover:text-red-400 transition-colors';

  const onAddKey = (add: (v: string) => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      add((e.target as HTMLInputElement).value);
      (e.target as HTMLInputElement).value = '';
    }
  };

  const attrs = readAttrs();

  return (
    <div
      ref={dismissRef}
      className="absolute right-4 top-16 z-30 pointer-events-auto w-72 max-h-[80vh] overflow-y-auto custom-scrollbar
                 rounded-xl border border-surface-border bg-surface-primary/97 shadow-2xl backdrop-blur-sm
                 animate-in fade-in slide-in-from-right-2 duration-150"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border sticky top-0 bg-surface-primary/97 backdrop-blur-sm">
        <input
          key={entity.name}
          defaultValue={entity.name}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`${fieldCls} flex-1 font-bold`}
          aria-label={t('inlineDomainPanel.name')}
        />
        <button onClick={onClose} title={t('inlineDomainPanel.close')} className="text-text-secondary hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <section className="space-y-1.5">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineDomainPanel.attributes')}</div>
          {attrs.map((a) => (
            <div key={`${a.id}:${a.name}`} className="flex items-center gap-1">
              <span className="text-text-muted text-xs font-mono shrink-0">•</span>
              <input defaultValue={a.name} onBlur={(e) => patchAttr(a.id, e.target.value)} placeholder="name" className={`${fieldCls} flex-1 min-w-0`} />
              <button className={delBtnCls} title={t('inlineDomainPanel.remove')} onClick={() => deleteAttr(a.id)}><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input placeholder={t('inlineDomainPanel.addAttribute')} onKeyDown={onAddKey(addAttr)} onBlur={(e) => { addAttr(e.target.value); e.target.value = ''; }} className={`${fieldCls} flex-1`} />
          </div>
        </section>

        <div className="border-t border-surface-border/50 pt-3">
          <button
            onClick={onAdvanced}
            title={t('inlineDomainPanel.advanced')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-surface-border bg-surface-secondary text-xs text-text-secondary hover:border-indigo-500 hover:text-indigo-400 transition-all ml-auto"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {t('inlineDomainPanel.advanced')}
          </button>
        </div>
      </div>
    </div>
  );
}
