/**
 * Interruptible region + exception handler (v1.1) — driven through the real
 * canvas. INTERRUPTIBLE_REGION reuses the exact structured-node container
 * mechanism A6.3 built for loop/conditional/sequence (drag-in containment,
 * resize, delete-ungroups); this suite exercises only what is actually new:
 * the region's own palette tool + no-test-condition menu, the `isInterrupting`
 * flag on a control flow (props modal + Problems Panel rule), and the new
 * EXCEPTION_HANDLER relation kind drawn as a real connection.
 */
import { test, expect, type Page } from '@playwright/test';
import { dragFromTo, nodeCenter } from './fixtures';

const SPEC = {
  standalone: false as const,
  activityName: 'Checkout',
  nodes: [
    { id: 'r1', vnId: 'vn-r1', x: 80, y: 80, width: 320, height: 220, activityType: 'INTERRUPTIBLE_REGION', name: 'Payment region' },
    { id: 'a1', vnId: 'vn-a1', x: 500, y: 150, activityType: 'ACTION', name: 'Ship' },
    { id: 'h1', vnId: 'vn-h1', x: 500, y: 350, activityType: 'ACTION', name: 'Handle failure' },
  ],
  flows: [
    { id: 'f1', source: 'a1', target: 'h1' },
  ],
};

const rect = (page: Page, id: string) => page.evaluate((i) => window.__libreumlE2E!.nodeRect(i), id);
const dump = (page: Page, c: string) => page.evaluate((cc) => window.__libreumlE2E!.modelDump(cc), c);
const texts = (page: Page) => page.evaluate(() => window.__libreumlE2E!.stageTexts());
const viewNodeIds = (page: Page) =>
  page.evaluate(() => (window.__libreumlE2E!.getView()?.nodes ?? []).map((n) => n.id));
const getView = (page: Page) => page.evaluate(() => window.__libreumlE2E!.getView());

/** Same native-DragEvent workaround as activityDiagramCreation.spec.ts —
 *  Playwright's dragTo()/locator-based drag hangs against Konva's <canvas>. */
async function dragToolOntoCanvas(page: Page, toolTitle: string, drop: { x: number; y: number }) {
  await page.evaluate(
    ({ toolTitle, drop }) => {
      const source = document.querySelector<HTMLElement>(`[title="${toolTitle}"]`);
      const target = document.querySelector<HTMLCanvasElement>('canvas');
      if (!source || !target) throw new Error(`drag source or target not found (${toolTitle})`);
      const r = target.getBoundingClientRect();
      const clientX = r.left + drop.x;
      const clientY = r.top + drop.y;
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer, clientX, clientY }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientX, clientY }));
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
    },
    { toolTitle, drop },
  );
}

async function seed(page: Page) {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => window.__libreumlE2E!.seedActivity(s), SPEC as any);
  await page.waitForFunction(() => {
    const r = window.__libreumlE2E?.nodeRect('vn-r1');
    return !!r && r.width > 0;
  });
  // The palette lives behind the "Modeling Tools" tab — closed by default.
  await page.locator('[title="Modeling Tools"]').click();
}

test.describe('v1.1 — interruptible region + exception handler', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('renders the region header with its glyph and name, no test-condition menu item', async ({ page }) => {
    expect((await texts(page)).some((t) => t.includes('Payment region'))).toBe(true);

    const region = (await rect(page, 'vn-r1'))!;
    await page.mouse.click(region.x + region.width / 2, region.y + 10, { button: 'right' });
    await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Test Condition…' })).not.toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('dragging "Interruptible Region" from the palette creates a real INTERRUPTIBLE_REGION', async ({ page }) => {
    const before = await viewNodeIds(page);

    await dragToolOntoCanvas(page, 'Interruptible Region', { x: 700, y: 450 });

    await expect.poll(async () => (await viewNodeIds(page)).length).toBeGreaterThan(before.length);

    const nodes = (await dump(page, 'activityNodes')) as Record<string, { activityType: string }>;
    expect(Object.values(nodes).some((n) => n.activityType === 'INTERRUPTIBLE_REGION')).toBe(true);
  });

  test('dragging an action into the region assigns containerId, same mechanism as a structured node', async ({ page }) => {
    const action = (await rect(page, 'vn-a1'))!;
    const region = (await rect(page, 'vn-r1'))!;

    await dragFromTo(page, nodeCenter(action), { x: region.x + region.width / 2, y: region.y + region.height * 0.75 });

    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<string, { containerId?: string }>;
      return nodes['a1']?.containerId;
    }).toBe('r1');
  });

  // NOTE on scope: setting `isInterrupting` through the real UI gesture is
  // ControlFlowPropsModal's double-click-to-open, same as guard/weight (A2).
  // Investigated and NOT exercised here: double-clicking a *selected* edge in
  // this app never reaches the modal, for any relation kind that has one
  // (guard/weight, «extend»'s condition) — selecting an edge on the first
  // click mounts a waypoint/segment-drag overlay exactly on top of the line,
  // and Konva's own dblclick synthesis requires the second click's hit-test
  // to resolve to the *same* shape as the first (`Stage._pointerup`,
  // `clickEndShape === shape`); it now resolves to the overlay instead, so
  // the browser never fires `dblclick` on the Line. This is a pre-existing,
  // cross-diagram-type bug (not introduced by v1.1, not scoped to this
  // phase) — real, reproduced with a native-event trace, and left
  // undocumented until now because no e2e spec had ever double-clicked an
  // *edge* (only nodes, which don't grow a selection overlay the same way).
  // Flagged for a dedicated fix outside this phase. Meanwhile this suite
  // verifies what v1.1 actually added — the render/validator behaviour of
  // `isInterrupting` — by seeding the flag directly, the same way
  // `activityDiagramProblemsPanel.spec.ts` seeds a validator violation
  // instead of reproducing it by hand.
  test('an interrupting flow renders its ↯ marker and, when it never leaves its region, surfaces a Problems Panel warning', async ({ page }) => {
    // f1 (a1 → h1), a1 and h1 both inside the region, isInterrupting: true —
    // seeded directly (see note above), asserting the render path AND the
    // validator rule reaching the real Problems Panel, same DoD §10.8 shape
    // as activityDiagramProblemsPanel.spec.ts.
    await page.evaluate((s) => window.__libreumlE2E!.seedActivity(s), {
      standalone: false,
      activityName: 'Checkout',
      nodes: [
        { id: 'r1', vnId: 'vn-r1', x: 80, y: 80, width: 320, height: 220, activityType: 'INTERRUPTIBLE_REGION', name: 'Payment region' },
        { id: 'a1', vnId: 'vn-a1', x: 120, y: 120, activityType: 'ACTION', name: 'Ship', containerId: 'r1' },
        { id: 'h1', vnId: 'vn-h1', x: 120, y: 220, activityType: 'ACTION', name: 'Handle failure', containerId: 'r1' },
      ],
      flows: [
        { id: 'f1', source: 'a1', target: 'h1', isInterrupting: true },
      ],
    } as any);
    await page.waitForFunction(() => {
      const r = window.__libreumlE2E?.nodeRect('vn-r1');
      return !!r && r.width > 0;
    });

    expect((await texts(page)).some((t) => t.includes('↯'))).toBe(true);

    await page.getByTitle('Show Bottom Panel').click();
    await page.getByRole('button', { name: /Problems/ }).click();

    await expect(
      page.getByText('This interrupting flow never actually leaves its interruptible region'),
    ).toBeVisible();
  });

  test('a real drag-connection with "Exception Handler" armed creates an EXCEPTION_HANDLER relation, not a rejected class relation', async ({ page }) => {
    await page.getByRole('button', { name: /^Exception Handler/ }).click();

    const action = (await rect(page, 'vn-a1'))!;
    const handler = (await rect(page, 'vn-h1'))!;
    const from = { x: action.x + action.width / 2, y: action.y + action.height };
    const to = { x: handler.x + handler.width / 2, y: handler.y };

    await page.mouse.move(from.x, from.y); // hover to arm nearAnchorRef
    await page.waitForTimeout(80);
    await dragFromTo(page, from, to);

    await expect.poll(async () => (await getView(page))!.edges.length).toBe(2);
    const relations = (await dump(page, 'relations')) as Record<string, { kind: string; sourceId: string; targetId: string }>;
    const created = Object.values(relations).find((r) => r.kind === 'EXCEPTION_HANDLER');
    expect(created).toBeTruthy();
    expect(created!.sourceId).toBe('a1');
    expect(created!.targetId).toBe('h1');
    expect((await texts(page)).some((t) => t.includes('«handler»'))).toBe(true);
  });
});
