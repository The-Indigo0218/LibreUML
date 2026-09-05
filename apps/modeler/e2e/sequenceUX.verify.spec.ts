/**
 * TEMP verification spec for the 4 sequence-diagram changes. Drives the real
 * browser via the /__e2e harness. Not part of the permanent suite.
 */
import { test, expect, type Page } from '@playwright/test';

const SEQ = {
  diagramType: 'SEQUENCE_DIAGRAM',
  lifelines: [
    { id: 'llA', vnId: 'vn-a', name: 'Alpha', x: 160, y: 70 },
    { id: 'llB', vnId: 'vn-b', name: 'Beta', x: 460, y: 70 },
  ],
  messages: [
    { id: 'm1', name: 'doWork', messageKind: 'SYNC', sourceLifelineId: 'llA', targetLifelineId: 'llB', sequenceNumber: 1 },
  ],
  activations: [{ id: 'act1', lifelineId: 'llB', startMessageId: 'm1' }],
  fragments: [{
    id: 'f1', fragmentKind: 'IGNORE', coveredLifelineIds: ['llA', 'llB'],
    messageIds: ['m1'], messageSet: ['login', 'logout'],
  }],
};

const rect = (page: Page, id: string) => page.evaluate((i) => window.__libreumlE2E!.nodeRect(i), id);
const dump = (page: Page, c: string) => page.evaluate((cc) => (window.__libreumlE2E as any).modelDump(cc), c);

test('sequence UX batch — all four changes', async ({ page }) => {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => (window.__libreumlE2E as any).seedSequence(s), SEQ as any);
  await page.waitForFunction(() => { const r = window.__libreumlE2E?.nodeRect('vn-a'); return !!r && r.width > 0; });

  // ── F1: IGNORE fragment renders its message set on the canvas ──
  const texts = await page.evaluate(() => (window.__libreumlE2E as any).stageTexts() as string[]);
  expect(texts.some((t) => t.includes('ignore {login, logout}'))).toBe(true);

  // ── F2: lifeline context menu → Create Self Message → msg + nested activation ──
  const a = (await rect(page, 'vn-a'))!;
  await page.mouse.click(a.x + a.width / 2, a.y + 12, { button: 'right' }); // the HEAD, top of the lifeline
  const selfItem = page.getByRole('button', { name: 'Create Self Message' });
  await expect(selfItem).toBeVisible();

  const msgsBefore = Object.keys((await dump(page, 'messages')) ?? {});
  const actsBefore = Object.keys((await dump(page, 'activations')) ?? {});
  await selfItem.click();
  await page.waitForTimeout(250);
  const msgsAfter = (await dump(page, 'messages')) as Record<string, any>;
  const newMsg = Object.keys(msgsAfter).filter((k) => !msgsBefore.includes(k));
  expect(newMsg.length).toBe(1);
  expect(msgsAfter[newMsg[0]].sourceLifelineId).toBe(msgsAfter[newMsg[0]].targetLifelineId); // self
  const actsAfter = Object.keys((await dump(page, 'activations')) ?? {});
  expect(actsAfter.length).toBe(actsBefore.length + 1); // a nested activation was auto-created
  await page.keyboard.press('Escape'); // close the props modal that opened
  await page.mouse.click(20, 300);

  // ── F3: activation bar can't be dragged/resized; no manual override ──
  const actBefore = (await rect(page, 'act1'))!;
  await page.mouse.move(actBefore.x + actBefore.width / 2, actBefore.y + actBefore.height / 2);
  await page.mouse.down();
  await page.mouse.move(actBefore.x + actBefore.width / 2, actBefore.y + actBefore.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const actsDump = (await dump(page, 'activations')) as Record<string, any>;
  expect('manualTopY' in actsDump.act1).toBe(false);
  expect('manualHeight' in actsDump.act1).toBe(false);
  const actAfter = (await rect(page, 'act1'))!;
  expect(Math.abs(actAfter.y - actBefore.y)).toBeLessThan(4); // didn't move

  // ── F4: message context menu → Edit / Reverse / Delete; Reverse swaps ──
  const m = (await rect(page, 'm1'))!;
  await page.mouse.click(m.x + m.width / 2, m.y + m.height / 2, { button: 'right' });
  await expect(page.getByRole('button', { name: 'Edit Properties' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reverse Direction ⇄' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Connection' })).toBeVisible();
  await page.getByRole('button', { name: 'Reverse Direction ⇄' }).click();
  await page.waitForTimeout(150);
  const msgsRev = (await dump(page, 'messages')) as Record<string, any>;
  expect(msgsRev.m1.sourceLifelineId).toBe('llB');
  expect(msgsRev.m1.targetLifelineId).toBe('llA');
});
