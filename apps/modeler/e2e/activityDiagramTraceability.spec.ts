/**
 * A4 — semantic traceability (ADR-0010), driven through the real canvas:
 * the three markers render from seeded data, and each selector modal — opened
 * the way a user actually opens it (context menu / background menu) — writes
 * the trace back into the model.
 */
import { test, expect, type Page } from '@playwright/test';

const SPEC = {
  activityName: 'Checkout',
  realizesUseCaseId: 'uc-checkout',
  classes: [
    { id: 'cls-order', name: 'OrderService', operationIds: ['op-pay'] },
    { id: 'cls-customer', name: 'Customer' },
  ],
  operations: [{ id: 'op-pay', name: 'pay' }],
  actors: [{ id: 'act-support', name: 'SupportAgent' }],
  useCases: [{ id: 'uc-checkout', name: 'Place Order' }],
  partitions: [
    { id: 'p1', vnId: 'vn-p1', name: 'Customer lane', index: 0, width: 220, representsId: 'cls-customer' },
  ],
  nodes: [
    { id: 'n1', vnId: 'vn-n1', x: 40, y: 60, activityType: 'CALL_OPERATION', name: 'Pay', partitionId: 'p1', callsOperationId: 'op-pay' },
  ],
};

const rect = (page: Page, id: string) => page.evaluate((i) => window.__libreumlE2E!.nodeRect(i), id);
const dump = (page: Page, c: string) => page.evaluate((cc) => (window.__libreumlE2E as any).modelDump(cc), c);
const texts = (page: Page) => page.evaluate(() => (window.__libreumlE2E as any).stageTexts() as string[]);

async function seed(page: Page) {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => (window.__libreumlE2E as any).seedActivity(s), SPEC as any);
  await page.waitForFunction(() => {
    const r = window.__libreumlE2E?.nodeRect('vn-n1');
    return !!r && r.width > 0;
  });
}

test.describe('A4 — traceability markers render from seeded data', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('the action shows its called operation as Class::op()', async ({ page }) => {
    expect((await texts(page)).some((t) => t.includes('OrderService::pay()'))).toBe(true);
  });

  test('the lane shows its responsible class', async ({ page }) => {
    expect((await texts(page)).some((t) => t.includes('↗ Customer'))).toBe(true);
  });

  test('the activity chip shows the realized use case', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Place Order/ })).toBeVisible();
  });
});

test.describe('A4 — setter modals write the trace back into the model', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('lane context menu → Lane Properties → change responsible class → persists + re-renders', async ({ page }) => {
    const lane = (await rect(page, 'vn-p1'))!;
    await page.mouse.click(lane.x + lane.width / 2, lane.y + 12, { button: 'right' });
    await page.getByRole('button', { name: 'Lane Properties…' }).click();

    await expect(page.locator('select')).toBeVisible();
    await page.locator('select').selectOption({ label: '«actor» SupportAgent' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(async () => {
      const partitions = (await dump(page, 'activityPartitions')) as Record<string, { representsId?: string }>;
      return partitions.p1.representsId;
    }).toBe('act-support');
    expect((await texts(page)).some((t) => t.includes('↗ SupportAgent'))).toBe(true);
  });

  test('action context menu → Link Operation → clear it → persists + subtitle disappears', async ({ page }) => {
    const node = (await rect(page, 'vn-n1'))!;
    await page.mouse.click(node.x + node.width / 2, node.y + node.height / 2, { button: 'right' });
    await page.getByRole('button', { name: 'Link Operation…' }).click();

    await expect(page.locator('select')).toBeVisible();
    await page.locator('select').selectOption({ label: '— none —' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(async () => {
      const nodes = (await dump(page, 'activityNodes')) as Record<string, { callsOperationId?: string }>;
      return nodes.n1.callsOperationId;
    }).toBeUndefined();
    expect((await texts(page)).some((t) => t.includes('OrderService::pay()'))).toBe(false);
  });

  test('background context menu → Activity Properties → change use case → persists + chip updates', async ({ page }) => {
    // Far from every seeded node/lane — guaranteed background.
    await page.mouse.click(900, 500, { button: 'right' });
    await page.getByRole('button', { name: 'Activity Properties' }).click();

    await expect(page.locator('select')).toBeVisible();
    await page.locator('select').selectOption({ label: '— none —' });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(async () => {
      const activities = (await dump(page, 'activities')) as Record<string, { realizesUseCaseId?: string }>;
      return activities['e2e-activity']?.realizesUseCaseId;
    }).toBeUndefined();
    await expect(page.getByRole('button', { name: /Place Order/ })).not.toBeVisible();
  });
});
