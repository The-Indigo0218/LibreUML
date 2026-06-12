/**
 * "Add to Project" — integration coverage (F1-A).
 *
 * Exercises the real merge path against the REAL model store:
 *   mergeStandaloneModel (util) → useModelStore.mergeModelElements (store action)
 * and verifies that a NON-class standalone (sequence) folds in completely — every
 * element lands in the global model with cross-refs intact and the remapped
 * DiagramView resolves against it (no orphan nodes).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';
import { mergeStandaloneModel } from '../../utils/mergeStandaloneModel';
import type { SemanticModel, DiagramView } from '../../core/domain/vfs/vfs.types';

function emptyModel(): SemanticModel {
  return {
    id: 'global', name: 'Shared', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, interactionFragments: {}, gates: {}, relations: {},
    createdAt: 1, updatedAt: 1,
  } as SemanticModel;
}

/** A standalone sequence diagram's private model + view. */
function seqStandalone(): { model: SemanticModel; view: DiagramView } {
  const model = emptyModel();
  model.lifelines = {
    l1: { id: 'l1', name: 'User' } as never,
    l2: { id: 'l2', name: 'API' } as never,
  };
  model.messages = {
    m1: { id: 'm1', name: 'login', sourceLifelineId: 'l1', targetLifelineId: 'l2', sequenceNumber: 1 } as never,
  };
  model.interactionFragments = {
    f1: { id: 'f1', name: 'alt', coveredLifelineIds: ['l1', 'l2'], operands: [{ id: 'op1', messageIds: ['m1'], fragmentIds: [] }] } as never,
  };
  const view: DiagramView = {
    diagramId: 'seq',
    nodes: [
      { id: 'vnL1', elementId: 'l1', x: 0, y: 0 },
      { id: 'vnL2', elementId: 'l2', x: 200, y: 0 },
    ],
    edges: [{ id: 've', relationId: 'm1', waypoints: [] }],
  } as DiagramView;
  return { model, view };
}

describe('Add to Project — sequence standalone (integration)', () => {
  beforeEach(() => {
    useModelStore.getState().loadModel(emptyModel());
  });

  it('merges every element + remaps cross-refs and the view into the global model', () => {
    const { model: local, view } = seqStandalone();
    const { elements, packageNames, view: newView, idMap, mergedCount } =
      mergeStandaloneModel(local, view);

    useModelStore.getState().mergeModelElements(elements, packageNames);
    const global = useModelStore.getState().model!;

    // Every element is now in the global model under its new id.
    expect(mergedCount).toBe(4); // l1, l2, m1, f1
    expect(Object.keys(global.lifelines ?? {})).toHaveLength(2);
    expect(Object.keys(global.messages ?? {})).toHaveLength(1);
    expect(Object.keys(global.interactionFragments ?? {})).toHaveLength(1);

    // Cross-refs point at the merged ids (message + deep nested operand).
    const l1New = idMap.get('l1')!;
    const m1New = idMap.get('m1')!;
    expect(global.messages![m1New].sourceLifelineId).toBe(l1New);
    const frag = global.interactionFragments![idMap.get('f1')!] as { operands: { messageIds: string[] }[] };
    expect(frag.operands[0].messageIds).toEqual([m1New]);

    // The remapped view resolves: every node.elementId exists in the global model.
    for (const vn of newView!.nodes) {
      expect(global.lifelines![vn.elementId]).toBeTruthy();
    }
    expect(newView!.edges[0].relationId).toBe(m1New);
  });

  it('does not clobber pre-existing global elements', () => {
    // Seed a global lifeline, then merge — both must coexist.
    const g = emptyModel();
    g.lifelines = { existing: { id: 'existing', name: 'Pre' } as never };
    useModelStore.getState().loadModel(g);

    const { model: local, view } = seqStandalone();
    const { elements, packageNames } = mergeStandaloneModel(local, view);
    useModelStore.getState().mergeModelElements(elements, packageNames);

    const global = useModelStore.getState().model!;
    expect(Object.keys(global.lifelines ?? {})).toHaveLength(3); // existing + l1 + l2
    expect(global.lifelines!['existing'].name).toBe('Pre');
  });
});
