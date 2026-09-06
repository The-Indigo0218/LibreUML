/**
 * A2.5 — activity nodes can actually be placed by a real user.
 *
 * A0-A2 built the IR, the store ops, the shapes and the validator, but every
 * one of those phases was verified by seeding the model through the E2E
 * harness (`seedActivity`), never by dragging a tool from the palette the way
 * a real user does. `VFS_DROP_CONFIG` — the map `createNodeFromStereotype`
 * consults on every drop — had no entry for any Activity tool id, so
 * dropping "Action", "Decision", etc. silently did nothing
 * (`console.warn('has no VFS semantic mapping')`).
 *
 * This spec drives the real palette DOM (native HTML5 drag, same as
 * `ToolPalette.tsx`'s `onDragStart`/`onDrop`) instead of the harness's
 * `seedActivity` bypass, so it actually exercises the code path that was
 * broken.
 */
import { test, expect } from '@playwright/test';
import { dragFromTo } from './fixtures';

/**
 * Locator.dragTo() drives real mouse coordinates and asks Playwright's
 * actionability engine to confirm the canvas is "stable" before releasing —
 * that check never settles against a live Konva Stage (it keeps retrying
 * "element is visible and stable" until the 30s test timeout). Dispatching
 * the native drag events directly sidesteps that engine entirely: this is
 * exactly what ToolPalette's onDragStart / KonvaCanvas's onDrop listen for.
 */
async function dragToolOntoCanvas(
  page: import('@playwright/test').Page,
  toolTitle: string,
  drop: { x: number; y: number },
) {
  await page.evaluate(
    ({ toolTitle, drop }) => {
      const source = document.querySelector<HTMLElement>(`[title="${toolTitle}"]`);
      const target = document.querySelector<HTMLCanvasElement>('canvas');
      if (!source || !target) throw new Error(`drag source or target not found (${toolTitle})`);
      const rect = target.getBoundingClientRect();
      const clientX = rect.left + drop.x;
      const clientY = rect.top + drop.y;
      const dataTransfer = new DataTransfer();

      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer, clientX, clientY }),
      );
      target.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientX, clientY }),
      );
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
    },
    { toolTitle, drop },
  );
}

async function seedEmptyActivity(page: import('@playwright/test').Page, spec: unknown = { nodes: [] }) {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate(
    (s) => (window.__libreumlE2E as unknown as { seedActivity: (spec: unknown) => void }).seedActivity(s),
    spec,
  );
  // The palette lives behind the "Modeling Tools" tab — closed by default.
  await page.locator('[title="Modeling Tools"]').click();
}

function getView(page: import('@playwright/test').Page) {
  return page.evaluate(() => window.__libreumlE2E!.getView());
}

function modelDump(page: import('@playwright/test').Page, collection: string) {
  return page.evaluate(
    (c) => (window.__libreumlE2E as unknown as {
      modelDump: (c: string) => Record<string, Record<string, unknown>> | null;
    }).modelDump(c),
    collection,
  );
}

test.describe('A2.5 — activity node creation via the real tool palette', () => {
  test.beforeEach(async ({ page }) => seedEmptyActivity(page));

  test('dragging "Action" from the palette onto the canvas creates a real, named node', async ({ page }) => {
    expect((await getView(page))!.nodes.length).toBe(0);

    await dragToolOntoCanvas(page, 'Action', { x: 300, y: 200 });

    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(1);

    const nodes = await modelDump(page, 'activityNodes');
    const created = Object.values(nodes ?? {})[0] as { activityType: string; activityId: string; name: string };
    expect(created.activityType).toBe('ACTION');
    expect(created.activityId).toBeTruthy();
    expect(created.name).toBe('Action 1');

    const texts = await page.evaluate(() => window.__libreumlE2E!.stageTexts());
    expect(texts.some((t) => t.includes('Action 1'))).toBe(true);
  });

  test('dropping onto a diagram that already has a node reuses its Activity, not a new one', async ({ page }) => {
    // A brand-new empty file has no Activity at all yet (nothing calls
    // createActivity() until the first node is placed) — the harness's
    // buildActivityProject always pre-seeds one, which isn't representative.
    // Seed one existing node instead, so there's a real Activity for
    // getOrCreateActivityId to find, and prove the new node joins it instead
    // of minting a second, orphaned Activity (the bug the per-file scoping in
    // getOrCreateActivityId — not `Object.keys(model.activities)[0]` — guards
    // against for a project with more than one Activity Diagram file).
    await seedEmptyActivity(page, {
      nodes: [{ id: 'n-init', vnId: 'vn-init', x: 100, y: 100, activityType: 'INITIAL' }],
    });

    const before = await modelDump(page, 'activityNodes');
    const existingActivityId = (before!['n-init'] as { activityId: string }).activityId;

    await dragToolOntoCanvas(page, 'Action', { x: 300, y: 200 });
    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(2);

    const after = await modelDump(page, 'activityNodes');
    const activityIds = Object.values(after ?? {}).map((n) => (n as { activityId: string }).activityId);
    expect(new Set(activityIds).size).toBe(1);
    expect(activityIds[0]).toBe(existingActivityId);
  });

  test('dragging a second "Action" numbers it distinctly from the first', async ({ page }) => {
    await dragToolOntoCanvas(page, 'Action', { x: 200, y: 150 });
    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(1);
    await dragToolOntoCanvas(page, 'Action', { x: 500, y: 350 });
    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(2);

    const nodes = await modelDump(page, 'activityNodes');
    const names = Object.values(nodes ?? {}).map((n) => (n as { name: string }).name).sort();
    expect(names).toEqual(['Action 1', 'Action 2']);
  });

  test('dragging a control node (no editable label) still creates a real IR node', async ({ page }) => {
    await dragToolOntoCanvas(page, 'Decision', { x: 300, y: 250 });

    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(1);
    const nodes = await modelDump(page, 'activityNodes');
    const created = Object.values(nodes ?? {})[0] as { activityType: string; name: string };
    expect(created.activityType).toBe('DECISION');
    expect(created.name).toBe('');
  });

  test('a real drag-connection from a Decision node creates a CONTROL_FLOW, not a rejected class relation', async ({ page }) => {
    // A2.5 also fixed resolveStereotype: Decision/Fork/Join view models fell
    // through to "class", so drawing a flow to/from one of them was validated
    // as a class-diagram relation instead of deferring to the activity
    // registry — this proves the fix with a real pointer-driven connection,
    // not just the resolveStereotype unit test.
    await dragToolOntoCanvas(page, 'Action', { x: 250, y: 140 });
    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(1);
    await dragToolOntoCanvas(page, 'Decision', { x: 250, y: 320 });
    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(2);

    const view = (await getView(page))!;
    const actionRect = await page.evaluate((id) => window.__libreumlE2E!.nodeRect(id), view.nodes[0].id);
    const decisionRect = await page.evaluate((id) => window.__libreumlE2E!.nodeRect(id), view.nodes[1].id);
    if (!actionRect || !decisionRect) throw new Error('nodes not painted');

    const from = { x: actionRect.x + actionRect.width / 2, y: actionRect.y + actionRect.height };
    const to = { x: decisionRect.x + decisionRect.width / 2, y: decisionRect.y };

    await page.mouse.move(from.x, from.y); // hover to arm nearAnchorRef
    await page.waitForTimeout(80);
    await dragFromTo(page, from, to);

    await expect.poll(async () => (await getView(page))!.edges.length).toBe(1);
    const relations = await modelDump(page, 'relations');
    const relation = Object.values(relations ?? {})[0] as { kind: string };
    expect(relation.kind).toBe('CONTROL_FLOW');
  });

  // A6/v1.1 — object node creation, deferred out of A2.5 on purpose (no shape
  // existed yet then). Same broken-until-wired path as every tool above.
  test('dragging "Object" from the palette onto the canvas creates a real, named object node', async ({ page }) => {
    expect((await getView(page))!.nodes.length).toBe(0);

    await dragToolOntoCanvas(page, 'Object', { x: 300, y: 200 });

    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(1);

    const nodes = await modelDump(page, 'activityNodes');
    const created = Object.values(nodes ?? {})[0] as { activityType: string; activityId: string; name: string };
    expect(created.activityType).toBe('OBJECT_NODE');
    expect(created.activityId).toBeTruthy();
    expect(created.name).toBe('Object 1');

    const texts = await page.evaluate(() => window.__libreumlE2E!.stageTexts());
    expect(texts.some((t) => t.includes('Object 1'))).toBe(true);
  });

  test('a real drag-connection from an Action to an Object node is accepted, not rejected as a class relation', async ({ page }) => {
    // Same resolveStereotype regression class as the Decision test above,
    // now for ActivityObjectNodeViewModel: without the fix, the object node
    // falls through to "class" and the flow validates (and is usually
    // rejected) as a class-diagram relation instead of an activity flow.
    // The default connection mode is CONTROL_FLOW (registry.defaultEdgeType);
    // picking OBJECT_FLOW is a separate, explicit gesture this test doesn't
    // exercise.
    await dragToolOntoCanvas(page, 'Action', { x: 250, y: 140 });
    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(1);
    await dragToolOntoCanvas(page, 'Object', { x: 250, y: 320 });
    await expect.poll(async () => (await getView(page))!.nodes.length).toBe(2);

    const view = (await getView(page))!;
    const actionRect = await page.evaluate((id) => window.__libreumlE2E!.nodeRect(id), view.nodes[0].id);
    const objectRect = await page.evaluate((id) => window.__libreumlE2E!.nodeRect(id), view.nodes[1].id);
    if (!actionRect || !objectRect) throw new Error('nodes not painted');

    const from = { x: actionRect.x + actionRect.width / 2, y: actionRect.y + actionRect.height };
    const to = { x: objectRect.x + objectRect.width / 2, y: objectRect.y };

    await page.mouse.move(from.x, from.y); // hover to arm nearAnchorRef
    await page.waitForTimeout(80);
    await dragFromTo(page, from, to);

    await expect.poll(async () => (await getView(page))!.edges.length).toBe(1);
    const relations = await modelDump(page, 'relations');
    const relation = Object.values(relations ?? {})[0] as { kind: string };
    expect(relation.kind).toBe('CONTROL_FLOW');
  });
});
