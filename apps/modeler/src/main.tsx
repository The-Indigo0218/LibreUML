import { enablePatches } from 'immer';
enablePatches();
import './core/undo/instance';

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './i18n/config.ts'
import { initPostHog } from './features/telemetry/posthog.client';
import { initSentry, Sentry } from './features/telemetry/sentry.client';
import CrashScreen from './features/telemetry/components/CrashScreen';

initSentry();
initPostHog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={CrashScreen}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
