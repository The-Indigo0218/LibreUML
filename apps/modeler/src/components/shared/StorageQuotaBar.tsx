// src/components/shared/StorageQuotaBar.tsx
// Compact variant: inline progress track + "X.X MB / 5 MB" label (for StatusBar).
// Expanded variant: labelled bar with contextual hint text (for panels / tooltips).

import { useTranslation } from 'react-i18next';
import {
  classifyQuota,
  formatQuota,
  QUOTA_BYTES,
  type QuotaLevel,
} from '../../features/cloud/utils/payloadSize';
import type { QuotaResponse } from '../../api/types';

interface StorageQuotaBarProps {
  quota:    QuotaResponse;
  variant?: 'compact' | 'expanded';
}

const BAR_COLORS: Record<QuotaLevel, string> = {
  ok:      'bg-green-500',
  warning: 'bg-yellow-400',
  alert:   'bg-red-500',
  blocked: 'bg-red-600',
};

const TEXT_COLORS: Record<QuotaLevel, string> = {
  ok:      'text-text-primary',
  warning: 'text-yellow-400',
  alert:   'text-red-400',
  blocked: 'text-red-500',
};

export default function StorageQuotaBar({
  quota,
  variant = 'compact',
}: StorageQuotaBarProps) {
  const { t } = useTranslation();

  const level    = classifyQuota(quota.used);
  const pct      = Math.min((quota.used / QUOTA_BYTES) * 100, 100);
  const barColor = BAR_COLORS[level];
  const txtColor = TEXT_COLORS[level];

  const usageLabel = t('quota.usage', {
    used:  formatQuota(quota.used),
    total: formatQuota(QUOTA_BYTES),
  });

  if (variant === 'compact') {
    return (
      <div
        className="flex items-center gap-1.5"
        title={`${t('quota.storage')}: ${usageLabel}`}
      >
        {/* Track */}
        <div className="w-16 h-1.5 rounded-full bg-surface-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('quota.storage')}
          />
        </div>
        <span className={`text-xs font-medium tabular-nums ${txtColor}`}>
          {usageLabel}
        </span>
      </div>
    );
  }

  // ── expanded ──────────────────────────────────────────────────────────────
  const hintKey =
    level === 'blocked' ? 'quota.blocked'
    : level === 'alert' ? 'quota.alert'
    : level === 'warning' ? 'quota.warning'
    : null;

  return (
    <div className="flex flex-col gap-1.5 min-w-48">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">
          {t('quota.storage')}
        </span>
        <span className={`text-xs font-medium tabular-nums ${txtColor}`}>
          {usageLabel}
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-surface-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('quota.storage')}
        />
      </div>

      {hintKey && (
        <p className={`text-xs ${txtColor}`}>{t(hintKey)}</p>
      )}
    </div>
  );
}
