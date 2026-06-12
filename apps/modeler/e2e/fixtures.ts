/**
 * Shared helpers for the Konva drag harness. Because Konva renders to a single
 * <canvas>, nodes are not DOM elements — we translate a node id into page-space
 * pixels via the `window.__libreumlE2E` hook and drag with page.mouse.
 */
import { test, expect, type Page } from '@playwright/test';

export interface ViewNodeLite { id: string; elementId: string; x: number; y: number }
export interface ViewEdgeLite { id: string; waypoints: { x: number; y: number }[] }
export interface ViewLite { nodes: ViewNodeLite[]; edges: ViewEdgeLite[] }
export interface RectLite { x: number; y: number; width: number; height: number }

export interface SeedEdge { id: string; relationId: string; source: string; target: string; kind?: string; routingMode?: 'straight' | 'orthogonal' | 'curved' }
export interface SeedSpec { nodes: ViewNodeLite[]; edges?: SeedEdge[] }

interface E2EApi {
  seed: (spec?: SeedSpec) => void;
  getView: () => ViewLite | null;
  nodeRect: (id: string) => RectLite | null;
  edgeMidpoint: (edgeId: string) => { x: number; y: number } | null;
}
declare global {
  interface Window { __libreumlE2E?: E2EApi }
}

/** Navigate to the harness and wait until a shape is actually rendered on the stage. */
export async function gotoHarness(page: Page): Promise<void> {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.waitForFunction(() => {
    const r = window.__libreumlE2E?.nodeRect('vn-a');
    return !!r && r.width > 0;
  });
}

export function getView(page: Page): Promise<ViewLite> {
  return page.evaluate(() => window.__libreumlE2E!.getView()!);
}

/** Re-seed the diagram with a custom spec, then wait for it to render. */
export async function seedDiagram(page: Page, spec: SeedSpec): Promise<void> {
  await page.goto('/__e2e');
  await page.waitForFunction(() => !!window.__libreumlE2E);
  await page.evaluate((s) => window.__libreumlE2E!.seed(s as never), spec);
  const firstNode = spec.nodes[0]?.id;
  if (firstNode) {
    await page.waitForFunction((id) => {
      const r = window.__libreumlE2E?.nodeRect(id);
      return !!r && r.width > 0;
    }, firstNode);
  }
}

export function edgeMidpoint(page: Page, edgeId: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((id) => window.__libreumlE2E!.edgeMidpoint(id), edgeId);
}

export function nodeRect(page: Page, id: string): Promise<RectLite | null> {
  return page.evaluate((nid) => window.__libreumlE2E!.nodeRect(nid), id);
}

export function nodeCenter(rect: RectLite): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Drag from one page-space point to another, emitting intermediate moves so Konva fires dragmove. */
export async function dragFromTo(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

/** Drag a node by a screen-space delta. */
export async function dragNodeBy(page: Page, id: string, dx: number, dy: number): Promise<void> {
  const rect = await nodeRect(page, id);
  if (!rect) throw new Error(`E2E: node "${id}" not found on the stage`);
  const c = nodeCenter(rect);
  await dragFromTo(page, c, { x: c.x + dx, y: c.y + dy });
}

export { test, expect };
