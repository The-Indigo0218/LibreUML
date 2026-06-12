import { useTranslation } from 'react-i18next';
import { X, Settings2, User, Cog, Timer } from 'lucide-react';
import { useModelStore } from '../../store/model.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { standaloneModelOps } from '../../store/standaloneModelOps';
import { useDismissOnOutsideClick } from '../../hooks/useDismissOnOutsideClick';
import type { SemanticModel, VFSFile, IRActor } from '../../core/domain/vfs/vfs.types';

type ActorType = NonNullable<IRActor['actorType']>;

const ACTOR_TYPES: { type: ActorType; Icon: typeof User; key: string }[] = [
  { type: 'human', Icon: User, key: 'human' },
  { type: 'system', Icon: Cog, key: 'system' },
  { type: 'timer', Icon: Timer, key: 'timer' },
];

export interface InlineActorPanelProps {
  elementId: string;
  onAdvanced: () => void;
  onClose: () => void;
}

export default function InlineActorPanel({ elementId, onAdvanced, onClose }: InlineActorPanelProps) {
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
  const actor = activeModel?.actors[elementId];
  if (!activeModel || !actor) return null;

  const ops = isStandalone && activeTabId ? standaloneModelOps(activeTabId) : useModelStore.getState();

  const rename = (name: string) => {
    const n = name.trim();
    if (!n || n === actor.name) return;
    ops.updateActor(elementId, { name: n });
  };
  const setType = (type: ActorType) => {
    if (type === (actor.actorType ?? 'human')) return;
    ops.updateActor(elementId, { actorType: type });
  };
  const toggleAbstract = () => ops.updateActor(elementId, { isAbstract: !actor.isAbstract });

  const fieldCls =
    'bg-surface-secondary border border-surface-border rounded px-1.5 py-1 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono';
  const currentType = actor.actorType ?? 'human';

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
          key={actor.name}
          defaultValue={actor.name}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`${fieldCls} flex-1 font-bold`}
          aria-label={t('inlineActorPanel.name')}
        />
        <button onClick={onClose} title={t('inlineActorPanel.close')} className="text-text-secondary hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <section className="space-y-1.5">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('inlineActorPanel.type')}</div>
          <div className="flex items-center gap-1">
            {ACTOR_TYPES.map(({ type, Icon, key }) => {
              const active = currentType === type;
              return (
                <button
                  key={key}
                  onClick={() => setType(type)}
                  title={t(`inlineActorPanel.type_${key}`)}
                  aria-label={t(`inlineActorPanel.type_${key}`)}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-xs transition-colors
                    ${active
                      ? 'border-indigo-500 bg-indigo-500/15 text-text-primary'
                      : 'border-surface-border bg-surface-secondary text-text-secondary hover:text-text-primary'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(`inlineActorPanel.type_${key}`)}
                </button>
              );
            })}
          </div>
        </section>

        <section className="border-t border-surface-border/50 pt-3">
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!actor.isAbstract}
              onChange={toggleAbstract}
              className="accent-indigo-500"
            />
            {t('inlineActorPanel.abstract')}
          </label>
        </section>

        <div className="border-t border-surface-border/50 pt-3">
          <button
            onClick={onAdvanced}
            title={t('inlineActorPanel.advanced')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-surface-border bg-surface-secondary text-xs text-text-secondary hover:border-indigo-500 hover:text-indigo-400 transition-all ml-auto"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {t('inlineActorPanel.advanced')}
          </button>
        </div>
      </div>
    </div>
  );
}
