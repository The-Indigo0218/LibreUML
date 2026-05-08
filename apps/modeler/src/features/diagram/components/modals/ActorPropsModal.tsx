import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRActor } from '../../../../core/domain/vfs/vfs.types';

export default function ActorPropsModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'actor-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId && project?.nodes[activeTabId] && (project.nodes[activeTabId] as any).standalone === true
  );

  const getActor = (): IRActor | null => {
    if (!editingId) return null;
    if (isStandalone && activeTabId) return getLocalModel(activeTabId)?.actors?.[editingId] ?? null;
    return useModelStore.getState().model?.actors?.[editingId] ?? null;
  };

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAbstract, setIsAbstract] = useState(false);
  const [actorType, setActorType] = useState<'human' | 'system' | 'timer'>('human');

  useEffect(() => {
    if (!isOpen) return;
    const a = getActor();
    if (!a) return;
    setName(a.name);
    setDescription(a.briefDescription ?? '');
    setIsAbstract(a.isAbstract ?? false);
    setActorType(a.actorType ?? 'human');
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch: Partial<IRActor> = {
      name: name.trim() || 'Actor',
      briefDescription: description || undefined,
      isAbstract,
      actorType,
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateActor(editingId, patch);
    } else {
      useModelStore.getState().updateActor(editingId, patch);
    }
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
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[#64748b] text-sm">Actor:</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent text-[#e2e8f0] text-base font-semibold focus:outline-none border-b border-transparent focus:border-[#7C83FF] transition-colors max-w-[200px]"
            />
          </div>
          <button onClick={closeModals} className="p-1 hover:bg-[#1e2738] rounded text-[#64748b] hover:text-[#e2e8f0] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-4">
          {/* Actor type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#60a5fa] mb-2">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['human', 'system', 'timer'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActorType(t)}
                  className={[
                    'py-1.5 rounded border text-xs font-medium transition-all capitalize',
                    actorType === t
                      ? 'border-[#7C83FF] bg-[#7C83FF]/10 text-[#7C83FF]'
                      : 'border-[#2a3358] text-[#64748b] hover:border-[#3d4a6e] hover:text-[#94a3b8]',
                  ].join(' ')}
                >
                  {t === 'human' ? '👤 Human' : t === 'system' ? '⚙️ System' : '⏱ Timer'}
                </button>
              ))}
            </div>
          </div>

          {/* Abstract */}
          <div className="flex items-center gap-3">
            <button
              role="switch"
              aria-checked={isAbstract}
              onClick={() => setIsAbstract((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${isAbstract ? 'bg-[#7C83FF]' : 'bg-[#2a3358]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isAbstract ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <label className="text-sm text-[#cbd5e1] select-none" onClick={() => setIsAbstract((v) => !v)}>
              Abstract <span className="text-[#475569] text-xs">(nombre en itálica)</span>
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#60a5fa] mb-1.5">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe el rol del actor en el sistema…"
              className="w-full px-2.5 py-1.5 bg-[#0f1419] border border-[#2a3358] rounded text-[#e2e8f0] text-sm placeholder-[#374151] focus:outline-none focus:border-[#7C83FF] resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-4 pb-4">
          <button onClick={closeModals} className="px-3 py-1.5 text-sm text-[#94a3b8] bg-[#1e2738] hover:bg-[#2a3358] rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-3 py-1.5 text-sm text-white bg-[#7C83FF] hover:bg-[#6366f1] rounded-lg transition-colors">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
