// src/features/telemetry/sentry.client.ts
//
// Thin Sentry facade for crash/error reporting.
//
// Rules (owner decision, 2026-09-05):
//   • Unlike PostHog telemetry (posthog.client.ts), this is NOT gated behind
//     telemetryOptIn — crash reports (stack traces + error messages, no PII)
//     stay always-on so every user's failures are visible, not just the ones
//     who opted into analytics.
//   • sendDefaultPii is explicitly off — no IP, no cookies, no request headers.
//   • No-ops entirely when VITE_SENTRY_DSN is unset (true today: no Sentry
//     project exists yet). Logs a console.warn so the gap isn't silently
//     missed — see the pending TODO in the Obsidian vault
//     (Proyectos/01-LibreUML-Modeler/TODO-sentry-setup.md).

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const IS_DEV = import.meta.env.DEV;

let _initialized = false;

/** Call once at app boot (main.tsx), before rendering. */
export function initSentry(): void {
  if (_initialized) return;
  _initialized = true;

  if (!SENTRY_DSN) {
    console.warn(
      '[Sentry] VITE_SENTRY_DSN is not set — crash reporting is OFF. ' +
      'Errors in production will not be visible anywhere except a user ' +
      'reporting them by hand. Pending: create a Sentry project and set ' +
      'the DSN (see Obsidian: Proyectos/01-LibreUML-Modeler/TODO-sentry-setup.md).',
    );
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_DEV ? 'development' : 'production',
    // Error capture only — no session replay, no performance tracing.
    // Kept deliberately minimal since this runs without user consent.
    sendDefaultPii: false,
    integrations: [],
    tracesSampleRate: 0,
  });
}

export { Sentry };
