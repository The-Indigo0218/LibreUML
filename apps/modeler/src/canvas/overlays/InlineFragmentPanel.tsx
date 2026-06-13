/**
 * InlineFragmentPanel — docked contextual properties panel for a sequence-diagram
 * combined FRAGMENT: the inline counterpart of FragmentPropertiesModal.
 *
 * Edits live, one undo per commit (change / blur):
 *   · fragmentKind (ALT / OPT / LOOP / PAR / SEQ / BREAK / CRITICAL)
 *   · operand guards (rename in place)
 *
 * Self-contained: resolves the active model (standalone localModel vs global) and
 * applies through the same ops the modal uses, so it needs only an element id.
 * Add / remove operand (which carries message-migration logic) stays in the full
 * modal, reachable via "Advanced…".
 */

import { useTranslation } from 'react-i18next';
import { useDismissOnOutsideClick } from '../../hooks/useDismissOnOutsideClick';
import { X, Settings2 } from 'lucide-react';
import { useModelStore } from '../../store/model.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { standaloneModelOps, getLocalModel } from '../../store/standaloneModelOps';
import type {
  SemanticModel,
  VFSFile,
  IRInteractionFragment,
  IRInteractionOperand,
} from '../../core/domain/vfs/vfs.types';
import { FRAGMENT_KINDS } from '../../core/domain/vfs/vfs.types';

export interface InlineFragmentPanelProps {
  /** Element id of the interaction fragment being edited. */
  elementId: string;
  /** Open the full modal editor. */
  onAdvanced: () => void;
  /** Close the panel. */
  onClose: () => void;
}

export default function InlineFragmentPanel({ elementId, onAdvanced, onClose }: InlineFragmentPanelProps) {
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
  const fragment = activeModel?.interactionFragments?.[elementId];
  if (!activeModel || !fragment) return null;

  const ops = isStandalone && activeTabId ? standaloneModelOps(activeTabId) : useModelStore.getState();
  const freshModel = () => (isStandalone && activeTabId ? getLocalModel(activeTabId) : useModelStore.getState().model);

  const readOperands = (): IRInteractionOperand[] =>
    freshModel()?.interactionFragments?.[elementId]?.operands ?? [];

  const patchGuard = (opId: string, value: string) =>
    ops.updateFragment(elementId, {
      operands: readOperands().map((o) => (o.id === opId ? { ...o, guard: value } : o)),
    });

  const setKind = (kind: IRInteractionFragment['fragmentKind']) =>
    ops.updateFragment(elementId, { fragmentKind: kind });

  const fieldCls =
    'bg-surface-secondary border border-surface-border rounded px-1.5 py-1 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono';

  const operands = fragment.operands;

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
        <select
          value={fragment.fragmentKind}
          onChange={(e) => setKind(e.target.value as IRInteractionFragment['fragmentKind'])}
          className={`${fieldCls} flex-1 font-bold`}
          aria-label={t('inlineFragmentPanel.kind')}
        >
          {FRAGMENT_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <button onClick={onClose} title={t('inlineFragmentPanel.close')} className="text-text-secondary hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <section className="space-y-1.5">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineFragmentPanel.operands')}</div>
          {operands.map((op, idx) => (
            <div key={`${op.id}:${op.guard}`} className="flex items-center gap-1">
              <span className="text-text-muted text-xs font-mono shrink-0">{idx + 1}</span>
              <input
                defaultValue={op.guard ?? ''}
                onBlur={(e) => patchGuard(op.id, e.target.value)}
                placeholder={t('inlineFragmentPanel.guard')}
                className={`${fieldCls} flex-1 min-w-0`}
              />
            </div>
          ))}
        </section>

        <div className="border-t border-surface-border/50 pt-3">
          <button
            onClick={onAdvanced}
            title={t('inlineFragmentPanel.advanced')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-surface-border bg-surface-secondary text-xs text-text-secondary hover:border-indigo-500 hover:text-indigo-400 transition-all ml-auto"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {t('inlineFragmentPanel.advanced')}
          </button>
        </div>
      </div>
    </div>
  );
}
