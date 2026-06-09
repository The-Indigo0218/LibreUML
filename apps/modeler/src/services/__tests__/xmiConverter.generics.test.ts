import { describe, it, expect } from 'vitest';
import { XmiConverterService } from '../xmiConverter.service';
import type { IRClass, IRInterface } from '../../core/domain/vfs/vfs.types';
import type { DomainNode } from '../../core/domain/models/nodes';

// ── helpers ────────────────────────────────────────────────────────────────────

function classNode(id: string, name = 'Box'): DomainNode {
  return { id, type: 'CLASS', name, attributes: [], methods: [] } as DomainNode;
}

function irClass(id: string, overrides: Partial<IRClass> = {}): IRClass {
  return {
    id, kind: 'CLASS', name: 'Box',
    attributeIds: [], operationIds: [],
    visibility: 'public', isAbstract: false,
    ...overrides,
  };
}

function xmi(
  nodeIds: string[],
  classMap: Map<string, IRClass | IRInterface>,
): string {
  const nodes = nodeIds.map((id) => classNode(id));
  return XmiConverterService.exportToXmi('d1', 'Test', nodes, [], classMap);
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('XmiConverterService — generics annotation (F8.5)', () => {
  it('emits a genericTypes eAnnotation when generics field is set', () => {
    const out = xmi(['c1'], new Map([['c1', irClass('c1', { generics: '<T>' })]]));
    expect(out).toContain('key="genericTypes"');
    expect(out).toContain('value="&lt;T&gt;"'); // angle brackets are XML-escaped
  });

  it('backward-compat: emits genericTypes even with legacy stereotypes-only format', () => {
    const out = xmi(['c1'], new Map([['c1', irClass('c1', { stereotypes: ['<T>'] })]]));
    expect(out).toContain('key="genericTypes"');
    expect(out).toContain('value="&lt;T&gt;"');
  });

  it('prefers the dedicated generics field when both exist', () => {
    const out = xmi(['c1'], new Map([['c1', irClass('c1', { generics: '<K, V>', stereotypes: ['<T>'] })]]));
    expect(out).toContain('value="&lt;K, V&gt;"');
    expect(out).not.toContain('value="&lt;T&gt;"');
  });

  it('omits the annotation when no generics are present', () => {
    const out = xmi(['c1'], new Map([['c1', irClass('c1')]]));
    expect(out).not.toContain('key="genericTypes"');
  });

  it('omits the annotation for a class not in the active diagram', () => {
    // c2 is in classMap but not in nodes → nodeIdSet does not include it
    const out = xmi(['c1'], new Map([
      ['c1', irClass('c1')],
      ['c2', irClass('c2', { generics: '<T>' })],
    ]));
    expect(out).not.toContain('key="genericTypes"');
  });

  it('user stereotypes do not trigger a genericTypes annotation', () => {
    const out = xmi(['c1'], new Map([['c1', irClass('c1', { stereotypes: ['entity'] })]]));
    expect(out).not.toContain('key="genericTypes"');
  });

  it('interface: emits genericTypes when interface has generics', () => {
    const iface: IRInterface = {
      id: 'i1', kind: 'INTERFACE', name: 'Repo',
      operationIds: [], visibility: 'public',
      generics: '<T>',
    };
    const out = xmi(['i1'], new Map<string, IRClass | IRInterface>([['i1', iface]]));
    expect(out).toContain('key="genericTypes"');
  });
});
