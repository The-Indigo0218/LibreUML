import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the canvas drag harness.
 *
 * Konva paints to a single <canvas>, so these tests drive the real browser with
 * pixel-level mouse drags (page.mouse) and read state back through the
 * `window.__libreumlE2E` hook exposed by the `/__e2e` route. That route only
 * exists when the dev server is started with VITE_E2E=1 (set below).
 */
const PORT = Number(process.env.E2E_PORT ?? 5174);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/__e2e`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_E2E: '1' },
  },
});
