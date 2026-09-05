/**
 * A1/A2 — an activity diagram renders and behaves in a real browser.
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

async function seed(page: import('@playwright/test').Page, spec: unknown, waitForVnId: string) {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => (window.__libreumlE2E as never as {
    seedActivity: (spec: unknown) => void;
  }).seedActivity(s), spec as never);
  await page.waitForFunction((id) => {
    const r = window.__libreumlE2E?.nodeRect(id);
    return !!r && r.width > 0;
  }, waitForVnId);
}

test.describe('A1 — linear flow', () => {
  test.beforeEach(async ({ page }) => seed(page, FLOW, 'vn-act'));

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
});

test.describe('A2 — decision, fork/join, guard', () => {
  /**
   * initial → decision -[balance > 0]-> action-a → fork → (action-b, action-c) → join → final
   *                  \-[else]-> final
   */
  const BRANCHING_FLOW = {
    activityName: 'Checkout with branch',
    nodes: [
      { id: 'n-init', vnId: 'vn-init', x: 260, y: 40, activityType: 'INITIAL' },
      { id: 'n-dec', vnId: 'vn-dec', x: 240, y: 120, activityType: 'DECISION' },
      { id: 'n-a', vnId: 'vn-a', x: 180, y: 220, activityType: 'ACTION', name: 'Charge card' },
      { id: 'n-fork', vnId: 'vn-fork', x: 200, y: 320, activityType: 'FORK' },
      { id: 'n-b', vnId: 'vn-b', x: 120, y: 400, activityType: 'ACTION', name: 'Send receipt' },
      { id: 'n-c', vnId: 'vn-c', x: 320, y: 400, activityType: 'ACTION', name: 'Update stock' },
      { id: 'n-join', vnId: 'vn-join', x: 200, y: 500, activityType: 'JOIN' },
      { id: 'n-final', vnId: 'vn-final', x: 260, y: 580, activityType: 'ACTIVITY_FINAL' },
    ],
    flows: [
      { id: 'f1', source: 'n-init', target: 'n-dec' },
      { id: 'f2', source: 'n-dec', target: 'n-a', guard: 'balance > 0' },
      { id: 'f3', source: 'n-dec', target: 'n-final', guard: 'else' },
      { id: 'f4', source: 'n-a', target: 'n-fork' },
      { id: 'f5', source: 'n-fork', target: 'n-b' },
      { id: 'f6', source: 'n-fork', target: 'n-c' },
      { id: 'f7', source: 'n-b', target: 'n-join' },
      { id: 'f8', source: 'n-c', target: 'n-join' },
      { id: 'f9', source: 'n-join', target: 'n-final' },
    ],
  };

  test.beforeEach(async ({ page }) => seed(page, BRANCHING_FLOW, 'vn-dec'));

  test('decision and fork/join all paint a real, distinctly-shaped box', async ({ page }) => {
    for (const id of ['vn-dec', 'vn-fork', 'vn-join']) {
      const rect = await page.evaluate((i) => window.__libreumlE2E!.nodeRect(i), id);
      expect(rect, `${id} not painted`).not.toBeNull();
      expect(rect!.width, `${id} has no width`).toBeGreaterThan(0);
      expect(rect!.height, `${id} has no height`).toBeGreaterThan(0);
    }

    // Decision (rhombus) and fork/join (bar) have different aspect ratios —
    // proof they are two distinct shapes, not the same glyph reused.
    const decision = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-dec')))!;
    const fork = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-fork')))!;
    expect(Math.abs(decision.width / decision.height - fork.width / fork.height)).toBeGreaterThan(0.5);
  });

  test('fork and join are the same shape, sized identically', async ({ page }) => {
    const fork = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-fork')))!;
    const join = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-join')))!;
    expect(fork.width).toBe(join.width);
    expect(fork.height).toBe(join.height);
  });

  test('paints the guard on the flow leaving the decision', async ({ page }) => {
    const texts = await page.evaluate(
      () => (window.__libreumlE2E as never as { stageTexts: () => string[] }).stageTexts(),
    );
    expect(texts.some((t) => t.includes('[balance > 0]'))).toBe(true);
    expect(texts.some((t) => t.includes('[else]'))).toBe(true);
  });

  test('the branching model — decision, fork and join — survives into the model', async ({ page }) => {
    const nodes = await page.evaluate(
      () => (window.__libreumlE2E as never as {
        modelDump: (c: string) => Record<string, { activityType: string }> | null;
      }).modelDump('activityNodes'),
    );
    const types = Object.values(nodes ?? {}).map((n) => n.activityType).sort();
    expect(types).toEqual(
      ['ACTION', 'ACTION', 'ACTION', 'ACTIVITY_FINAL', 'DECISION', 'FORK', 'INITIAL', 'JOIN'].sort(),
    );

    const relations = await page.evaluate(
      () => (window.__libreumlE2E as never as {
        modelDump: (c: string) => Record<string, { guard?: string }> | null;
      }).modelDump('relations'),
    );
    const guards = Object.values(relations ?? {}).map((r) => r.guard).filter(Boolean).sort();
    expect(guards).toEqual(['balance > 0', 'else']);
  });
});
