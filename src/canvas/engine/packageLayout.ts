import type { ViewNode } from '../../core/domain/vfs/vfs.types';
import type { NodeBounds } from '../edges/geometry';
import type { ShapeDescriptor } from '../types/canvas.types';

const TAB_H = 24;
const PADDING = 32;
const MIN_W = 200;
const MIN_H = 150;
const COLLAPSED_W = 100;

export function resolveWorldPosition(
  nodeId: string,
  viewNodes: Map<string, ViewNode>,
  packageNodes: Map<string, ViewNode>,
): { x: number; y: number } {
  let x = 0;
  let y = 0;

  const start = viewNodes.get(nodeId) ?? packageNodes.get(nodeId);
  if (!start) return { x, y };

  x += start.x;
  y += start.y;

  let parentId: string | null | undefined = start.parentPackageId;
  while (parentId) {
    const pkg = packageNodes.get(parentId) ?? viewNodes.get(parentId);
    if (!pkg) break;
    x += pkg.x;
    y += pkg.y;
    parentId = pkg.parentPackageId;
  }

  return { x, y };
}

export function computePackageSize(
  _packageViewNodeId: string,
  childBounds: NodeBounds[],
  collapsed: boolean,
  userWidth?: number,
  userHeight?: number,
): { width: number; height: number } {
  if (collapsed) {
    return { width: COLLAPSED_W, height: TAB_H };
  }

  let computedW: number;
  let computedH: number;

  if (childBounds.length === 0) {
    computedW = MIN_W;
    computedH = MIN_H;
  } else {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const b of childBounds) {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      const bx = b.x + b.width;
      const by = b.y + b.height;
      if (bx > maxX) maxX = bx;
      if (by > maxY) maxY = by;
    }

    computedW = Math.max(MIN_W, maxX - minX + 2 * PADDING);
    computedH = Math.max(MIN_H, maxY - minY + 2 * PADDING + TAB_H);
  }

  return {
    width: Math.max(userWidth ?? 0, computedW),
    height: Math.max(userHeight ?? 0, computedH),
  };
}

export function expandDragGroupWithChildren(
  ids: string[],
  shapes: ShapeDescriptor[],
): string[] {
  const result = new Set<string>(ids);
  const queue: string[] = [...ids];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const shape of shapes) {
      if (shape.parentPackageId === parentId && !result.has(shape.id)) {
        result.add(shape.id);
        queue.push(shape.id);
      }
    }
  }

  return [...result];
}
