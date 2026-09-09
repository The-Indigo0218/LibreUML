/**
 * A3 — swimlanes render on the real canvas and a node dragged from one lane
 * into another gets reassigned for real (not just in the builder's unit
 * tests, which never see a Konva Stage or actual pixel geometry).
 */
import { test, expect } from '@playwright/test';
import { dragFromTo, nodeCenter } from './fixtures';

/** Two 220px lanes side by side; one action sits in the left lane. */
const TWO_LANES = {
  activityName: 'Onboarding',
  partitions: [
    { id: 'p-left', vnId: 'vn-p-left', name: 'Customer', index: 0, width: 220 },
    { id: 'p-right', vnId: 'vn-p-right', name: 'Support', index: 1, width: 220 },
  ],
  nodes: [
    // Relative to its lane (parentPackageId = the lane's own vnId).
    { id: 'n-act', vnId: 'vn-act', x: 40, y: 60, activityType: 'ACTION', name: 'Fill form', partitionId: 'p-left' },
  ],
};

async function seed(page: import('@playwright/test').Page) {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => (window.__libreumlE2E as never as {
    seedActivity: (spec: unknown) => void;
  }).seedActivity(s), TWO_LANES as never);
  await page.waitForFunction(() => {
    const r = window.__libreumlE2E?.nodeRect('vn-act');
    return !!r && r.width > 0;
  });
}

test.describe('A3 — swimlanes', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('both lanes render with their names, side by side', async ({ page }) => {
    const texts = await page.evaluate(
      () => (window.__libreumlE2E as never as { stageTexts: () => string[] }).stageTexts(),
    );
    expect(texts.some((t) => t.includes('Customer'))).toBe(true);
    expect(texts.some((t) => t.includes('Support'))).toBe(true);

    const left = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-p-left')))!;
    const right = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-p-right')))!;
    expect(left.width).toBeGreaterThan(0);
    expect(right.width).toBeGreaterThan(0);
    // Right lane starts roughly where the left one ends (a few px of
    // tolerance for the selection/drop-highlight outline's own stroke, which
    // getClientRect() includes).
    expect(right.x).toBeGreaterThanOrEqual(left.x + left.width - 10);
  });

  test('the action starts in the left lane, per the model', async ({ page }) => {
    const nodes = await page.evaluate(() => window.__libreumlE2E!.modelDump('activityNodes'));
    expect((nodes as never as Record<string, { partitionId?: string }>)['n-act'].partitionId).toBe('p-left');
  });

  test('dragging the action into the right lane reassigns it — modelDump reflects the new partitionId', async ({ page }) => {
    const before = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-act')))!;
    const right = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-p-right')))!;

    // Drop the node's centre well inside the right lane's band.
    const from = nodeCenter(before);
    const to = { x: right.x + right.width / 2, y: right.y + right.height / 2 };
    await dragFromTo(page, from, to);

    await expect
      .poll(async () => {
        const nodes = await page.evaluate(() => window.__libreumlE2E!.modelDump('activityNodes'));
        return (nodes as never as Record<string, { partitionId?: string }>)['n-act'].partitionId;
      })
      .toBe('p-right');

    const view = await page.evaluate(() => window.__libreumlE2E!.getView());
    const moved = view!.nodes.find((n) => n.id === 'vn-act')!;
    expect((moved as unknown as { parentPackageId?: string }).parentPackageId).toBe('vn-p-right');
  });

  test('dragging the action out of every lane clears its partitionId', async ({ page }) => {
    const before = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-act')))!;
    const from = nodeCenter(before);
    // Far below both lanes.
    await dragFromTo(page, from, { x: from.x, y: from.y + 600 });

    await expect
      .poll(async () => {
        const nodes = await page.evaluate(() => window.__libreumlE2E!.modelDump('activityNodes'));
        return (nodes as never as Record<string, { partitionId?: string }>)['n-act'].partitionId;
      })
      .toBeUndefined();
  });
});
