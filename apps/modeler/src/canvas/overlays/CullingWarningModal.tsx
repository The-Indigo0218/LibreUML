import { Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CullingWarningModalProps {
  isOpen: boolean;
  nodeCount: number;
  onEnable: () => void;
  onDismiss: () => void;
  onDontShowAgain: () => void;
}

export default function CullingWarningModal({
  isOpen,
  nodeCount,
  onEnable,
  onDismiss,
  onDontShowAgain,
}: CullingWarningModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-96 max-w-full m-4 animate-in zoom-in-95 duration-200">

        <div className="flex items-center gap-3 mb-4 text-amber-400">
          <div className="p-2 bg-amber-400/10 rounded-full">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">
            {t('cullingWarning.title')}
          </h3>
        </div>

        <p className="text-text-secondary text-sm mb-1 leading-relaxed">
          {t('cullingWarning.body1', { count: nodeCount })}
        </p>
        <p className="text-text-secondary text-sm mb-6 leading-relaxed">
          {t('cullingWarning.body2')}
        </p>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onDontShowAgain}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors shrink-0"
          >
            {t('cullingWarning.dontShowAgain')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
            >
              {t('cullingWarning.maybeLater')}
            </button>
            <button
              onClick={onEnable}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-lg shadow-blue-500/20 transition-all"
            >
              {t('cullingWarning.enable')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
