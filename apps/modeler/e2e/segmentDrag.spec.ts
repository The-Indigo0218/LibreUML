import { test, expect, getView, seedDiagram, edgeMidpoint, dragFromTo } from './fixtures';

/**
 * R6 segment-slide — orthogonal edges only. Drives real pointer events:
 * select an orthogonal edge, drag its interior segment bar, assert waypoints
 * are promoted and that undo reverts them.
 */
const SPEC = {
  nodes: [
    { id: 'vn-a', elementId: 'cls-a', name: 'Alpha', x: 120, y: 140 },
    { id: 'vn-b', elementId: 'cls-b', name: 'Beta',  x: 520, y: 380 },
  ],
  edges: [
    {
      id: 've',
      relationId: 'rel-ab',
      source: 'cls-a',
      target: 'cls-b',
      routingMode: 'orthogonal' as const,
    },
  ],
};

async function selectEdge(page: import('@playwright/test').Page) {
  const mid = await edgeMidpoint(page, 've');
  if (!mid) throw new Error('edge midpoint not found');
  await page.mouse.click(mid.x, mid.y);
  // Let the selection re-render mount the segment-bar handles.
  await page.waitForTimeout(150);
  return mid;
}

test.describe('orthogonal edge segment-slide (R6)', () => {
  test('dragging the segment bar slides the interior segment and creates 2 waypoints', async ({ page }) => {
    await seedDiagram(page, SPEC);

    const before = (await getView(page)).edges.find((e) => e.id === 've')!;
    expect(before.waypoints).toHaveLength(0);

    const mid = await selectEdge(page);
    await dragFromTo(page, mid, { x: mid.x + 80, y: mid.y + 80 });

    await expect
      .poll(async () => (await getView(page)).edges.find((e) => e.id === 've')!.waypoints.length)
      .toBe(2);
  });

  test('Ctrl+Z after a segment slide restores 0 waypoints', async ({ page }) => {
    await seedDiagram(page, SPEC);

    const mid = await selectEdge(page);
    await dragFromTo(page, mid, { x: mid.x + 80, y: mid.y + 80 });

    await expect
      .poll(async () => (await getView(page)).edges.find((e) => e.id === 've')!.waypoints.length)
      .toBe(2);

    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => (await getView(page)).edges.find((e) => e.id === 've')!.waypoints.length)
      .toBe(0);
  });
});
