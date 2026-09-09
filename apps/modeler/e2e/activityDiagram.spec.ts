/**
 * A1/A2 — an activity diagram renders and behaves in a real browser.
 *
 * Unit tests never see a canvas: they assert the view models the builder
 * produces, not that Konva painted anything. This drives Chrome through the
 * /__e2e harness and reads the stage back.
 */
import { test, expect } from '@playwright/test';
import { dragFromTo, nodeCenter } from './fixtures';

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
    // Was flaky ~50% here: a single page.mouse.move(..., {steps: 8}) straight
    // to the destination, then a flat 200ms wait before reading the model.
    // dragFromTo emits two shorter legs via a midpoint (more intermediate
    // dragmove events for Konva's drag threshold to catch), and expect.poll
    // retries instead of racing a fixed timeout against the store commit —
    // the same helpers nodeDrag.spec.ts already relies on without flaking.
    const before = (await page.evaluate(() => window.__libreumlE2E!.nodeRect('vn-act')))!;
    const center = nodeCenter(before);
    await dragFromTo(page, center, { x: center.x + 120, y: center.y + 60 });

    // Free drag on both axes — nothing about an activity node is derived.
    await expect
      .poll(async () => {
        const view = await page.evaluate(() => window.__libreumlE2E!.getView());
        return view!.nodes.find((n) => n.id === 'vn-act')!.x;
      })
      .toBeGreaterThan(200);

    const view = await page.evaluate(() => window.__libreumlE2E!.getView());
    const moved = view!.nodes.find((n) => n.id === 'vn-act')!;
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

  test('double-clicking a fresh control-flow edge opens Flow Properties for the real relation, not a phantom', async ({ page }) => {
    // Regression for the id-mismatch bug found while building the
    // interrupting-flow checkbox (§8.8): `handleEdgeDblClick` used to pass
    // the ViewEdge id straight through to the modal, which looks the id up
    // as a *relation* id — production always mints two separate UUIDs
    // (confirmed by this harness too: viewEdge id is `ve-f2`, relation id
    // is `f2`), so the modal silently rendered nothing.
    //
    // Clicked at 80% along the line, not the midpoint: the (separate, still
    // open) double-click-on-a-selected-edge bug is real here too — the
    // floating SelectionToolbar that appears on selection is a real DOM
    // element positioned just above the selection anchor, and for a short
    // edge it physically covers a wide band of the line (confirmed with
    // `elementFromPoint` while investigating — a DOM overlap, not only the
    // Konva ghost-handle same-shape issue §8.8 already documents). Staying
    // clear of that band isolates the id fix this test targets.
    const [src, tgt] = await page.evaluate(() => {
      const api = window.__libreumlE2E!;
      return [api.edgeEndpoint('ve-f2', 'source'), api.edgeEndpoint('ve-f2', 'target')];
    });
    expect(src).not.toBeNull();
    expect(tgt).not.toBeNull();
    const pt = { x: src!.x + (tgt!.x - src!.x) * 0.8, y: src!.y + (tgt!.y - src!.y) * 0.8 };

    // The telemetry consent banner (bottom-centered, z-50) can still be up
    // this early after seeding — dismiss it first so it can't eat either
    // click, same defensive pattern edgeAnchoring.verify uses.
    await page.getByRole('button', { name: 'No thanks' }).click().catch(() => {});

    await page.mouse.dblclick(pt.x, pt.y);
    await expect(page.getByText('Flow Properties')).toBeVisible();

    const guardInput = page.getByText('Guard', { exact: true }).locator('xpath=following-sibling::input');
    await expect(guardInput).toHaveValue('balance > 0');

    await guardInput.fill('balance >= 100');
    await page.getByRole('button', { name: 'Save' }).click();

    const relations = await page.evaluate(
      () => (window.__libreumlE2E as never as {
        modelDump: (c: string) => Record<string, { guard?: string }> | null;
      }).modelDump('relations'),
    );
    expect(relations?.f2?.guard).toBe('balance >= 100');
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
