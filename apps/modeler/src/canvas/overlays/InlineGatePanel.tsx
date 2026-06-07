/**
 * InlineGatePanel — docked contextual properties panel for a GATE element on a
 * sequence diagram.
 *
 * Edits live, one undo per commit (blur / Enter / change):
 *   · name
 *   · side
 *
 * Self-contained: resolves the active model (standalone localModel vs global) and
 * applies through the same ops the modal uses, so it needs only an element id.
 * The full props modal stays reachable via "Advanced…".
 */

import { useTranslation } from 'react-i18next';
import { X, Settings2 } from 'lucide-react';
import { useModelStore } from '../../store/model.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { standaloneModelOps } from '../../store/standaloneModelOps';
import type { SemanticModel, VFSFile } from '../../core/domain/vfs/vfs.types';

export interface InlineGatePanelProps {
  /** Element id of the gate being edited. */
  elementId: string;
  /** Open the full modal editor. */
  onAdvanced: () => void;
  /** Close the panel. */
  onClose: () => void;
}

export default function InlineGatePanel({ elementId, onAdvanced, onClose }: InlineGatePanelProps) {
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
  const gate = activeModel?.gates?.[elementId];
  if (!activeModel || !gate) return null;

  const ops = isStandalone && activeTabId ? standaloneModelOps(activeTabId) : useModelStore.getState();

  const rename = (name: string) => {
    const n = name.trim();
    if (!n || n === gate.name) return;
    ops.updateGate(elementId, { name: n });
  };
  const changeSide = (side: 'LEFT' | 'RIGHT') => {
    ops.updateGate(elementId, { side });
  };

  const fieldCls =
    'bg-surface-secondary border border-surface-border rounded px-1.5 py-1 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono';

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
          key={gate.name}
          defaultValue={gate.name}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`${fieldCls} flex-1 font-bold`}
          aria-label={t('inlineGatePanel.name')}
        />
        <button onClick={onClose} title={t('inlineGatePanel.close')} className="text-text-secondary hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <section className="space-y-1.5">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineGatePanel.side')}</div>
          <select
            value={gate.side}
            onChange={(e) => changeSide(e.target.value as 'LEFT' | 'RIGHT')}
            className={`${fieldCls} w-full`}
            aria-label={t('inlineGatePanel.side')}
          >
            <option value="LEFT">LEFT</option>
            <option value="RIGHT">RIGHT</option>
          </select>
        </section>

        <div className="border-t border-surface-border/50 pt-3">
          <button
            onClick={onAdvanced}
            title={t('inlineGatePanel.advanced')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-surface-border bg-surface-secondary text-xs text-text-secondary hover:border-indigo-500 hover:text-indigo-400 transition-all ml-auto"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {t('inlineGatePanel.advanced')}
          </button>
        </div>
      </div>
    </div>
  );
}
