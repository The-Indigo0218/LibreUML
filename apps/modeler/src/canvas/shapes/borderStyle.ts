import type { NodeBorderStyle } from '../../core/domain/vfs/vfs.types';

/**
 * Konva `dash` array for a per-node border line style (R10), scaled by the
 * stroke width so the pattern reads at any thickness. Solid (or undefined)
 * returns undefined → a continuous line.
 */
export function borderDash(
  style: NodeBorderStyle | undefined,
  width: number,
): number[] | undefined {
  switch (style) {
    case 'dashed':
      return [width * 3, width * 2];
    case 'dotted':
      return [width, width * 1.6];
    default:
      return undefined;
  }
}
