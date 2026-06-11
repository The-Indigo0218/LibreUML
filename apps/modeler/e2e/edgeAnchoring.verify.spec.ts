import { test, expect, getView, seedDiagram, edgeMidpoint, nodeRect, nodeCenter, dragFromTo } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Verification spec for the edge-anchoring UX batch (P1/P2/P3).
 * Drives real Konva pointer events and reads state back through __libreumlE2E.
 */

const TWO = {
  nodes: [
    { id: 'vn-a', elementId: 'cls-a', name: 'Alpha', x: 120, y: 140 },
    { id: 'vn-b', elementId: 'cls-b', name: 'Beta', x: 520, y: 360 },
  ],
};

const TWO_WITH_EDGE = {
  ...TWO,
  edges: [{ id: 've', relationId: 'rel-ab', source: 'cls-a', target: 'cls-b', routingMode: 'straight' as const }],
};

const THREE_WITH_EDGE = {
  nodes: [
    { id: 'vn-a', elementId: 'cls-a', name: 'Alpha', x: 120, y: 140 },
    { id: 'vn-b', elementId: 'cls-b', name: 'Beta', x: 560, y: 380 },
    { id: 'vn-c', elementId: 'cls-c', name: 'Gamma', x: 140, y: 460 },
  ],
  edges: [{ id: 've', relationId: 'rel-ab', source: 'cls-a', target: 'cls-b', routingMode: 'straight' as const }],
};

function anchorOf(rect: { x: number; y: number; width: number; height: number }, h: string) {
  const { x, y, width: w, height: ht } = rect;
  switch (h) {
    case 'R': return { x: x + w, y: y + ht / 2 };
    case 'L': return { x, y: y + ht / 2 };
    case 'T': return { x: x + w / 2, y };
    case 'B': return { x: x + w / 2, y: y + ht };
    default: return nodeCenter(rect);
  }
}

/** Screen-space coords of an edge line's target endpoint, via the harness hook. */
function lineLastPoint(page: Page, edgeId: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate(
    (id) => (window.__libreumlE2E as any).edgeEndpoint(id, 'target'),
    edgeId,
  );
}

async function selectEdge(page: Page) {
  const mid = await edgeMidpoint(page, 've');
  if (!mid) throw new Error('edge midpoint not found');
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(150);
  return mid;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test.describe('edge anchoring P1/P2/P3', () => {
  test('P1 — a straight edge floats (not locked) and renders cleanly', async ({ page }) => {
    await seedDiagram(page, TWO_WITH_EDGE);
    const edge: any = (await getView(page)).edges.find((e) => e.id === 've');
    expect(edge).toBeTruthy();
    expect(edge.anchorLocked).toBeFalsy();
    await page.screenshot({ path: '/tmp/verify-p1-floating.png' });
  });

  test('P2 — drawing onto a connection point locks the anchor (fixed)', async ({ page }) => {
    await seedDiagram(page, TWO);
    expect((await getView(page)).edges.length).toBe(0);

    const a = await nodeRect(page, 'vn-a');
    const b = await nodeRect(page, 'vn-b');
    const from = anchorOf(a!, 'R');           // source: A right-mid mark
    const to = anchorOf(b!, 'L');             // target: B left-mid mark (on-mark → fixed)

    await page.mouse.move(from.x, from.y);    // hover to arm nearAnchorRef
    await page.waitForTimeout(80);
    await dragFromTo(page, from, to);

    await expect.poll(async () => (await getView(page)).edges.length).toBe(1);
    const edge: any = (await getView(page)).edges[0];
    await page.screenshot({ path: '/tmp/verify-p2-fixed.png' });
    expect(edge.anchorLocked).toBe(true);
    expect(edge.sourceHandle).toBeTruthy();
    expect(edge.targetHandle).toBeTruthy();
  });

  test('P2 — dropping off a mark creates a floating edge (not locked)', async ({ page }) => {
    await seedDiagram(page, TWO);
    const a = await nodeRect(page, 'vn-a');
    const b = await nodeRect(page, 'vn-b');
    const from = anchorOf(a!, 'R');
    const leftMid = anchorOf(b!, 'L');
    const to = { x: leftMid.x, y: leftMid.y + 16 }; // ~16px off the L mark → floating band

    await page.mouse.move(from.x, from.y);
    await page.waitForTimeout(80);
    await dragFromTo(page, from, to);

    await expect.poll(async () => (await getView(page)).edges.length).toBe(1);
    const edge: any = (await getView(page)).edges[0];
    await page.screenshot({ path: '/tmp/verify-p2-floating.png' });
    expect(edge.anchorLocked).toBeFalsy();
  });

  test('P3 — dragging the target endpoint onto another node re-links it', async ({ page }) => {
    await seedDiagram(page, THREE_WITH_EDGE);
    await selectEdge(page);

    const bCenter = nodeCenter((await nodeRect(page, 'vn-b'))!);
    const cCenter = nodeCenter((await nodeRect(page, 'vn-c'))!);
    const ep = await lineLastPoint(page, 've');     // target endpoint handle (assoc → retract 0)
    expect(ep).toBeTruthy();

    const midBefore = (await edgeMidpoint(page, 've'))!;
    expect(dist(midBefore, bCenter)).toBeLessThan(dist(midBefore, cCenter)); // starts near B

    await dragFromTo(page, ep!, cCenter);
    await page.waitForTimeout(150);

    await expect
      .poll(async () => {
        const mid = (await edgeMidpoint(page, 've'))!;
        return dist(mid, cCenter) < dist(mid, bCenter);
      })
      .toBe(true); // now routes toward C → re-linked

    // No phantom edge — re-link mutates the existing relation, not a new one.
    expect((await getView(page)).edges.length).toBe(1);

    // Freeze check: capture WITHOUT moving the mouse — this is the exact moment
    // the connection-point dots used to stay frozen on Beta. With the mouseup
    // auto-clear they should be gone.
    await page.screenshot({ path: '/tmp/verify-p3-relink-frozen-check.png' });

    // What a real user sees after releasing: dismiss the telemetry toast and move
    // the cursor off the nodes so the transient connection-point overlay clears.
    await page.getByRole('button', { name: 'No thanks' }).click().catch(() => {});
    await page.mouse.move(700, 160);
    await page.mouse.click(700, 160); // deselect to drop the edge toolbar too
    await page.waitForTimeout(150);
    await page.screenshot({ path: '/tmp/verify-p3-relink-clean.png' });
  });

  test('P3 — dragging the target endpoint onto a mark of the same node re-anchors (fixed)', async ({ page }) => {
    await seedDiagram(page, TWO_WITH_EDGE);
    expect(((await getView(page)).edges[0] as any).anchorLocked).toBeFalsy();
    await selectEdge(page);

    const ep = await lineLastPoint(page, 've');
    const bTop = anchorOf((await nodeRect(page, 'vn-b'))!, 'T'); // a mark on B itself
    expect(ep).toBeTruthy();

    await dragFromTo(page, ep!, bTop);
    await page.waitForTimeout(150);

    await expect.poll(async () => ((await getView(page)).edges[0] as any).anchorLocked === true).toBe(true);
    const edge: any = (await getView(page)).edges[0];
    await page.screenshot({ path: '/tmp/verify-p3-reanchor.png' });
    expect(edge.targetHandle).toBeTruthy();
  });
});
