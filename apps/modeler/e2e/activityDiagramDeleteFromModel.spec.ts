/**
 * "Delete from Model" on a project-backed activity diagram (real Chrome,
 * real context menu) — the surface `seedActivity` never exercised before
 * `E2EActivitySpec.standalone: false` existed. The menu item itself only
 * renders `if (!isStandalone)`, so this bug (found reviewing A6.2, fixed
 * separately) had zero e2e coverage across every Activity phase: the
 * harness only ever seeded standalone files.
 */
import { test, expect, type Page } from '@playwright/test';

const SPEC = {
  standalone: false as const,
  activityName: 'Checkout',
  operations: [{ id: 'op-pay', name: 'pay', parameters: [{ name: 'amount', type: 'number', direction: 'in' as const }] }],
  nodes: [
    { id: 'n1', vnId: 'vn-n1', x: 200, y: 200, activityType: 'CALL_OPERATION', name: 'Pay', callsOperationId: 'op-pay' },
    { id: 'n2', vnId: 'vn-n2', x: 400, y: 200, activityType: 'ACTION', name: 'Ship' },
  ],
  flows: [{ id: 'f1', source: 'n1', target: 'n2' }],
};

const rect = (page: Page, id: string) => page.evaluate((i) => window.__libreumlE2E!.nodeRect(i), id);
const viewNodeIds = (page: Page) =>
  page.evaluate(() => (window.__libreumlE2E!.getView()?.nodes ?? []).map((n) => n.id));
const dump = (page: Page, c: string) => page.evaluate((cc) => window.__libreumlE2E!.modelDump(cc), c);

async function seed(page: Page) {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => window.__libreumlE2E!.seedActivity(s), SPEC as any);
  await page.waitForFunction(() => {
    const r = window.__libreumlE2E?.nodeRect('vn-n1');
    return !!r && r.width > 0;
  });
}

test.describe('Delete from Model — project-backed activity diagram', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('the menu offers "Delete from Model" (project-backed only, unlike standalone)', async ({ page }) => {
    const node = (await rect(page, 'vn-n1'))!;
    await page.mouse.click(node.x + node.width / 2, node.y + node.height / 2, { button: 'right' });
    await expect(page.getByRole('button', { name: 'Delete from Model' })).toBeVisible();
  });

  test('deleting an action removes the ViewNode AND the IR node from the shared model', async ({ page }) => {
    const before = await dump(page, 'activityNodes') as Record<string, unknown>;
    expect(before['n1']).toBeTruthy();

    const node = (await rect(page, 'vn-n1'))!;
    await page.mouse.click(node.x + node.width / 2, node.y + node.height / 2, { button: 'right' });
    await page.getByRole('button', { name: 'Delete from Model' }).click();

    await expect.poll(async () => {
      const nodes = await dump(page, 'activityNodes') as Record<string, unknown>;
      return nodes['n1'];
    }).toBeFalsy();

    expect(await viewNodeIds(page)).not.toContain('vn-n1');

    // The flow into the deleted action goes with it — no dangling relation.
    const relations = await dump(page, 'relations') as Record<string, { sourceId: string; targetId: string }>;
    expect(Object.values(relations).some((r) => r.sourceId === 'n1' || r.targetId === 'n1')).toBe(false);
  });
});
