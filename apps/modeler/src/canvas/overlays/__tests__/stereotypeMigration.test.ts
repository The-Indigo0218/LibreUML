/**
 * Tests the migration invariant that lives inside InlineClassPanel's commit():
 *
 *   "When a user adds/removes a stereotype on an element that still carries a
 *    legacy generic token in stereotypes[] (e.g. '<T>'), the commit must
 *    move that token to the dedicated `generics` field so it is never lost."
 *
 * The production code uses `readGenerics` + `isGenericToken` from
 * classifierGenerics.ts.  These tests verify the same contract from a
 * slightly higher level, exercising the pure helper logic directly.
 */
import { describe, it, expect } from 'vitest';
import { readGenerics, realStereotypes, isGenericToken } from '../../../util/classifierGenerics';

// ── Simulates what InlineClassPanel.commit() builds as `patch` ────────────────

function buildStereotypePatch(
  currentElement: { stereotypes?: string[]; generics?: string },
  newList: string[],
): { stereotypes: string[]; generics?: string } {
  const patch: { stereotypes: string[]; generics?: string } = { stereotypes: newList };
  if (!('generics' in currentElement) || !currentElement.generics) {
    const legacy = (currentElement.stereotypes ?? []).find(isGenericToken);
    if (legacy) patch.generics = legacy;
  }
  return patch;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('stereotype migration patch (F8.5 — no-pisado de genéricos)', () => {
  it('migrates <T> to generics when first stereotype is added to a legacy class', () => {
    const element = { stereotypes: ['<T>'] };
    const patch = buildStereotypePatch(element, ['entity']);
    expect(patch.stereotypes).toEqual(['entity']);
    expect(patch.generics).toBe('<T>');
  });

  it('does NOT overwrite an existing generics field', () => {
    const element = { stereotypes: ['<T>', 'entity'], generics: '<T>' };
    const patch = buildStereotypePatch(element, ['entity', 'service']);
    expect(patch.generics).toBeUndefined(); // not set — field already exists
    expect(patch.stereotypes).toEqual(['entity', 'service']);
  });

  it('does nothing when there is no legacy generic token', () => {
    const element = { stereotypes: ['entity'] };
    const patch = buildStereotypePatch(element, ['entity', 'service']);
    expect(patch.generics).toBeUndefined();
    expect(patch.stereotypes).toEqual(['entity', 'service']);
  });

  it('migrates multi-param generics <K, V> correctly', () => {
    const element = { stereotypes: ['<K, V>'] };
    const patch = buildStereotypePatch(element, ['repository']);
    expect(patch.generics).toBe('<K, V>');
  });

  it('realStereotypes still filters the generic BEFORE migration (display layer)', () => {
    const element = { stereotypes: ['<T>', 'entity'] };
    // Display reads only real stereotypes
    expect(realStereotypes(element)).toEqual(['entity']);
    // But readGenerics still finds the <T>
    expect(readGenerics(element)).toBe('<T>');
  });

  it('after migration, the element has generics field and no legacy token in stereotypes', () => {
    const element = { stereotypes: ['<T>', 'entity'] };
    const patch = buildStereotypePatch(element, realStereotypes(element));
    // Simulate applying the patch
    const updated = { ...element, ...patch };
    expect(updated.generics).toBe('<T>');
    expect(updated.stereotypes).toEqual(['entity']);
    expect(readGenerics(updated)).toBe('<T>');          // still readable
    expect(realStereotypes(updated)).toEqual(['entity']); // display unchanged
  });
});
