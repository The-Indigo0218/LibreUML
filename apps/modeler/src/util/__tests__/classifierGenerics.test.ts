import { describe, it, expect } from 'vitest';
import { readGenerics, realStereotypes, isGenericToken } from '../classifierGenerics';

describe('classifierGenerics', () => {
  it('reads generics from the dedicated field first', () => {
    expect(readGenerics({ generics: '<T>', stereotypes: ['<K>'] })).toBe('<T>');
  });

  it('falls back to a legacy generic stored in stereotypes', () => {
    expect(readGenerics({ stereotypes: ['<T>'] })).toBe('<T>');
  });

  it('returns undefined when there is no generic anywhere', () => {
    expect(readGenerics({ stereotypes: ['entity'] })).toBeUndefined();
    expect(readGenerics({})).toBeUndefined();
  });

  it('realStereotypes excludes legacy generic tokens', () => {
    expect(realStereotypes({ stereotypes: ['<T>', 'entity', 'service'] })).toEqual(['entity', 'service']);
    expect(realStereotypes({})).toEqual([]);
  });

  it('isGenericToken matches only angle-bracketed tokens', () => {
    expect(isGenericToken('<T>')).toBe(true);
    expect(isGenericToken('<K, V>')).toBe(true);
    expect(isGenericToken('entity')).toBe(false);
  });
});
