import { describe, it, expect, vi } from 'vitest';

vi.mock('react-konva');
vi.mock('../measureText', () => ({
  measureTextWidth: (t: string) => t.length * 7,
}));
vi.mock('../tokens/colors', () => ({
  resolveNodeColors: () => ({ bg: '#fff', headerBg: '#eee', border: '#000', text: '#000', textMuted: '#666' }),
}));

import { getClassShapeSize, computeClassLayout } from '../ClassShape';
import type { NodeViewModel } from '../../../adapters/view-models/node.view-model';

function vm(over: Partial<NodeViewModel> = {}): NodeViewModel {
  return {
    id: 'c1',
    domainId: 'c1',
    label: 'Account',
    sections: [
      { id: 's1', items: [{ id: 'a1', text: '+ balance: number' }] },
      { id: 's2', items: [{ id: 'm1', text: '+ deposit(): void' }] },
    ],
    style: {
      containerClass: 'class',
      headerClass: '',
      badgeColor: '',
      labelFormat: 'normal',
      showStereotype: false,
    },
    ...over,
  };
}

describe('ClassShape font override', () => {
  it('keeps baseline size when no font override is set', () => {
    const layout = computeClassLayout(vm());
    expect(layout.nameFont).toBe(14);
    expect(layout.secFont).toBe(12);
    expect(layout.fontSans).toContain('Inter');
  });

  it('scales fonts and grows the shape when fontSize is larger', () => {
    const base = getClassShapeSize(vm());
    const big = getClassShapeSize(vm({ fontSizeOverride: 28 }));
    expect(big.height).toBeGreaterThan(base.height);

    const layout = computeClassLayout(vm({ fontSizeOverride: 28 }));
    expect(layout.nameFont).toBe(28);
    expect(layout.secFont).toBe(24);
  });

  it('applies the font family override', () => {
    const layout = computeClassLayout(vm({ fontFamilyOverride: 'Georgia, serif' }));
    expect(layout.fontSans).toBe('Georgia, serif');
  });
});
