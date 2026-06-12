/**
 * addStandaloneToProject action — integration coverage (F1-B1).
 *
 * Drives the EXTRACTED action against the REAL VFS + model stores: a standalone
 * sequence file is folded back into the project, then we assert the file flipped
 * out of standalone mode, its localModel was cleared, the view was remapped onto
 * the global ids, and every element landed in the global model. Also covers the
 * flag-only path (no localModel) and the no-op guards.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { addStandaloneToProject } from '../addStandaloneToProject';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { useModelStore } from '../../../../store/model.store';
import type {
  SemanticModel,
  DiagramView,
  VFSFile,
  LibreUMLProject,
} from '../../../../core/domain/vfs/vfs.types';

function emptyModel(id = 'global'): SemanticModel {
  return {
    id, name: 'Shared', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, interactionFragments: {}, gates: {}, relations: {},
    createdAt: 1, updatedAt: 1,
  } as SemanticModel;
}

/** A standalone sequence diagram's private localModel + view. */
function seqLocalModel(): SemanticModel {
  const model = emptyModel('local');
  model.lifelines = {
    l1: { id: 'l1', name: 'User' } as never,
    l2: { id: 'l2', name: 'API' } as never,
  };
  model.messages = {
    m1: { id: 'm1', name: 'login', sourceLifelineId: 'l1', targetLifelineId: 'l2', sequenceNumber: 1 } as never,
  };
  return model;
}

function seqView(): DiagramView {
  return {
    diagramId: 'seq',
    nodes: [
      { id: 'vnL1', elementId: 'l1', x: 0, y: 0 },
      { id: 'vnL2', elementId: 'l2', x: 200, y: 0 },
    ],
    edges: [{ id: 've', relationId: 'm1', waypoints: [] }],
  } as DiagramView;
}

function projectWith(file: VFSFile): LibreUMLProject {
  return {
    id: 'p1', projectName: 'P', version: '1.0.0', domainModelId: 'global',
    semanticModel: emptyModel('global'),
    nodes: { [file.id]: file },
    createdAt: 1, updatedAt: 1,
  };
}

describe('addStandaloneToProject (action)', () => {
  beforeEach(() => {
    useModelStore.getState().loadModel(emptyModel('global'));
  });

  it('merges a standalone sequence file and clears its standalone state', () => {
    const file: VFSFile = {
      id: 'f1', type: 'FILE', name: 'Seq', parentId: null, extension: '.luml',
      standalone: true, localModel: seqLocalModel(), content: seqView(),
    } as VFSFile;
    useVFSStore.getState().loadProject(projectWith(file));

    const res = addStandaloneToProject('f1');

    expect(res.ok).toBe(true);
    expect(res.mergedCount).toBe(3); // l1, l2, m1

    // The file flipped out of standalone and dropped its private model.
    const updated = useVFSStore.getState().project!.nodes['f1'] as VFSFile;
    expect(updated.standalone).toBe(false);
    expect(updated.localModel).toBeNull();

    // Global model absorbed every element.
    const global = useModelStore.getState().model!;
    expect(Object.keys(global.lifelines ?? {})).toHaveLength(2);
    expect(Object.keys(global.messages ?? {})).toHaveLength(1);

    // The remapped view resolves: every node.elementId exists globally.
    const view = updated.content as DiagramView;
    for (const vn of view.nodes) {
      expect(global.lifelines![vn.elementId]).toBeTruthy();
    }
    const msgId = view.edges[0].relationId;
    expect(global.messages![msgId]).toBeTruthy();
  });

  it('flips the flag without merging when there is no localModel', () => {
    const file: VFSFile = {
      id: 'f2', type: 'FILE', name: 'Flag', parentId: null, extension: '.luml',
      standalone: true, localModel: null, content: seqView(),
    } as VFSFile;
    useVFSStore.getState().loadProject(projectWith(file));

    const res = addStandaloneToProject('f2');

    expect(res).toEqual({ ok: true, mergedCount: 0 });
    expect((useVFSStore.getState().project!.nodes['f2'] as VFSFile).standalone).toBe(false);
  });

  it('is a no-op when the target is not a file', () => {
    const file: VFSFile = {
      id: 'f3', type: 'FILE', name: 'X', parentId: null, extension: '.luml',
      standalone: true, localModel: seqLocalModel(), content: seqView(),
    } as VFSFile;
    useVFSStore.getState().loadProject(projectWith(file));

    expect(addStandaloneToProject('does-not-exist')).toEqual({
      ok: false, mergedCount: 0, reason: 'not-a-file',
    });
  });
});
