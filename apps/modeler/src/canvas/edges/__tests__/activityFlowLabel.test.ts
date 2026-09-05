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
});
