// src/features/cloud/components/ApiKeyCreatedDialog.tsx
//
// Show-once modal displayed immediately after a successful POST /api-keys.
// The raw key is presented exactly once — the backend only stores the hash,
// so closing this dialog permanently loses the ability to recover it.
//
// UX checklist:
//   • Copy-to-clipboard with visual confirmation (icon swap + feedback line)
//   • Prominent warning banner about non-recoverability
//   • "Done" closes the dialog and discards the key from React state

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Copy, CheckCheck, AlertTriangle, X } from 'lucide-react';
import type { ApiKeyCreatedResponse } from '../../../api/types';

interface ApiKeyCreatedDialogProps {
  createdKey: ApiKeyCreatedResponse;
  onClose: () => void;
}

export default function ApiKeyCreatedDialog({
  createdKey,
  onClose,
}: ApiKeyCreatedDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(createdKey.key);
    } catch {
      // Fallback for non-secure contexts
      const el = document.createElement('textarea');
      el.value = createdKey.key;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy'); // eslint-disable-line
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-created-title"
    >
      <div className="bg-surface-primary border border-surface-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-green-400 shrink-0" aria-hidden="true" />
            <h2
              id="api-key-created-title"
              className="text-base font-semibold text-text-primary"
            >
              {t('apiKeys.created.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label={t('modals.common.cancel')}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-2 rounded bg-yellow-500/10 border border-yellow-500/30 px-3 py-2.5">
          <AlertTriangle
            className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-xs text-yellow-300 leading-relaxed">
            {t('apiKeys.created.warning')}
          </p>
        </div>

        {/* Key display + copy button */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {t('apiKeys.created.keyLabel')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-surface-hover border border-surface-border rounded px-3 py-2 text-xs font-mono text-text-primary break-all select-all leading-relaxed">
              {createdKey.key}
            </code>
            <button
              onClick={() => void handleCopy()}
              className="shrink-0 p-2 rounded border border-surface-border bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text-primary transition-colors"
              aria-label={t('apiKeys.created.copy')}
              title={t('apiKeys.created.copy')}
            >
              {copied ? (
                <CheckCheck className="w-4 h-4 text-green-400" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {copied && (
            <p className="text-xs text-green-400">{t('apiKeys.created.copied')}</p>
          )}
        </div>

        {/* Key metadata */}
        <div className="flex flex-col gap-1 text-xs text-text-muted">
          <span>
            {t('apiKeys.created.nameLabel')}:{' '}
            <span className="text-text-primary font-medium">{createdKey.name}</span>
          </span>
          <span>
            {t('apiKeys.created.scopeLabel')}:{' '}
            <span className="text-text-primary font-medium">{createdKey.scope}</span>
          </span>
        </div>

        {/* Dismiss */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          {t('apiKeys.created.done')}
        </button>
      </div>
    </div>
  );
}
