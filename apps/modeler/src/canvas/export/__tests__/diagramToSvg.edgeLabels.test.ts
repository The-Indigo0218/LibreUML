import { describe, it, expect, vi } from 'vitest';

vi.mock('../../shapes/measureText', () => ({
  measureTextWidth: (t: string) => t.length * 7,
}));

import { diagramToSvg } from '../diagramToSvg';
import type { ShapeDescriptor, EdgeDescriptor } from '../../types/canvas.types';
import type { NodeViewModel } from '../../../adapters/view-models/node.view-model';

const OPTS = { backgroundColor: '#ffffff', transparent: false };

function classShape(id: string, x: number, y: number): ShapeDescriptor {
  const vm: NodeViewModel = {
    id, domainId: id, label: id, sections: [],
    style: {
      containerClass: 'bg-uml-class-bg border-uml-class-border',
      headerClass: 'bg-surface-hover border-uml-class-border',
      badgeColor: 'text-uml-class-border', labelFormat: 'font-bold', showStereotype: false,
    },
  };
  return { id, type: 'class', x, y, data: vm };
}

function assocEdge(extra: Partial<EdgeDescriptor> = {}): EdgeDescriptor {
  return {
    id: 'e1', sourceId: 'A', targetId: 'B', kind: 'ASSOCIATION',
    ...extra,
  };
}

function svgOf(edge: EdgeDescriptor): string {
  return diagramToSvg([classShape('A', 0, 0), classShape('B', 400, 300)], [edge], OPTS);
}

describe('diagramToSvg — edge labels', () => {
  it('renders multiplicity, role and verb labels', () => {
    const svg = svgOf(assocEdge({
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
      sourceRole: 'owner',
      label: 'has',
    }));
    expect(svg).toContain('>1<');
    expect(svg).toContain('>0..*<');
    expect(svg).toContain('>owner<');
    expect(svg).toContain('>has<');
  });

  it('honors the per-edge font override on labels', () => {
    const svg = svgOf(assocEdge({
      sourceMultiplicity: '1',
      label: 'has',
      fontFamily: 'Georgia, serif',
      fontSize: 16,
    }));
    expect(svg).toContain('Georgia, serif');
    expect(svg).toContain('font-size="16"');
  });

  it('defaults to base size 11 when no font override is set', () => {
    const svg = svgOf(assocEdge({ sourceMultiplicity: '1' }));
    expect(svg).toContain('font-size="11"');
  });

  it('omits the verb label when there is none', () => {
    const svg = svgOf(assocEdge({ sourceMultiplicity: '1' }));
    expect(svg).not.toContain('>has<');
  });
});
