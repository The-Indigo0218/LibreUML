/**
 * Expansion region + expansion nodes (v1.1) — driven through the real canvas.
 * EXPANSION_REGION reuses the exact structured-node container mechanism A6.3
 * built for loop/conditional/sequence (drag-in containment, resize,
 * delete-ungroups, palette tool) — same reuse A6.4 already proved for
 * INTERRUPTIBLE_REGION. Its expansion nodes reuse the pin mechanism A6.2
 * built (small square, owner-only creation via context menu, rename-in-place)
 * but trace to a classifier instead of a parameter, same field/modal as the
 * object node's "Link Classifier…". This suite exercises only what v1.1
 * actually added on top of that shared machinery: the region's own palette
 * tool + "Edit Mode…" menu item (no test-condition item), the two "Add
 * Input/Output Expansion Node" menu items, the classifier trace rendering as
 * the expansion node's caption, and the "no input expansion node" Problems
 * Panel rule.
 */
import { test, expect, type Page } from '@playwright/test';
import { dragFromTo, nodeCenter } from './fixtures';

const SPEC = {
  standalone: false as const,
  activityName: 'Bulk import',
  classes: [{ id: 'cls-item', name: 'Item' }],
  nodes: [
    { id: 'r1', vnId: 'vn-r1', x: 80, y: 80, width: 320, height: 220, activityType: 'EXPANSION_REGION', name: 'Per item' },
    { id: 'a1', vnId: 'vn-a1', x: 500, y: 150, activityType: 'ACTION', name: 'Process' },
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
    const r = window.__libreumlE2E?.nodeRect('vn-r1');
    return !!r && r.width > 0;
  });
  // The palette lives behind the "Modeling Tools" tab — closed by default.
  await page.locator('[title="Modeling Tools"]').click();
}

/** Right-clicks the region and clicks the menu item, returning the new node's ViewNode id. */
async function addExpansionNode(
  page: Page,
  label: 'Add Input Expansion Node' | 'Add Output Expansion Node',
): Promise<string> {
  const before = await viewNodeIds(page);
  const region = (await rect(page, 'vn-r1'))!;
  await page.mouse.click(region.x + region.width / 2, region.y + 10, { button: 'right' });
  await page.getByRole('button', { name: label }).click();
  const after = await viewNodeIds(page);
  const newId = after.find((id) => !before.includes(id));
  expect(newId).toBeTruthy();
  return newId!;
}

test.describe('v1.1 — expansion region + expansion nodes', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('renders the region header with its glyph, name and PARALLEL mode subtitle, no test-condition menu item', async ({ page }) => {
    expect((await texts(page)).some((t) => t.includes('Per item'))).toBe(true);
    expect((await texts(page)).some((t) => t.includes('parallel'))).toBe(true);

    const region = (await rect(page, 'vn-r1'))!;
    await page.mouse.click(region.x + region.width / 2, region.y + 10, { button: 'right' });
    await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Test Condition…' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Mode…' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('dragging "Expansion Region" from the palette creates a real EXPANSION_REGION defaulting to PARALLEL', async ({ page }) => {
    const before = await viewNodeIds(page);

    await dragToolOntoCanvas(page, 'Expansion Region', { x: 700, y: 450 });

    await expect.poll(async () => (await viewNodeIds(page)).length).toBeGreaterThan(before.length);

    // The seed already has one EXPANSION_REGION (r1, no mode) — find the new
    // one by its new ViewNode id, not by kind alone.
    const newVnId = (await viewNodeIds(page)).find((id) => !before.includes(id))!;
    const view = await page.evaluate(() => window.__libreumlE2E!.getView());
    const newElementId = view!.nodes.find((n) => n.id === newVnId)!.elementId;
    const nodes = (await dump(page, 'activityNodes')) as Record<string, { activityType: string; mode?: string }>;
    expect(nodes[newElementId]).toMatchObject({ activityType: 'EXPANSION_REGION', mode: 'PARALLEL' });
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

  test('editing the mode persists it and updates the subtitle', async ({ page }) => {
    const region = (await rect(page, 'vn-r1'))!;
    await page.mouse.click(region.x + region.width / 2, region.y + 10, { button: 'right' });
    await page.getByRole('button', { name: 'Edit Mode…' }).click();

    await expect(page.getByText('Expansion Region Properties')).toBeVisible();
    await page.locator('select').selectOption('STREAM');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<string, { activityType: string; mode?: string }>;
      return Object.values(nodes).find((n) => n.activityType === 'EXPANSION_REGION')?.mode;
    }).toBe('STREAM');
    expect((await texts(page)).some((t) => t.includes('stream'))).toBe(true);
  });

  test('Add Input Expansion Node creates a node owned by the region and opens the classifier picker', async ({ page }) => {
    await addExpansionNode(page, 'Add Input Expansion Node');

    const nodes = (await dump(page, 'activityNodes')) as Record<
      string,
      { activityType: string; ownerRegionId?: string }
    >;
    const created = Object.values(nodes).find((n) => n.activityType === 'INPUT_EXPANSION_NODE');
    expect(created?.ownerRegionId).toBe('r1');

    // Reuses the object node's classifier-picker modal, distinct title.
    await expect(page.getByText('Expansion Node Properties')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('linking an expansion node to a classifier persists it and renders the caption, same field as an object node', async ({ page }) => {
    await addExpansionNode(page, 'Add Output Expansion Node');

    await page.locator('select').selectOption({ label: 'Item' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<
        string,
        { activityType: string; classifierId?: string }
      >;
      return Object.values(nodes).find((n) => n.activityType === 'OUTPUT_EXPANSION_NODE')?.classifierId;
    }).toBe('cls-item');

    expect((await texts(page)).some((t) => t.includes('Item'))).toBe(true);
  });

  // NOTE on scope: unlike a pin, an expansion node is NOT direction-restricted
  // (validator, `activity-diagram.validator.ts`) — real UML has it carrying
  // flow both ways. Not re-verified here via a real drag-connection: the
  // validator unit tests already cover both directions, and the connection
  // gesture itself is the same shared mechanism A1/A2's control/object flow
  // e2e already exercises for every other node kind.
  test('an expansion region with no input expansion node surfaces a Problems Panel warning', async ({ page }) => {
    await page.getByTitle('Show Bottom Panel').click();
    await page.getByRole('button', { name: /Problems/ }).click();

    await expect(
      page.getByText('Expansion region "Per item" has no input expansion node'),
    ).toBeVisible();

    await addExpansionNode(page, 'Add Input Expansion Node');
    await page.keyboard.press('Escape'); // dismiss the classifier-picker modal opened on creation

    await expect(
      page.getByText('Expansion region "Per item" has no input expansion node'),
    ).not.toBeVisible();
  });
});
