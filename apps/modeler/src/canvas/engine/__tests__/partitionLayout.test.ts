import { describe, it, expect } from 'vitest';
import {
  layoutPartitions,
  layoutPartitionsHeight,
  relayoutPartitionViewNodes,
  computePartitionSwap,
  DEFAULT_PARTITION_WIDTH,
  MIN_PARTITION_HEIGHT,
} from '../partitionLayout';

describe('layoutPartitions', () => {
  it('places lanes left to right in index order, accumulating widths', () => {
    const x = layoutPartitions([
      { id: 'a', index: 0, width: 200 },
      { id: 'b', index: 1, width: 300 },
      { id: 'c', index: 2, width: 150 },
    ]);
    expect(x.get('a')).toBe(0);
    expect(x.get('b')).toBe(200);
    expect(x.get('c')).toBe(500);
  });

  it('orders by index value, not by array position', () => {
    const x = layoutPartitions([
      { id: 'b', index: 1, width: 300 },
      { id: 'a', index: 0, width: 200 },
    ]);
    expect(x.get('a')).toBe(0);
    expect(x.get('b')).toBe(200);
  });

  it('index gaps (e.g. after a deleted lane) do not affect order or spacing', () => {
    const x = layoutPartitions([
      { id: 'a', index: 0, width: 200 },
      { id: 'c', index: 5, width: 150 },
    ]);
    expect(x.get('a')).toBe(0);
    expect(x.get('c')).toBe(200);
  });

  it('falls back to the default width when a lane has none stored', () => {
    const x = layoutPartitions([{ id: 'a', index: 0 }, { id: 'b', index: 1 }]);
    expect(x.get('b')).toBe(DEFAULT_PARTITION_WIDTH);
  });

  it('reordering (swapping index) swaps x without any per-node coordinate math', () => {
    const before = layoutPartitions([
      { id: 'a', index: 0, width: 200 },
      { id: 'b', index: 1, width: 300 },
    ]);
    // Swap index: b becomes 0, a becomes 1 — same objects, only index changed.
    const after = layoutPartitions([
      { id: 'a', index: 1, width: 200 },
      { id: 'b', index: 0, width: 300 },
    ]);
    expect(before.get('a')).toBe(0);
    expect(after.get('b')).toBe(0);
    expect(after.get('a')).toBe(300);
  });

  // Debe morir: invertir el orden de acumulación (restar en vez de sumar)
  // rompe la asertion — documented mutation, not shipped.
  it('would break if accumulation went right-to-left instead of left-to-right', () => {
    const entries = [
      { id: 'a', index: 0, width: 200 },
      { id: 'b', index: 1, width: 300 },
    ];
    const buggyRightToLeft = (es: typeof entries) => {
      const sorted = [...es].sort((a, b) => b.index - a.index);
      const map = new Map<string, number>();
      let x = 0;
      for (const e of sorted) {
        map.set(e.id, x);
        x += e.width;
      }
      return map;
    };
    const correct = layoutPartitions(entries);
    const buggy = buggyRightToLeft(entries);
    expect(correct.get('a')).not.toBe(buggy.get('a'));
  });
});

describe('layoutPartitionsHeight', () => {
  it('returns the minimum when no lane has content', () => {
    expect(layoutPartitionsHeight([])).toBe(MIN_PARTITION_HEIGHT);
  });

  it('grows to fit the tallest content across ALL lanes, not just one', () => {
    const h = layoutPartitionsHeight([
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 900, width: 100, height: 40 }, // deep in a sibling lane
    ]);
    expect(h).toBeGreaterThan(900);
  });

  it('never shrinks below the configured minimum even with tiny content', () => {
    const h = layoutPartitionsHeight([{ x: 0, y: 0, width: 10, height: 10 }], 500);
    expect(h).toBe(500);
  });
});

describe('computePartitionSwap', () => {
  const three = [
    { elementId: 'a', index: 0 },
    { elementId: 'b', index: 1 },
    { elementId: 'c', index: 2 },
  ];

  it('swaps index with the left neighbour', () => {
    const result = computePartitionSwap(three, 'b', 'left');
    expect(result).toEqual({ a: { elementId: 'b', index: 0 }, b: { elementId: 'a', index: 1 } });
  });

  it('swaps index with the right neighbour', () => {
    const result = computePartitionSwap(three, 'b', 'right');
    expect(result).toEqual({ a: { elementId: 'b', index: 2 }, b: { elementId: 'c', index: 1 } });
  });

  it('returns null at the leftmost edge', () => {
    expect(computePartitionSwap(three, 'a', 'left')).toBeNull();
  });

  it('returns null at the rightmost edge', () => {
    expect(computePartitionSwap(three, 'c', 'right')).toBeNull();
  });

  it('returns null for an unknown partition', () => {
    expect(computePartitionSwap(three, 'ghost', 'left')).toBeNull();
  });

  it('is order-independent — uses index, not array position', () => {
    const shuffled = [three[2], three[0], three[1]];
    expect(computePartitionSwap(shuffled, 'b', 'left')).toEqual(computePartitionSwap(three, 'b', 'left'));
  });
});

describe('relayoutPartitionViewNodes', () => {
  const partitionsById = { 'el-a': { index: 0 }, 'el-b': { index: 1 } };

  it('writes derived x onto each partition ViewNode', () => {
    const viewNodes = [
      { id: 'vn-a', elementId: 'el-a', x: 999, y: 999, width: 200 },
      { id: 'vn-b', elementId: 'el-b', x: 999, y: 999, width: 300 },
    ];
    relayoutPartitionViewNodes(viewNodes, partitionsById);
    expect(viewNodes[0].x).toBe(0);
    expect(viewNodes[1].x).toBe(200);
  });

  it('leaves non-partition ViewNodes untouched', () => {
    const viewNodes = [
      { id: 'vn-a', elementId: 'el-a', x: 999, y: 0, width: 200 },
      { id: 'vn-node', elementId: 'action-1', x: 42, y: 10, width: undefined },
    ];
    relayoutPartitionViewNodes(viewNodes, partitionsById);
    expect(viewNodes[1].x).toBe(42);
  });

  it('is a no-op when there are no partitions in the list', () => {
    const viewNodes = [{ id: 'vn-node', elementId: 'action-1', x: 42, y: 10, width: undefined }];
    relayoutPartitionViewNodes(viewNodes, partitionsById);
    expect(viewNodes[0].x).toBe(42);
  });

  it('a node inside a lane moves with it when a preceding sibling lane grows', () => {
    // Node's own relative coords never change; only its lane's x does.
    const viewNodes = [
      { id: 'vn-a', elementId: 'el-a', x: 0, y: 0, width: 200 },
      { id: 'vn-b', elementId: 'el-b', x: 0, y: 0, width: 300 },
    ];
    relayoutPartitionViewNodes(viewNodes, partitionsById);
    expect(viewNodes[1].x).toBe(200);

    // Lane A grows from 200 to 400.
    viewNodes[0].width = 400;
    relayoutPartitionViewNodes(viewNodes, partitionsById);
    expect(viewNodes[1].x).toBe(400); // shifted by the same +200 delta
  });
});
