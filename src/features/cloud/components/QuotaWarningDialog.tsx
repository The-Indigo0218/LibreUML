// src/features/cloud/components/QuotaWarningDialog.tsx
// Shown at most once per browser session when quota reaches the 95 % hard threshold.
// The in-memory flag resets on page reload — no persistence to localStorage.

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { classifyQuota } from '../utils/payloadSize';
import type { QuotaResponse } from '../../../api/types';

// One dialog per page session — module scope resets on full reload.
let _warningShownThisSession = false;

interface QuotaWarningDialogProps {
  quota: QuotaResponse;
}

export default function QuotaWarningDialog({ quota }: QuotaWarningDialogProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (classifyQuota(quota.used) === 'blocked' && !_warningShownThisSession) {
      _warningShownThisSession = true;
      setVisible(true);
    }
  }, [quota.used]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-warning-title"
    >
      <div className="bg-surface-primary border border-surface-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2
              id="quota-warning-title"
              className="text-base font-semibold text-text-primary"
            >
              {t('quota.dialogTitle')}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {t('quota.dialogBody')}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setVisible(false)}
            className="px-4 py-1.5 text-sm font-medium rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            {t('quota.dialogDismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
