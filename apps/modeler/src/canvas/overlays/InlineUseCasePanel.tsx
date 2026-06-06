/**
 * InlineUseCasePanel — docked contextual properties panel for a USECASE node:
 * the use-case counterpart of InlineClassPanel.
 *
 * Edits live, one undo per commit (blur / Enter):
 *   · name
 *   · brief description
 *   · extension points (add / rename / delete)
 *
 * The rich spec (basic / alternative flows, pre/postconditions, trigger) stays in
 * the full modal, reachable via "Advanced…".
 *
 * Self-contained: resolves the active model (standalone localModel vs global) and
 * applies through the same op the modal uses (updateUseCase), undoable.
 */

import { useTranslation } from 'react-i18next';
import { Plus, X, Settings2 } from 'lucide-react';
import { useModelStore } from '../../store/model.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { standaloneModelOps, getLocalModel } from '../../store/standaloneModelOps';
import type { SemanticModel, VFSFile } from '../../core/domain/vfs/vfs.types';

export interface InlineUseCasePanelProps {
  /** Element id of the use case being edited. */
  elementId: string;
  /** Open the full spec modal (flows, pre/postconditions, trigger). */
  onAdvanced: () => void;
  /** Close the panel. */
  onClose: () => void;
}

export default function InlineUseCasePanel({ elementId, onAdvanced, onClose }: InlineUseCasePanelProps) {
  const { t } = useTranslation();
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
  const uc = activeModel?.useCases[elementId];
  if (!activeModel || !uc) return null;

  const ops = isStandalone && activeTabId ? standaloneModelOps(activeTabId) : useModelStore.getState();
  const freshUC = () => (isStandalone && activeTabId ? getLocalModel(activeTabId) : useModelStore.getState().model)?.useCases[elementId];

  const rename = (name: string) => {
    const n = name.trim();
    if (!n || n === uc.name) return;
    ops.updateUseCase(elementId, { name: n });
  };
  const setBrief = (text: string) => {
    if (text === (uc.briefDescription ?? '')) return;
    ops.updateUseCase(elementId, { briefDescription: text });
  };

  const readEP = (): string[] => freshUC()?.extensionPoints ?? [];
  const commitEP = (eps: string[]) => ops.updateUseCase(elementId, { extensionPoints: eps });
  const patchEP = (i: number, name: string) => {
    const eps = readEP().slice();
    if (eps[i] === undefined) return;
    eps[i] = name.trim();
    commitEP(eps);
  };
  const deleteEP = (i: number) => commitEP(readEP().filter((_, idx) => idx !== i));
  const addEP = (raw: string) => {
    const n = raw.trim();
    if (!n) return;
    commitEP([...readEP(), n]);
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

  const eps = readEP();

  return (
    <div
      className="absolute right-4 top-16 z-30 pointer-events-auto w-72 max-h-[80vh] overflow-y-auto custom-scrollbar
                 rounded-xl border border-surface-border bg-surface-primary/97 shadow-2xl backdrop-blur-sm
                 animate-in fade-in slide-in-from-right-2 duration-150"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border sticky top-0 bg-surface-primary/97 backdrop-blur-sm">
        <input
          key={uc.name}
          defaultValue={uc.name}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`${fieldCls} flex-1 font-bold`}
          aria-label={t('inlineUseCasePanel.name')}
        />
        <button onClick={onClose} title={t('inlineUseCasePanel.close')} className="text-text-secondary hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <section className="space-y-1.5">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineUseCasePanel.brief')}</div>
          <textarea
            key={`brief:${uc.briefDescription ?? ''}`}
            defaultValue={uc.briefDescription ?? ''}
            onBlur={(e) => setBrief(e.target.value)}
            placeholder={t('inlineUseCasePanel.briefPlaceholder')}
            rows={3}
            className={`${fieldCls} w-full resize-none font-sans`}
          />
        </section>

        <section className="space-y-1.5 border-t border-surface-border/50 pt-3">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineUseCasePanel.extensionPoints')}</div>
          {eps.map((ep, i) => (
            <div key={`${i}:${ep}`} className="flex items-center gap-1">
              <span className="text-text-muted text-xs font-mono shrink-0">•</span>
              <input defaultValue={ep} onBlur={(e) => patchEP(i, e.target.value)} placeholder="name" className={`${fieldCls} flex-1 min-w-0`} />
              <button className={delBtnCls} title={t('inlineUseCasePanel.remove')} onClick={() => deleteEP(i)}><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input placeholder={t('inlineUseCasePanel.addExtensionPoint')} onKeyDown={onAddKey(addEP)} onBlur={(e) => { addEP(e.target.value); e.target.value = ''; }} className={`${fieldCls} flex-1`} />
          </div>
        </section>

        <div className="border-t border-surface-border/50 pt-3">
          <button
            onClick={onAdvanced}
            title={t('inlineUseCasePanel.advanced')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-surface-border bg-surface-secondary text-xs text-text-secondary hover:border-indigo-500 hover:text-indigo-400 transition-all ml-auto"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {t('inlineUseCasePanel.advanced')}
          </button>
        </div>
      </div>
    </div>
  );
}
