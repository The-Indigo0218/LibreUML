import { describe, it, expect } from 'vitest';
import { formatActivityFlowLabel } from '../activityFlowLabel';

describe('formatActivityFlowLabel', () => {
  it('brackets a guard', () => {
    expect(formatActivityFlowLabel('balance > 0', undefined)).toBe('[balance > 0]');
  });

  it('braces a weight', () => {
    expect(formatActivityFlowLabel(undefined, '5')).toBe('{5}');
  });

  it('shows both, guard first', () => {
    expect(formatActivityFlowLabel('balance > 0', '5')).toBe('[balance > 0] {5}');
  });

  it('returns undefined when neither is set', () => {
    expect(formatActivityFlowLabel(undefined, undefined)).toBeUndefined();
  });

  it('treats a blank guard/weight as absent', () => {
    expect(formatActivityFlowLabel('   ', '')).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    expect(formatActivityFlowLabel('  ok  ', undefined)).toBe('[ok]');
  });

  // v1.1 — interrupting edge marker.
  it('prefixes the interrupting glyph on its own', () => {
    expect(formatActivityFlowLabel(undefined, undefined, true)).toBe('↯');
  });

  it('puts the interrupting glyph before guard and weight', () => {
    expect(formatActivityFlowLabel('balance > 0', '5', true)).toBe('↯ [balance > 0] {5}');
  });

  it('omits the interrupting glyph when false/undefined', () => {
    expect(formatActivityFlowLabel('balance > 0', undefined, false)).toBe('[balance > 0]');
    expect(formatActivityFlowLabel('balance > 0', undefined)).toBe('[balance > 0]');
  });
});
