import { describe, it, expect, vi } from 'vitest';

vi.mock('../../shapes/measureText', () => ({
  measureTextWidth: (t: string) => t.length * 7,
}));

import { diagramToSvg } from '../diagramToSvg';
import type { ShapeDescriptor } from '../../types/canvas.types';
import type {
  NodeViewModel,
  ActorViewModel,
  UseCaseViewModel,
  DomainEntityViewModel,
  NoteViewModel,
} from '../../../adapters/view-models/node.view-model';

const OPTS = { backgroundColor: '#ffffff', transparent: false };

function svgOf(shape: ShapeDescriptor): string {
  return diagramToSvg([shape], [], OPTS);
}

/** Extract every numeric font-size present in the SVG. */
function fontSizes(svg: string): number[] {
  return [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
}

const classVM = (fontSizeOverride?: number, fontFamilyOverride?: string): NodeViewModel => ({
  id: 'c1', domainId: 'c1', label: 'Foo', sections: [],
  fontSizeOverride, fontFamilyOverride,
  style: {
    containerClass: 'bg-uml-class-bg border-uml-class-border',
    headerClass: 'bg-surface-hover border-uml-class-border',
    badgeColor: 'text-uml-class-border', labelFormat: 'font-bold', showStereotype: false,
  },
});

const actorVM = (fontSizeOverride?: number, fontFamilyOverride?: string): ActorViewModel => ({
  __brand: 'actor', id: 'a1', domainId: 'a1', name: 'User', isAbstract: false,
  fontSizeOverride, fontFamilyOverride,
});

const useCaseVM = (fontSizeOverride?: number): UseCaseViewModel => ({
  __brand: 'useCase', id: 'u1', domainId: 'u1', name: 'Login',
  extensionPoints: [], hasSpec: false, fontSizeOverride,
});

const domainVM = (fontSizeOverride?: number): DomainEntityViewModel => ({
  __brand: 'domainEntity', id: 'd1', domainId: 'd1', name: 'Order',
  attributes: [{ id: 'at1', name: 'total' }], fontSizeOverride,
});

const noteVM = (fontSizeOverride?: number): NoteViewModel => ({
  id: 'n1', domainId: 'n1', title: 'Note', content: 'hello', fontSizeOverride,
});

function shape(data: ShapeDescriptor['data']): ShapeDescriptor {
  return { id: (data as { id: string }).id, type: 'class', x: 0, y: 0, data };
}

describe('diagramToSvg — node font override scaling', () => {
  it('class: doubling the font size doubles the name font-size in the SVG', () => {
    const base = Math.max(...fontSizes(svgOf(shape(classVM()))));
    const big = Math.max(...fontSizes(svgOf(shape(classVM(28)))));
    expect(base).toBe(14);
    expect(big).toBe(28);
  });

  it('class: font family override reaches the SVG', () => {
    const svg = svgOf(shape(classVM(undefined, 'Georgia, serif')));
    expect(svg).toContain('Georgia, serif');
  });

  it('actor: name font-size scales with the override', () => {
    expect(Math.max(...fontSizes(svgOf(shape(actorVM()))))).toBe(13);
    expect(Math.max(...fontSizes(svgOf(shape(actorVM(26)))))).toBe(26);
  });

  it('use case: name font-size scales with the override', () => {
    expect(Math.max(...fontSizes(svgOf(shape(useCaseVM()))))).toBe(13);
    expect(Math.max(...fontSizes(svgOf(shape(useCaseVM(26)))))).toBe(26);
  });

  it('domain entity: name font-size scales with the override', () => {
    expect(Math.max(...fontSizes(svgOf(shape(domainVM()))))).toBe(14);
    expect(Math.max(...fontSizes(svgOf(shape(domainVM(28)))))).toBe(28);
  });

  it('note: title font-size scales with the override', () => {
    expect(Math.max(...fontSizes(svgOf(shape(noteVM()))))).toBe(14);
    expect(Math.max(...fontSizes(svgOf(shape(noteVM(28)))))).toBe(28);
  });
});
