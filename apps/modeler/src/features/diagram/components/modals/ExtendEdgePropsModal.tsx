import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useVFSStore } from '../../../../store/vfsStore';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';

export default function ExtendEdgePropsModal() {
  const { t } = useTranslation();
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'extend-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId && project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as { standalone?: boolean }).standalone === true
  );

  const getRelation = () => {
    if (!editingId) return null;
    if (isStandalone && activeTabId) return getLocalModel(activeTabId)?.relations?.[editingId] ?? null;
    return useModelStore.getState().model?.relations?.[editingId] ?? null;
  };

  const getBaseUseCase = (targetId: string) => {
    if (isStandalone && activeTabId) return getLocalModel(activeTabId)?.useCases?.[targetId] ?? null;
    return useModelStore.getState().model?.useCases?.[targetId] ?? null;
  };

  const getExtendingUseCase = (sourceId: string) => {
    if (isStandalone && activeTabId) return getLocalModel(activeTabId)?.useCases?.[sourceId] ?? null;
    return useModelStore.getState().model?.useCases?.[sourceId] ?? null;
  };

  const [condition, setCondition] = useState('');
  const [extensionPoint, setExtensionPoint] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const rel = getRelation();
    if (!rel) return;
    setCondition(rel.condition ?? '');
    setExtensionPoint(rel.extensionPoint ?? '');
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const relation = getRelation();
  if (!relation) return null;

  const extendingUC = getExtendingUseCase(relation.sourceId);
  const baseUC = getBaseUseCase(relation.targetId);
  const availableExtensionPoints = baseUC?.extensionPoints ?? [];

  const handleSave = () => {
    if (!editingId) return;
    const patch = {
      condition: condition.trim() || undefined,
      extensionPoint: extensionPoint.trim() || undefined,
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateRelation(editingId, patch);
    } else {
      useModelStore.getState().updateRelation(editingId, patch);
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358]">
          <div>
            <p className="text-xs text-[#475569] font-mono italic">«extend»</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              {t('extend.title')}
            </h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Relationship summary */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] bg-[#0f1623] rounded px-3 py-2">
            <span className="text-[#7C83FF] font-medium truncate">{extendingUC?.name ?? '—'}</span>
            <span className="shrink-0">→</span>
            <span className="text-[#94a3b8] font-medium truncate">{baseUC?.name ?? '—'}</span>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
              {t('extend.condition')}
            </label>
            <textarea
              className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-2
                         text-sm text-[#e2e8f0] placeholder-[#475569] resize-none
                         focus:outline-none focus:border-[#7C83FF] transition-colors"
              rows={2}
              placeholder={t('extend.condition.placeholder')}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              autoFocus
            />
          </div>

          {/* Extension point */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
              {t('extend.extensionPoint')}
            </label>
            {availableExtensionPoints.length > 0 ? (
              <select
                className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-2
                           text-sm text-[#e2e8f0] focus:outline-none focus:border-[#7C83FF] transition-colors"
                value={extensionPoint}
                onChange={(e) => setExtensionPoint(e.target.value)}
              >
                <option value="">{t('extend.extensionPoint.none')}</option>
                {availableExtensionPoints.map((ep) => (
                  <option key={ep} value={ep}>{ep}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-2
                           text-sm text-[#e2e8f0] placeholder-[#475569]
                           focus:outline-none focus:border-[#7C83FF] transition-colors"
                placeholder={t('extend.extensionPoint.placeholder')}
                value={extensionPoint}
                onChange={(e) => setExtensionPoint(e.target.value)}
              />
            )}
            {availableExtensionPoints.length === 0 && (
              <p className="mt-1 text-[10px] text-[#475569]">
                {t('extend.extensionPoint.hint', { name: baseUC?.name ?? '' })}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            onClick={closeModals}
            className="px-3 py-1.5 rounded text-xs text-[#64748b] hover:text-[#94a3b8]
                       hover:bg-[#1e2738] transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[#7C83FF]
                       hover:bg-[#9499ff] text-white transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
