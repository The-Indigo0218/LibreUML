/**
 * projection.ts — world ↔ screen coordinate helpers for HTML overlays (R1).
 *
 * Konva renders shapes in world-space (the same coordinates as node positions),
 * while HTML overlays positioned over the <Stage> need screen-space (container)
 * pixels. These helpers centralise the stage-transform projection that was
 * previously inlined in KonvaCanvas for the inline editor, so the selection
 * toolbar (R1), quick-linker menu (R5) and inline property panel (R9) can reuse it.
 *
 * "Screen" here means pixels relative to the canvas container (the same origin
 * the overlay <div> uses), not the browser viewport.
 */

import type Konva from 'konva';

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Projects a world-space point to container-pixel coordinates using the stage's
 * absolute transform (accounts for pan and zoom). Re-call whenever the stage
 * transform changes (pan/zoom) or the world point moves (drag).
 */
export function worldToScreen(stage: Konva.Stage, world: { x: number; y: number }): ScreenPoint {
  const p = stage.getAbsoluteTransform().copy().point(world);
  return { x: p.x, y: p.y };
}
