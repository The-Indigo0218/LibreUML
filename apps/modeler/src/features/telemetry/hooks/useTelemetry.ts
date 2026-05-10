// src/features/telemetry/hooks/useTelemetry.ts
//
// Single React hook for firing telemetry events in components.
// For non-React contexts (services, stores) import posthog.client.ts directly.

import { useCallback } from 'react';
import { track, identify, type TelemetryEvent } from '../posthog.client';

export function useTelemetry() {
  const trackEvent = useCallback(
    (event: TelemetryEvent, properties?: Record<string, unknown>) => {
      track(event, properties);
    },
    [],
  );

  const identifyUser = useCallback((userId: string) => {
    identify(userId);
  }, []);

  return { track: trackEvent, identify: identifyUser };
}
