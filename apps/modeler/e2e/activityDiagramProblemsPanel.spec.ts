/**
 * A5, §16 — registry validators reach the Problems Panel in a real browser.
 *
 * Unit tests already cover `useProjectProblems` wiring against the real
 * stores (`domainNodeAdapter.test.ts`, `useProjectProblems.test.ts`), but none
 * of them mount the actual panel component or drive the harness's real
 * `loadProject` path the way a user's browser does. This is the DoD §10.8
 * check: seed a DECISION with a single outgoing flow (a known
 * `validateActivityStructure` violation, A2) and confirm it surfaces as a
 * "validation" problem the user can actually see and click through to.
 */
import { test, expect } from '@playwright/test';

const FLOW = {
  activityName: 'Checkout',
  nodes: [
    { id: 'n-init', vnId: 'vn-init', x: 260, y: 80, activityType: 'INITIAL' },
    { id: 'n-dec', vnId: 'vn-dec', x: 260, y: 200, activityType: 'DECISION', name: 'Paid?' },
  ],
  flows: [
    { id: 'f1', source: 'n-init', target: 'n-dec' },
  ],
};

test.describe('Problems panel — Activity Diagram registry validation', () => {
  test('surfaces the fan-out warning for a decision with one outgoing flow', async ({ page }) => {
    await page.goto('/__e2e');
    await page.waitForFunction(() => !!window.__libreumlE2E);
    await page.evaluate((s) => (window.__libreumlE2E as never as {
      seedActivity: (spec: unknown) => void;
    }).seedActivity(s), FLOW as never);
    await page.waitForFunction((id) => {
      const r = window.__libreumlE2E?.nodeRect(id);
      return !!r && r.width > 0;
    }, 'vn-dec');

    await page.getByTitle('Show Bottom Panel').click();
    await page.getByRole('button', { name: /Problems/ }).click();

    await expect(
      page.getByText('Decision "Paid?" has only one outgoing flow — nothing to branch on'),
    ).toBeVisible();
  });
});
