/**
 * A6.2 — input/output pins, driven through the real canvas: unlike every
 * other activity node, a pin has no palette tool (VFS_DROP_CONFIG has no
 * entry for it) — it is created from its owner action's context menu, then
 * traced to a parameter of the action's linked operation via its own
 * "Link Parameter…" modal, same ADR-0010 shape as the object node's
 * "Link Classifier…".
 */
import { test, expect, type Page } from '@playwright/test';

const SPEC = {
  activityName: 'Checkout',
  operations: [
    {
      id: 'op-pay',
      name: 'pay',
      parameters: [{ name: 'amount', type: 'number', direction: 'in' as const }],
      returnType: 'Receipt',
    },
  ],
  nodes: [
    { id: 'n1', vnId: 'vn-n1', x: 200, y: 200, activityType: 'CALL_OPERATION', name: 'Pay', callsOperationId: 'op-pay' },
  ],
};

const rect = (page: Page, id: string) => page.evaluate((i) => window.__libreumlE2E!.nodeRect(i), id);
const viewNodeIds = (page: Page) =>
  page.evaluate(() => (window.__libreumlE2E!.getView()?.nodes ?? []).map((n) => n.id));
const dump = (page: Page, c: string) => page.evaluate((cc) => window.__libreumlE2E!.modelDump(cc), c);
const texts = (page: Page) => page.evaluate(() => window.__libreumlE2E!.stageTexts());

async function seed(page: Page) {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => window.__libreumlE2E!.seedActivity(s), SPEC as any);
  await page.waitForFunction(() => {
    const r = window.__libreumlE2E?.nodeRect('vn-n1');
    return !!r && r.width > 0;
  });
}

/** Right-clicks the action and clicks the menu item, returning the pin's new ViewNode id. */
async function addPin(page: Page, label: 'Add Input Pin' | 'Add Output Pin'): Promise<string> {
  const before = await viewNodeIds(page);
  const node = (await rect(page, 'vn-n1'))!;
  await page.mouse.click(node.x + node.width / 2, node.y + node.height / 2, { button: 'right' });
  await page.getByRole('button', { name: label }).click();
  const after = await viewNodeIds(page);
  const newId = after.find((id) => !before.includes(id));
  expect(newId).toBeTruthy();
  return newId!;
}

test.describe('A6.2 — pins created from the owner action, not the palette', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('Add Input Pin creates a pin owned by the action and opens the parameter picker', async ({ page }) => {
    const pinVnId = await addPin(page, 'Add Input Pin');

    const nodes = (await dump(page, 'activityNodes')) as Record<
      string,
      { activityType: string; ownerActionId?: string }
    >;
    const pin = Object.values(nodes).find((n) => n.activityType === 'INPUT_PIN');
    expect(pin?.ownerActionId).toBe('n1');

    await expect(page.getByText('Input Pin Properties')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();

    void pinVnId;
  });

  test('linking a pin to a parameter persists it and renders the caption', async ({ page }) => {
    await addPin(page, 'Add Input Pin');

    await page.locator('select').selectOption({ label: 'amount: number' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<
        string,
        { activityType: string; parameterName?: string }
      >;
      return Object.values(nodes).find((n) => n.activityType === 'INPUT_PIN')?.parameterName;
    }).toBe('amount');

    expect((await texts(page)).some((t) => t.includes('amount: number'))).toBe(true);
  });

  test('an output pin can link to the operation\'s return value', async ({ page }) => {
    await addPin(page, 'Add Output Pin');

    await page.locator('select').selectOption({ label: '(return): Receipt' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<
        string,
        { activityType: string; parameterName?: string }
      >;
      return Object.values(nodes).find((n) => n.activityType === 'OUTPUT_PIN')?.parameterName;
    }).toBe('__return__');

    expect((await texts(page)).some((t) => t.includes('(return): Receipt'))).toBe(true);
  });
});
