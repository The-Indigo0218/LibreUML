import { test, expect, gotoHarness, getView, nodeRect, nodeCenter, dragNodeBy } from './fixtures';

test.describe('canvas node drag (real Konva pointer events)', () => {
  test('dragging a class node updates and persists its position; others untouched', async ({ page }) => {
    await gotoHarness(page);

    const before = await getView(page);
    const a0 = before.nodes.find((n) => n.id === 'vn-a')!;
    const b0 = before.nodes.find((n) => n.id === 'vn-b')!;

    await dragNodeBy(page, 'vn-a', 160, 90);

    await expect
      .poll(async () => (await getView(page)).nodes.find((n) => n.id === 'vn-a')!.x)
      .toBeGreaterThan(a0.x + 40);

    const after = await getView(page);
    const a1 = after.nodes.find((n) => n.id === 'vn-a')!;
    const b1 = after.nodes.find((n) => n.id === 'vn-b')!;

    expect(a1.y).toBeGreaterThan(a0.y + 20); // moved down too
    expect(b1.x).toBe(b0.x);                 // the other node is untouched
    expect(b1.y).toBe(b0.y);
  });

  test('drag-end snaps the node position to the 20px grid', async ({ page }) => {
    await gotoHarness(page);
    await dragNodeBy(page, 'vn-a', 73, 47); // deliberately off-grid delta

    const a = (await getView(page)).nodes.find((n) => n.id === 'vn-a')!;
    expect(a.x % 20).toBe(0);
    expect(a.y % 20).toBe(0);
  });

  test('multi-selected nodes drag together by the same delta', async ({ page }) => {
    await gotoHarness(page);
    const before = await getView(page);
    const a0 = before.nodes.find((n) => n.id === 'vn-a')!;
    const b0 = before.nodes.find((n) => n.id === 'vn-b')!;

    // Select A, then ctrl-click B → multi-selection.
    const ra = await nodeRect(page, 'vn-a');
    const rb = await nodeRect(page, 'vn-b');
    const ca = nodeCenter(ra!);
    const cb = nodeCenter(rb!);
    await page.mouse.click(ca.x, ca.y);
    await page.keyboard.down('Control');
    await page.mouse.click(cb.x, cb.y);
    await page.keyboard.up('Control');

    // Drag A by a delta — B should follow.
    await dragNodeBy(page, 'vn-a', 120, 60);

    await expect
      .poll(async () => (await getView(page)).nodes.find((n) => n.id === 'vn-b')!.x)
      .toBeGreaterThan(b0.x + 40);

    const after = await getView(page);
    const a1 = after.nodes.find((n) => n.id === 'vn-a')!;
    const b1 = after.nodes.find((n) => n.id === 'vn-b')!;
    // Both moved by (approximately) the same delta — within grid-snap tolerance.
    expect(Math.abs((a1.x - a0.x) - (b1.x - b0.x))).toBeLessThanOrEqual(20);
    expect(Math.abs((a1.y - a0.y) - (b1.y - b0.y))).toBeLessThanOrEqual(20);
    expect(b1.x).toBeGreaterThan(b0.x);
  });
});
