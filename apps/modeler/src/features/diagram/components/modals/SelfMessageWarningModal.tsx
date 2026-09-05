import { CornerUpLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../../store/uiStore';
import { insertSelfMessageIntoActiveDiagram } from '../../services/sequenceInserts';

/**
 * Confirms creating a self-message that does not fall inside any active execution
 * on the lifeline (a call modelled with no caller context). Creating it anyway
 * makes a stray top-level execution — usually a sign the user dropped it on the
 * wrong spot — so we ask first. Confirm re-runs the insert with `force`, which
 * then opens the message props modal so the user can name it.
 */
export default function SelfMessageWarningModal() {
  const { t } = useTranslation();
  const activeModal = useUiStore((s) => s.activeModal);
  const pending = useUiStore((s) => s.pendingSelfMessage);
  const closeModals = useUiStore((s) => s.closeModals);

  if (activeModal !== 'self-message-warning' || !pending) return null;

  const onConfirm = () => {
    // force=true skips the validation and opens the props modal for naming, which
    // replaces this warning (activeModal transitions away).
    insertSelfMessageIntoActiveDiagram(pending.lifelineId, pending.dropY, true);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-96 max-w-full m-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-amber-400">
          <div className="p-2 bg-amber-400/10 rounded-full">
            <CornerUpLeft className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">
            {t('selfMessageWarning.title')}
          </h3>
        </div>

        <p className="text-text-secondary text-sm mb-6 leading-relaxed">
          {t('selfMessageWarning.body')}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={closeModals}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
          >
            {t('selfMessageWarning.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-md shadow-lg shadow-amber-500/20 transition-all"
          >
            {t('selfMessageWarning.createAnyway')}
          </button>
        </div>
      </div>
    </div>
  );
}
