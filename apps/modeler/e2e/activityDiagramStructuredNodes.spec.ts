/**
 * Structured activity nodes (v1.1) — loop/conditional/sequence, driven
 * through the real canvas. Unlike pins/object nodes, these DO have a
 * palette tool (an empty container is meaningful on its own), and they DO
 * really resize + accept drag-in containment, same mechanism as a package.
 */
import { test, expect, type Page } from '@playwright/test';
import { dragFromTo, nodeCenter } from './fixtures';

const SPEC = {
  // Project-backed: "Delete from Model" (needed by the last test below) only
  // appears in that mode — same reason activityDiagramDeleteFromModel.spec.ts
  // needs it.
  standalone: false as const,
  activityName: 'Checkout',
  nodes: [
    { id: 'l1', vnId: 'vn-l1', x: 100, y: 100, width: 320, height: 220, activityType: 'LOOP_NODE', name: 'Retry', testExpression: 'i < 3' },
    { id: 'a1', vnId: 'vn-a1', x: 500, y: 150, activityType: 'ACTION', name: 'Ship' },
  ],
};

const rect = (page: Page, id: string) => page.evaluate((i) => window.__libreumlE2E!.nodeRect(i), id);
const dump = (page: Page, c: string) => page.evaluate((cc) => window.__libreumlE2E!.modelDump(cc), c);
const texts = (page: Page) => page.evaluate(() => window.__libreumlE2E!.stageTexts());
const viewNodeIds = (page: Page) =>
  page.evaluate(() => (window.__libreumlE2E!.getView()?.nodes ?? []).map((n) => n.id));

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
    const r = window.__libreumlE2E?.nodeRect('vn-l1');
    return !!r && r.width > 0;
  });
  // The palette lives behind the "Modeling Tools" tab — closed by default.
  await page.locator('[title="Modeling Tools"]').click();
}

test.describe('v1.1 — structured nodes (loop/conditional/sequence)', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('renders the loop header with its glyph, name and test condition', async ({ page }) => {
    expect((await texts(page)).some((t) => t.includes('Retry'))).toBe(true);
    expect((await texts(page)).some((t) => t.includes('i < 3'))).toBe(true);
  });

  test('dragging "Loop" from the palette creates a real LOOP_NODE', async ({ page }) => {
    const before = await viewNodeIds(page);

    await dragToolOntoCanvas(page, 'Loop', { x: 700, y: 400 });

    await expect.poll(async () => (await viewNodeIds(page)).length).toBeGreaterThan(before.length);

    const nodes = (await dump(page, 'activityNodes')) as Record<string, { activityType: string }>;
    expect(Object.values(nodes).some((n) => n.activityType === 'LOOP_NODE')).toBe(true);
  });

  test('dragging an action into the loop assigns containerId and nests its ViewNode', async ({ page }) => {
    const action = (await rect(page, 'vn-a1'))!;
    const loop = (await rect(page, 'vn-l1'))!;

    // Drop well inside the loop's body, away from its header/resize strips.
    const from = nodeCenter(action);
    const to = { x: loop.x + loop.width / 2, y: loop.y + loop.height * 0.75 };
    await dragFromTo(page, from, to);

    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<string, { containerId?: string }>;
      return nodes['a1']?.containerId;
    }).toBe('l1');

    const view = await page.evaluate(() => window.__libreumlE2E!.getView());
    const actionVn = view!.nodes.find((n) => n.id === 'vn-a1')!;
    expect((actionVn as { parentPackageId?: string }).parentPackageId).toBe('vn-l1');
  });

  test('editing the test condition via the context menu persists and re-renders', async ({ page }) => {
    const loop = (await rect(page, 'vn-l1'))!;
    await page.mouse.click(loop.x + loop.width / 2, loop.y + 10, { button: 'right' });
    await page.getByRole('button', { name: 'Edit Test Condition…' }).click();

    const input = page.getByPlaceholder('e.g. i < 10');
    await input.fill('i < 10');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<string, { testExpression?: string }>;
      return nodes['l1']?.testExpression;
    }).toBe('i < 10');
    expect((await texts(page)).some((t) => t.includes('i < 10'))).toBe(true);
  });

  test('deleting the loop (Delete from Model) ungroups its member instead of destroying it', async ({ page }) => {
    // First nest the action, same as the drag test above.
    const action = (await rect(page, 'vn-a1'))!;
    const loop = (await rect(page, 'vn-l1'))!;
    await dragFromTo(page, nodeCenter(action), { x: loop.x + loop.width / 2, y: loop.y + loop.height * 0.75 });
    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<string, { containerId?: string }>;
      return nodes['a1']?.containerId;
    }).toBe('l1');

    const loopNow = (await rect(page, 'vn-l1'))!;
    await page.mouse.click(loopNow.x + loopNow.width / 2, loopNow.y + 10, { button: 'right' });
    await page.getByRole('button', { name: 'Delete from Model' }).click();

    await expect.poll(async () => (await viewNodeIds(page)).includes('vn-l1')).toBe(false);
    // The action survives — ungrouped, not deleted.
    expect(await viewNodeIds(page)).toContain('vn-a1');
    const nodesAfter = (await dump(page, 'activityNodes')) as Record<string, { containerId?: string }>;
    expect(nodesAfter['a1']).toBeTruthy();
    expect(nodesAfter['a1'].containerId).toBeUndefined();
  });
});
