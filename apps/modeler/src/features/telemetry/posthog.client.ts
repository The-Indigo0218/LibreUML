// src/features/telemetry/posthog.client.ts
//
// Thin PostHog facade.
//
// Rules:
//   • Reads telemetryOptIn from useSettingsStore before every call — no event
//     ever fires unless the user has explicitly opted in.
//   • In development (import.meta.env.DEV): logs to console, no network.
//   • Identifies users by UUID only — never email or full name.
//   • Self-hostable: set VITE_POSTHOG_HOST to your own PostHog instance.

import type posthogLib from 'posthog-js';
import { useSettingsStore } from '../../store/settingsStore';

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY  as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;
const IS_DEV = import.meta.env.DEV;

let _initialized = false;
let _ph: typeof posthogLib | null = null;

function isOptedIn(): boolean {
  return useSettingsStore.getState().telemetryOptIn === true;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

/**
 * Call once at app boot (e.g., main.tsx).
 * No-ops in dev or when VITE_POSTHOG_KEY is absent.
 */
export function initPostHog(): void {
  if (_initialized || IS_DEV || !POSTHOG_KEY) return;
  _initialized = true;
  import('posthog-js').then((mod) => {
    _ph = mod.default;
    _ph.init(POSTHOG_KEY!, {
      api_host: POSTHOG_HOST ?? 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      opt_out_capturing_by_default: true,
    });
  });
}

// ── Consent ────────────────────────────────────────────────────────────────────

/** Called when the user accepts telemetry. */
export function enableTracking(): void {
  if (!IS_DEV && _ph) _ph.opt_in_capturing();
}

/** Called when the user rejects or revokes telemetry. */
export function disableTracking(): void {
  if (!IS_DEV && _ph) _ph.opt_out_capturing();
}

// ── Core API ───────────────────────────────────────────────────────────────────

/**
 * Identify the current user. Call after login_success.
 * @param userId  UUID from the backend — never email or name.
 */
export function identify(userId: string): void {
  if (!isOptedIn() || IS_DEV || !_ph) return;
  _ph.identify(userId);
}

/**
 * Fire an analytics event.
 * Silently no-ops when the user has not opted in.
 */
export function track(event: TelemetryEvent, properties?: Record<string, unknown>): void {
  if (!isOptedIn() || IS_DEV || !_ph) return;
  _ph.capture(event, properties);
}

/** Reset identity on logout. */
export function resetIdentity(): void {
  if (!IS_DEV && _ph) _ph.reset();
}

// ── Event name registry ────────────────────────────────────────────────────────

export type TelemetryEvent =
  | 'login_success'
  | 'project_saved_cloud'
  | 'model_saved_cloud'
  | 'diagram_saved_cloud'
  | 'export_completed'
  | 'feedback_submitted'
  | 'quota_warning_shown'
  | 'telemetry_opted_in'
  | 'telemetry_opted_out';
