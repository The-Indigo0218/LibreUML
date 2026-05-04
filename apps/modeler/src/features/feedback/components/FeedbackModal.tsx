import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Bug, MessageSquare, HelpCircle, RefreshCw, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { submitReport } from '../../../api/reports.api';
import type { ReportType } from '../../../api/types';
import { captureCanvasScreenshot, dataUrlToBase64 } from '../utils/captureScreenshot';
import { useToastStore } from '../../../store/toast.store';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { useTelemetry } from '../../telemetry/hooks/useTelemetry';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_TITLE = 200;
const MAX_DESC = 5000;

const REPORT_TYPES: { value: ReportType; labelKey: string; icon: React.ReactNode }[] = [
  { value: 'BUG', labelKey: 'feedback.types.bug', icon: <Bug className="w-4 h-4" /> },
  { value: 'FEEDBACK', labelKey: 'feedback.types.feedback', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'OTHER', labelKey: 'feedback.types.other', icon: <HelpCircle className="w-4 h-4" /> },
];

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t } = useTranslation();
  const { track } = useTelemetry();
  const showToast = useToastStore((s) => s.show);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);

  const [reportType, setReportType] = useState<ReportType>('BUG');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  const didCapture = useRef(false);

  // Auto-capture on open
  useEffect(() => {
    if (!isOpen) {
      // Reset on close
      setTitle('');
      setDescription('');
      setReportType('BUG');
      setScreenshot(null);
      setErrors({});
      didCapture.current = false;
      return;
    }
    if (didCapture.current) return;
    didCapture.current = true;
    void captureScreenshot();
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  async function captureScreenshot() {
    setScreenshotLoading(true);
    const result = await captureCanvasScreenshot();
    setScreenshot(result);
    setScreenshotLoading(false);
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!title.trim()) errs.title = t('feedback.errors.titleRequired');
    else if (title.length > MAX_TITLE) errs.title = t('feedback.errors.titleTooLong', { max: MAX_TITLE });
    if (!description.trim()) errs.description = t('feedback.errors.descriptionRequired');
    else if (description.length > MAX_DESC) errs.description = t('feedback.errors.descriptionTooLong', { max: MAX_DESC });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const evidenceImages: string[] = [];
      if (includeScreenshot && screenshot) {
        evidenceImages.push(dataUrlToBase64(screenshot));
      }

      // Collect metadata as part of the description
      const meta = [
        `**Diagram ID:** ${activeTabId ?? 'none'}`,
        `**Viewport:** ${window.innerWidth}×${window.innerHeight}`,
        `**User Agent:** ${navigator.userAgent}`,
      ].join('\n');

      await submitReport({
        type: reportType,
        title: title.trim(),
        description: `${description.trim()}\n\n---\n${meta}`,
        evidenceImages: evidenceImages.length > 0 ? evidenceImages : undefined,
      });

      track('feedback_submitted', { type: reportType });
      showToast(t('feedback.toast.sent'));
      onClose();
    } catch {
      showToast(t('feedback.toast.error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">{t('feedback.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label={t('feedback.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">

          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">
              {t('feedback.typeLabel')}
            </label>
            <div className="flex gap-2">
              {REPORT_TYPES.map(({ value, labelKey, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReportType(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                    reportType === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-surface-secondary text-text-secondary border-surface-border hover:bg-surface-hover'
                  }`}
                >
                  {icon}
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1 uppercase tracking-wide">
              {t('feedback.titleLabel')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              placeholder={t('feedback.titlePlaceholder')}
              className={`w-full bg-surface-secondary border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                errors.title ? 'border-red-500' : 'border-surface-border'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.title ? (
                <span className="text-xs text-red-400">{errors.title}</span>
              ) : (
                <span />
              )}
              <span className="text-xs text-text-muted">{title.length}/{MAX_TITLE}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1 uppercase tracking-wide">
              {t('feedback.descriptionLabel')} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESC}
              rows={4}
              placeholder={t('feedback.descriptionPlaceholder')}
              className={`w-full bg-surface-secondary border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-colors ${
                errors.description ? 'border-red-500' : 'border-surface-border'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.description ? (
                <span className="text-xs text-red-400">{errors.description}</span>
              ) : (
                <span />
              )}
              <span className="text-xs text-text-muted">{description.length}/{MAX_DESC}</span>
            </div>
          </div>

          {/* Screenshot */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                {t('feedback.screenshotLabel')}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { didCapture.current = false; void captureScreenshot(); }}
                  disabled={screenshotLoading}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                  title={t('feedback.recapture')}
                >
                  <RefreshCw className={`w-3 h-3 ${screenshotLoading ? 'animate-spin' : ''}`} />
                  {t('feedback.recapture')}
                </button>
                <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeScreenshot}
                    onChange={(e) => setIncludeScreenshot(e.target.checked)}
                    className="rounded"
                  />
                  {t('feedback.includeScreenshot')}
                </label>
              </div>
            </div>

            {screenshotLoading ? (
              <div className="h-32 bg-surface-secondary border border-surface-border rounded-md flex items-center justify-center text-text-muted text-xs">
                {t('feedback.capturingScreenshot')}
              </div>
            ) : screenshot ? (
              <div className={`relative border rounded-md overflow-hidden ${includeScreenshot ? 'border-surface-border' : 'border-surface-border opacity-50'}`}>
                <img
                  src={screenshot}
                  alt={t('feedback.screenshotAlt')}
                  className="w-full h-32 object-cover"
                />
              </div>
            ) : (
              <div className="h-32 bg-surface-secondary border border-surface-border rounded-md flex flex-col items-center justify-center gap-1 text-text-muted">
                <ImageOff className="w-5 h-5" />
                <span className="text-xs">{t('feedback.noCanvas')}</span>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-surface-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {t('feedback.cancel')}
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
          >
            {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
