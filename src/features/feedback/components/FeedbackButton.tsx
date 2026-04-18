import { Bug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../store/uiStore';

interface FeedbackButtonProps {
  /** When true renders as a compact icon-only button (e.g. inside UserMenu). */
  compact?: boolean;
  className?: string;
}

export default function FeedbackButton({ compact = false, className = '' }: FeedbackButtonProps) {
  const { t } = useTranslation();
  const openFeedback = useUiStore((s) => s.openFeedback);

  if (compact) {
    return (
      <button
        type="button"
        onClick={openFeedback}
        title={t('feedback.buttonTitle')}
        aria-label={t('feedback.buttonTitle')}
        className={`flex items-center justify-center w-7 h-7 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors ${className}`}
      >
        <Bug className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openFeedback}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors ${className}`}
    >
      <Bug className="w-4 h-4" />
      {t('feedback.buttonTitle')}
    </button>
  );
}
