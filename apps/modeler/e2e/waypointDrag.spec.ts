import { test, expect, getView, seedDiagram, edgeMidpoint, dragFromTo } from './fixtures';

/**
 * R3b waypoint cycle — the integration debt that the jsdom Konva mock could not
 * cover. Drives real pointer events: select an edge, drag its midpoint ghost
 * handle to insert a bend, then undo / delete it.
 */
const SPEC = {
  nodes: [
    { id: 'vn-a', elementId: 'cls-a', name: 'Alpha', x: 120, y: 140 },
    { id: 'vn-b', elementId: 'cls-b', name: 'Beta', x: 520, y: 380 },
  ],
  edges: [
    { id: 've', relationId: 'rel-ab', source: 'cls-a', target: 'cls-b', routingMode: 'straight' as const },
  ],
};

async function selectEdge(page: import('@playwright/test').Page) {
  const mid = await edgeMidpoint(page, 've');
  if (!mid) throw new Error('edge midpoint not found');
  await page.mouse.click(mid.x, mid.y);
  // Let the selection re-render mount the ghost midpoint handle.
  await page.waitForTimeout(150);
  return mid;
}

test.describe('edge waypoint cycle (real Konva drag)', () => {
  test('dragging the midpoint handle inserts a waypoint, and undo removes it', async ({ page }) => {
    await seedDiagram(page, SPEC);
    expect((await getView(page)).edges.find((e) => e.id === 've')!.waypoints).toHaveLength(0);

    const mid = await selectEdge(page);
    await dragFromTo(page, mid, { x: mid.x + 70, y: mid.y - 70 });

    await expect
      .poll(async () => (await getView(page)).edges.find((e) => e.id === 've')!.waypoints.length)
      .toBe(1);

    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => (await getView(page)).edges.find((e) => e.id === 've')!.waypoints.length)
      .toBe(0);
  });

  test('a waypoint can be deleted by double-clicking it', async ({ page }) => {
    await seedDiagram(page, SPEC);

    const mid = await selectEdge(page);
    const wp = { x: mid.x + 70, y: mid.y - 70 };
    await dragFromTo(page, mid, wp);
    await expect
      .poll(async () => (await getView(page)).edges.find((e) => e.id === 've')!.waypoints.length)
      .toBe(1);

    // Double-click the waypoint handle to remove it.
    await page.mouse.dblclick(wp.x, wp.y);
    await expect
      .poll(async () => (await getView(page)).edges.find((e) => e.id === 've')!.waypoints.length)
      .toBe(0);
  });
});
