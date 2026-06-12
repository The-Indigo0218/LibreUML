import { describe, it, expect } from 'vitest';
import { mergeStandaloneModel } from '../mergeStandaloneModel';
import type { SemanticModel, DiagramView } from '../../core/domain/vfs/vfs.types';

// Deterministic id generator for assertions.
function seqIds() {
  let n = 0;
  return () => `new-${n++}`;
}

function baseModel(): SemanticModel {
  return {
    id: 'lm', name: 'LM', version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, interactionFragments: {}, gates: {}, relations: {},
    createdAt: 1, updatedAt: 1,
  } as SemanticModel;
}

describe('mergeStandaloneModel', () => {
  it('remaps class members + relation endpoints (class diagram)', () => {
    const m = baseModel();
    m.attributes = { a1: { id: 'a1', name: 'x' } as never };
    m.classes = {
      c1: { id: 'c1', name: 'A', kind: 'CLASS', isAbstract: false, attributeIds: ['a1'], operationIds: [] } as never,
      c2: { id: 'c2', name: 'B', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [] } as never,
    };
    m.relations = { r1: { id: 'r1', kind: 'ASSOCIATION', sourceId: 'c1', targetId: 'c2' } as never };
    const view: DiagramView = {
      diagramId: 'd', nodes: [{ id: 'vn1', elementId: 'c1', x: 0, y: 0 }, { id: 'vn2', elementId: 'c2', x: 0, y: 0 }],
      edges: [{ id: 've', relationId: 'r1', waypoints: [] }],
    } as DiagramView;

    const r = mergeStandaloneModel(m, view, seqIds());

    // Every old id is gone; cross-refs follow the map.
    const c1New = r.idMap.get('c1')!;
    const a1New = r.idMap.get('a1')!;
    expect(r.elements.classes![c1New].attributeIds).toEqual([a1New]);
    expect(r.elements.relations!['' + r.idMap.get('r1')!]).toMatchObject({
      sourceId: r.idMap.get('c1'), targetId: r.idMap.get('c2'),
    });
    expect(r.view!.nodes[0].elementId).toBe(c1New);
    expect(r.view!.edges[0].relationId).toBe(r.idMap.get('r1'));
    expect(JSON.stringify(r.elements)).not.toContain('"c1"');
    expect(r.mergedCount).toBe(4); // a1, c1, c2, r1
  });

  it('remaps sequence cross-refs (message lifelines + fragment operand messageIds)', () => {
    const m = baseModel();
    m.lifelines = { l1: { id: 'l1', name: 'A' } as never, l2: { id: 'l2', name: 'B' } as never };
    m.messages = { msg1: { id: 'msg1', name: 'go', sourceLifelineId: 'l1', targetLifelineId: 'l2', sequenceNumber: 1 } as never };
    m.interactionFragments = {
      f1: { id: 'f1', name: 'alt', coveredLifelineIds: ['l1', 'l2'], operands: [{ id: 'op1', messageIds: ['msg1'], fragmentIds: [] }] } as never,
    };

    const r = mergeStandaloneModel(m, null, seqIds());

    const l1New = r.idMap.get('l1')!;
    const msg1New = r.idMap.get('msg1')!;
    expect(r.elements.messages![msg1New].sourceLifelineId).toBe(l1New);
    const frag = r.elements.interactionFragments![r.idMap.get('f1')!] as { coveredLifelineIds: string[]; operands: { messageIds: string[] }[] };
    expect(frag.coveredLifelineIds).toEqual([l1New, r.idMap.get('l2')]);
    expect(frag.operands[0].messageIds).toEqual([msg1New]); // deep nested ref remapped
    expect(JSON.stringify(r.elements)).not.toMatch(/"l1"|"msg1"|"f1"/);
  });
});
