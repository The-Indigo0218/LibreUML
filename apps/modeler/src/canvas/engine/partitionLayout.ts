/**
 * partitionLayout — geometry for Activity Diagram swimlanes (A3).
 *
 * A partition is a band, not a free container (spec §4): it shares its border
 * with its neighbours, and its position along the lane axis is fixed by the
 * whole set, not dragged by the user. `index` (`IRActivityPartition.index`) is
 * the only source of truth for order — `layoutPartitions` derives every
 * lane's `x` from it by accumulating widths left to right. Reordering swaps
 * two `index` values and re-runs this function; it never touches a node's
 * stored coordinates, which is what keeps a lane reorder a one-step undo.
 *
 * v1 is a single axis: vertical lanes, header on top (spec §4). The height is
 * shared by the whole row — `layoutPartitionsHeight` below — so every lane
 * lines up regardless of which one holds the tallest content.
 */
import type { NodeBounds } from '../edges/geometry';

export const DEFAULT_PARTITION_WIDTH = 220;
export const PARTITION_HEADER_H = 28;
export const MIN_PARTITION_HEIGHT = 200;
const PADDING = 24;

export interface PartitionLayoutEntry {
  /** The partition's own ViewNode id (what parentPackageId / relayout key off). */
  id: string;
  index: number;
  width?: number;
}

/**
 * Sorts by `index` and accumulates widths left to right, contiguous (no
 * gaps between lanes). Returns viewNodeId → x. Gaps in the `index` values
 * themselves (e.g. after a lane is deleted) don't matter — only their
 * relative order does.
 */
export function layoutPartitions(entries: PartitionLayoutEntry[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a.index - b.index);
  const xById = new Map<string, number>();
  let x = 0;
  for (const entry of sorted) {
    xById.set(entry.id, x);
    x += entry.width ?? DEFAULT_PARTITION_WIDTH;
  }
  return xById;
}

/**
 * The height every lane in the row shares, derived from the tallest content
 * across ALL lanes (not just one) — a lane can't be shorter than a sibling's
 * content or its nodes would sit outside the band.
 */
export function layoutPartitionsHeight(
  childBoundsAcrossAllLanes: NodeBounds[],
  minHeight: number = MIN_PARTITION_HEIGHT,
): number {
  if (childBoundsAcrossAllLanes.length === 0) return minHeight;
  let maxBottom = 0;
  for (const b of childBoundsAcrossAllLanes) {
    maxBottom = Math.max(maxBottom, b.y + b.height);
  }
  return Math.max(minHeight, maxBottom + PADDING + PARTITION_HEADER_H);
}

export interface PartitionOrderEntry {
  elementId: string;
  index: number;
}

/**
 * Reordering a lane swaps its `index` with the neighbour in `direction` —
 * never coordinates (spec §4.2). Pure so the "which neighbour, if any" lookup
 * is tested without a store: returns `null` at either end of the row.
 */
export function computePartitionSwap(
  partitions: PartitionOrderEntry[],
  elementId: string,
  direction: 'left' | 'right',
): { a: PartitionOrderEntry; b: PartitionOrderEntry } | null {
  const sorted = [...partitions].sort((x, y) => x.index - y.index);
  const i = sorted.findIndex((p) => p.elementId === elementId);
  if (i === -1) return null;
  const j = direction === 'left' ? i - 1 : i + 1;
  if (j < 0 || j >= sorted.length) return null;
  return {
    a: { elementId: sorted[i].elementId, index: sorted[j].index },
    b: { elementId: sorted[j].elementId, index: sorted[i].index },
  };
}

/**
 * Applies `layoutPartitions` onto a diagram's live ViewNode array, writing
 * the derived `x` back so `getAbsolutePosition`'s generic parent-chain walk
 * (which reads `viewNode.x` off this same array) needs no partition-specific
 * case. Called after every mutation that can change a lane's order or width:
 * create, delete, reorder, resize.
 *
 * `partitionsById` is keyed by `elementId` (the IR partition), not by
 * ViewNode id — mirrors `model.activityPartitions`.
 */
export function relayoutPartitionViewNodes(
  viewNodes: Array<{ id: string; elementId: string; x: number; y: number; width?: number }>,
  partitionsById: Record<string, { index: number } | undefined>,
): void {
  const entries: PartitionLayoutEntry[] = [];
  for (const vn of viewNodes) {
    const partition = partitionsById[vn.elementId];
    if (partition) entries.push({ id: vn.id, index: partition.index, width: vn.width });
  }
  if (entries.length === 0) return;
  const xById = layoutPartitions(entries);
  for (const vn of viewNodes) {
    const x = xById.get(vn.id);
    if (x !== undefined) {
      vn.x = x;
      // A lane is always the top band — only its x (order) is derived.
      vn.y = 0;
    }
  }
}
