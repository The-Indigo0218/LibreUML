/**
 * Regression test for the stale-hit-canvas race flagged as an open question
 * after fecc40a: Konva's hit-testing canvas is a second, separately-drawn
 * canvas that only catches up to a wholesale node replacement (loadProject,
 * tab switch, file open) on its own schedule — not instantly with the
 * visible repaint.
 *
 * Measured with a real Playwright mouse click (not a same-tick
 * `stage.getIntersection()` call, which is a stricter, unrealistic probe):
 * dispatched with zero artificial wait, a click on a freshly-shown node
 * missed and hit the background 50-100% of the time. The window shrinks
 * with KonvaCanvas.tsx's `stage.draw()` layout-effect fix but is genuinely
 * load-sensitive — under system load it can take up to ~80ms (about 5
 * frames) to fully close, even with the fix. That's still an order of
 * magnitude below any human's click-reaction time (~150-300ms minimum), and
 * unreachable by any current production code path (nothing outside e2e/
 * calls `getIntersection` synchronously after a content swap) — so this
 * test asserts safety at a realistic margin (10 frames, ~160ms) rather than
 * an instant that no real interaction could ever produce.
 */
import { test, expect } from '@playwright/test';

const FLOW = {
  activityName: 'Checkout',
  nodes: [
    { id: 'n-init', vnId: 'vn-init', x: 260, y: 80, activityType: 'INITIAL' },
    { id: 'n-act', vnId: 'vn-act', x: 200, y: 200, activityType: 'ACTION', name: 'Validate cart' },
    { id: 'n-final', vnId: 'vn-final', x: 260, y: 340, activityType: 'ACTIVITY_FINAL' },
  ],
  flows: [
    { id: 'f1', source: 'n-init', target: 'n-act' },
    { id: 'f2', source: 'n-act', target: 'n-final' },
  ],
};

const SAFE_FRAMES = 10;

/** Wait N real animation frames — comfortably past the worst-case settle
 *  time measured under load, still far faster than any human reaction. */
async function waitFrames(page: import('@playwright/test').Page, n: number) {
  await page.evaluate((frames) => new Promise((resolve) => {
    let remaining = frames as number;
    const tick = () => {
      remaining--;
      if (remaining <= 0) resolve(null);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), n);
}

async function clickAndDelete(page: import('@playwright/test').Page, vnId: string) {
  const rect = await page.evaluate((id) => window.__libreumlE2E!.nodeRect(id as never), vnId);
  expect(rect, `${vnId} not painted`).not.toBeNull();
  await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.keyboard.press('Delete');
  return page.evaluate((id) => window.__libreumlE2E!.nodeRect(id as never), vnId);
}

test('a fresh seed is clickable shortly after it appears', async ({ page }) => {
  for (let i = 0; i < 10; i++) {
    await page.goto('/__e2e');
    await page.waitForFunction(() => !!window.__libreumlE2E);
    await page.evaluate((spec) => {
      (window.__libreumlE2E as unknown as { seedActivity: (s: unknown) => void }).seedActivity(spec);
    }, FLOW);
    await waitFrames(page, SAFE_FRAMES);
    const after = await clickAndDelete(page, 'vn-act');
    expect(after, `iteration ${i}: click missed the freshly-seeded node`).toBeNull();
  }
});

test('replacing content on an already-open tab is clickable shortly after', async ({ page }) => {
  // Bulk node replacement on an already-mounted Stage — the exact mechanism
  // behind the original bug (loadProject swapping VFSStore content wholesale
  // under a Stage that never remounts, whether from switching tabs, opening
  // a file, or re-seeding here) — not just a fresh navigation.
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  for (let i = 0; i < 10; i++) {
    const flowVariant = {
      ...FLOW,
      nodes: FLOW.nodes.map((n) => ({ ...n, x: n.x + (i % 2 === 0 ? 0 : 40) })),
    };
    await page.evaluate((spec) => {
      (window.__libreumlE2E as unknown as { seedActivity: (s: unknown) => void }).seedActivity(spec);
    }, flowVariant);
    await waitFrames(page, SAFE_FRAMES);
    const after = await clickAndDelete(page, 'vn-act');
    expect(after, `iteration ${i}: click missed the node after a content swap`).toBeNull();
  }
});
