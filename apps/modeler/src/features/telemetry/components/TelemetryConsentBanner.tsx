// src/features/telemetry/components/TelemetryConsentBanner.tsx
//
// Shown once after first login when telemetryOptIn is null (not yet decided).
// Accepts or rejects collection; updates the settings store and fires the
// appropriate PostHog call — so no event is ever sent without consent.

import { useTranslation } from 'react-i18next';
import { BarChart2 } from 'lucide-react';
import { useSettingsStore } from '../../../store/settingsStore';
import { enableTracking, disableTracking, track } from '../posthog.client';

export default function TelemetryConsentBanner() {
  const { t } = useTranslation();
  const telemetryOptIn    = useSettingsStore((s) => s.telemetryOptIn);
  const setTelemetryOptIn = useSettingsStore((s) => s.setTelemetryOptIn);

  // Only render when the preference has not been set yet.
  if (telemetryOptIn !== null) return null;

  const handleAccept = () => {
    setTelemetryOptIn(true);
    enableTracking();
    track('telemetry_opted_in');
  };

  const handleDecline = () => {
    setTelemetryOptIn(false);
    disableTracking();
  };

  return (
    <div
      role="dialog"
      aria-labelledby="telemetry-banner-title"
      aria-describedby="telemetry-banner-desc"
      className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-md mx-auto px-4"
    >
      <div className="bg-surface-secondary border border-surface-border rounded-xl shadow-2xl p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-blue-600/20 rounded-lg shrink-0 mt-0.5">
            <BarChart2 className="w-4 h-4 text-blue-400" aria-hidden="true" />
          </div>
          <div>
            <p id="telemetry-banner-title" className="text-sm font-semibold text-text-primary">
              {t('telemetry.banner.title')}
            </p>
            <p id="telemetry-banner-desc" className="text-xs text-text-muted mt-0.5 leading-relaxed">
              {t('telemetry.banner.body')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={handleDecline}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            {t('telemetry.banner.decline')}
          </button>
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            {t('telemetry.banner.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
