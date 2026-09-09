/**
 * A0-bis (ADR-0014) — measures the canvas before any activity node exists, so
 * the baseline is attributable to current debt and not to Activity.
 *
 * This spec MEASURES and reports; it does not assert a budget. The budget is
 * set from these numbers and frozen separately as a regression test — asserting
 * an invented threshold here is exactly what the ADR rejects.
 *
 * Each row runs on a freshly loaded page. Viewport state (pan/zoom) survives a
 * re-seed, so measuring several counts in one page makes every row inherit the
 * previous row's panning, and a first-render wait can be satisfied by nodes the
 * previous seed left behind.
 *
 *   npm run test:e2e -- e2e/canvasPerf.measure.spec.ts
 */
import { test, type Page } from '@playwright/test';

const COUNTS = [50, 100, 200, 500];

/** Grid of class nodes, wide enough that culling has something to cull. */
function gridSpec(count: number) {
  const perRow = 10;
  return {
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `vn-${i}`,
      elementId: `cls-${i}`,
      name: `Class${i}`,
      x: 80 + (i % perRow) * 260,
      y: 80 + Math.floor(i / perRow) * 180,
    })),
  };
}

/**
 * Frame intervals sampled with requestAnimationFrame while `action` runs.
 * rAF only fires for frames the browser actually presents, so long gaps are
 * exactly the jank we care about.
 */
async function measureFrames(page: Page, action: () => Promise<void>) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames?: number[]; __stop?: boolean };
    w.__frames = [];
    w.__stop = false;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      w.__frames!.push(now - last);
      last = now;
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await action();

  return page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    // Drop the first sample: it spans the gap before the action started.
    const f = w.__frames.slice(1).sort((a, b) => a - b);
    if (!f.length) return { fps: 0, p95: 0 };
    const at = (q: number) => f[Math.min(f.length - 1, Math.floor(f.length * q))];
    const mean = f.reduce((s, v) => s + v, 0) / f.length;
    return { fps: Math.round(1000 / mean), p95: Math.round(at(0.95) * 10) / 10 };
  });
}

interface Row {
  count: number;
  culling: string;
  firstRender: number;
  panFps: number;
  panP95: number;
  dragFps: number;
  dragP95: number;
  painted: number;
}

test('canvas performance baseline — 50/100/200/500 nodes, culling on and off', async ({ page }) => {
  test.setTimeout(600_000);
  const rows: Row[] = [];

  for (const count of COUNTS) {
    for (const culling of [false, true]) {
      // Fresh page per row: no inherited pan/zoom, no leftover nodes.
      await page.goto('/__e2e');
      await page.waitForFunction(() => !!window.__libreumlE2E);
      await page.evaluate((on) => window.__libreumlE2E!.setCulling(on), culling);

      // ── first render: seed → the diagram is painted ──
      const spec = gridSpec(count);
      const firstRender = await page.evaluate(async (s) => {
        const t0 = performance.now();
        window.__libreumlE2E!.seed(s as never);
        for (let i = 0; i < 900; i++) {
          const r = window.__libreumlE2E!.nodeRect('vn-0');
          if (r && r.width > 0) break;
          await new Promise((res) => requestAnimationFrame(res));
        }
        return Math.round(performance.now() - t0);
      }, spec);

      // Let the culler's 100ms debounce settle before counting.
      await page.waitForTimeout(400);
      const painted = await page.evaluate(() => window.__libreumlE2E!.renderedShapeCount());

      const box = (await page.locator('[data-testid="e2e-harness"]').boundingBox())!;

      // ── fps while panning the stage (drag on empty canvas) ──
      const pan = await measureFrames(page, async () => {
        await page.mouse.move(box.x + 40, box.y + box.height - 40);
        await page.mouse.down();
        for (let i = 0; i < 30; i++) {
          await page.mouse.move(box.x + 40 + i * 12, box.y + box.height - 40 - i * 6);
        }
        await page.mouse.up();
      });

      // ── fps while dragging one node ──
      const first = await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-0'));
      const drag = await measureFrames(page, async () => {
        if (!first || first.width === 0) return;
        await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
        await page.mouse.down();
        for (let i = 0; i < 30; i++) {
          await page.mouse.move(
            first.x + first.width / 2 + i * 8,
            first.y + first.height / 2 + i * 4,
          );
        }
        await page.mouse.up();
      });

      rows.push({
        count,
        culling: culling ? 'on' : 'off',
        firstRender,
        panFps: pan.fps,
        panP95: pan.p95,
        dragFps: drag.fps,
        dragP95: drag.p95,
        painted,
      });
    }
  }

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(
    [
      '',
      '=== A0-bis · canvas performance baseline (ADR-0014) ===',
      `${pad('nodes', 7)}${pad('culling', 9)}${pad('painted', 9)}${pad('1st render', 12)}${pad('pan fps', 9)}${pad('pan p95', 10)}${pad('drag fps', 10)}${pad('drag p95', 9)}`,
      '-'.repeat(75),
      ...rows.map(
        (r) =>
          `${pad(r.count, 7)}${pad(r.culling, 9)}${pad(r.painted, 9)}${pad(r.firstRender + ' ms', 12)}${pad(r.panFps, 9)}${pad(r.panP95 + ' ms', 10)}${pad(r.dragFps, 10)}${pad(r.dragP95 + ' ms', 9)}`,
      ),
      '',
    ].join('\n'),
  );
});
