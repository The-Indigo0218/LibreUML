/**
 * A1 — an activity diagram renders and behaves in a real browser.
 *
 * Unit tests never see a canvas: they assert the view models the builder
 * produces, not that Konva painted anything. This drives Chrome through the
 * /__e2e harness and reads the stage back.
 */
import { test, expect } from '@playwright/test';

/** initial → "Validate cart" → final, the smallest complete flow. */
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

test.beforeEach(async ({ page }) => {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => (window.__libreumlE2E as never as {
    seedActivity: (spec: unknown) => void;
  }).seedActivity(s), FLOW as never);
  await page.waitForFunction(() => {
    const r = window.__libreumlE2E?.nodeRect('vn-act');
    return !!r && r.width > 0;
  });
});

test('renders a linear flow: initial, named action, final', async ({ page }) => {
  const texts = await page.evaluate(
    () => (window.__libreumlE2E as never as { stageTexts: () => string[] }).stageTexts(),
  );
  expect(texts.some((t) => t.includes('Validate cart'))).toBe(true);

  // All three nodes are painted with a real box.
  for (const id of ['vn-init', 'vn-act', 'vn-final']) {
    const rect = await page.evaluate((i) => window.__libreumlE2E!.nodeRect(i), id);
    expect(rect, `${id} not painted`).not.toBeNull();
    expect(rect!.width, `${id} has no width`).toBeGreaterThan(0);
  }
});

test('control nodes are small circles and the action is a wider box', async ({ page }) => {
  const initial = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-init')))!;
  const action = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-act')))!;

  // A control node is a fixed-size glyph; an action sizes to its label.
  expect(Math.abs(initial.width - initial.height)).toBeLessThan(4);
  expect(action.width).toBeGreaterThan(initial.width);
});

test('a node can be dragged and the move is persisted', async ({ page }) => {
  const before = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-act')))!;

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 120, before.y + before.height / 2 + 60, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const view = await page.evaluate(() => window.__libreumlE2E!.getView());
  const moved = view!.nodes.find((n) => n.id === 'vn-act')!;
  // Free drag on both axes — nothing about an activity node is derived.
  expect(moved.x).toBeGreaterThan(200);
  expect(moved.y).toBeGreaterThan(200);
});

test('double-clicking an action opens an inline rename', async ({ page }) => {
  const action = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-act')))!;

  await page.mouse.dblclick(action.x + action.width / 2, action.y + action.height / 2);

  // The inline editor is a real DOM input laid over the canvas.
  const input = page.locator('input, textarea').first();
  await expect(input).toBeVisible({ timeout: 3000 });
});

test('the two control flows survive into the model', async ({ page }) => {
  const relations = await page.evaluate(
    () => (window.__libreumlE2E as never as {
      modelDump: (c: string) => Record<string, { kind: string }> | null;
    }).modelDump('relations'),
  );

  const kinds = Object.values(relations ?? {}).map((r) => r.kind);
  expect(kinds).toEqual(['CONTROL_FLOW', 'CONTROL_FLOW']);
});
