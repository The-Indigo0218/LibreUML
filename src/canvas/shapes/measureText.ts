/**
 * Lightweight text-width measurement using a singleton off-screen canvas.
 *
 * Approach: one `document.createElement('canvas')` is created once and reused.
 * We swap `ctx.font` before each measurement (fast — no layout recalc in the
 * browser; the 2D context stores it as a plain string).
 *
 * Limitations:
 * - Returns the *ideal* advance width. Actual rendered width may differ by
 *   ±1–2 px depending on subpixel rounding. We compensate by adding a small
 *   pad in layout callers.
 * - Does NOT account for ligatures or advanced OpenType features.
 */

let _canvas: HTMLCanvasElement | null = null;

function getCtx(): CanvasRenderingContext2D {
  _canvas ??= document.createElement('canvas');
  // Non-null assertion: 2d context is always available in a browser environment.
  return _canvas.getContext('2d')!;
}

/**
 * Returns the pixel width of `text` rendered at the given CSS `font` spec.
 * @param text   - string to measure (empty string returns 0)
 * @param font   - CSS font shorthand, e.g. `"bold 14px Inter, sans-serif"`
 */
export function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;
  const ctx = getCtx();
  ctx.font = font;
  return ctx.measureText(text).width;
}
