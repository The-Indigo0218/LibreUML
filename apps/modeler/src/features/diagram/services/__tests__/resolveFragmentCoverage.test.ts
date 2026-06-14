import { describe, it, expect } from 'vitest';
import { resolveFragmentCoverage } from '../sequenceInserts';

const rect = { x: 100, y: 200, width: 300, height: 200 }; // spans x[100..400], y[200..400]

describe('resolveFragmentCoverage', () => {
  it('covers lifelines whose centerline falls inside the box (X)', () => {
    const lifelines = [
      { id: 'll-left', centerX: 50 },   // left of the box → out
      { id: 'll-a', centerX: 120 },     // in
      { id: 'll-b', centerX: 380 },     // in
      { id: 'll-right', centerX: 500 }, // right of the box → out
    ];
    const { coveredLifelineIds } = resolveFragmentCoverage(rect, lifelines, []);
    expect(coveredLifelineIds).toEqual(['ll-a', 'll-b']);
  });

  it('captures messages whose glyph Y falls inside the box (Y)', () => {
    const messages = [
      { id: 'm-above', y: 150 }, // above → out
      { id: 'm1', y: 220 },      // in
      { id: 'm2', y: 390 },      // in
      { id: 'm-below', y: 450 }, // below → out
    ];
    const { messageIds } = resolveFragmentCoverage(rect, [], messages);
    expect(messageIds).toEqual(['m1', 'm2']);
  });

  it('includes endpoints exactly on the box border (inclusive)', () => {
    const lifelines = [{ id: 'edge', centerX: 400 }];
    const messages = [{ id: 'edge-msg', y: 200 }];
    const res = resolveFragmentCoverage(rect, lifelines, messages);
    expect(res.coveredLifelineIds).toEqual(['edge']);
    expect(res.messageIds).toEqual(['edge-msg']);
  });

  it('returns empty arrays when nothing falls inside', () => {
    const res = resolveFragmentCoverage(rect, [{ id: 'x', centerX: 0 }], [{ id: 'y', y: 0 }]);
    expect(res.coveredLifelineIds).toEqual([]);
    expect(res.messageIds).toEqual([]);
  });
});
