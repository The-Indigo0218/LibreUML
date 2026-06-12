import { describe, it, expect, beforeEach } from 'vitest';
import { buildVfsSnapshot } from '../services/vfsSnapshot';
import { reconstructProject } from '../services/reconstructProject';
import { useModelStore } from '../../../store/model.store';
import type {
  SemanticModel,
  LibreUMLProject,
  VFSFile,
  DiagramView,
} from '../../../core/domain/vfs/vfs.types';
import type { ProjectFullResponse } from '../../../api/types';

// ── Builders ────────────────────────────────────────────────────────────────

function baseModel(): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activityNodes: {}, objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, relations: {},
    createdAt: 1, updatedAt: 1,
  } as SemanticModel;
}

/** A model exercising every sequence element. */
function seqModel(): SemanticModel {
  const m = baseModel();
  m.lifelines = {
    A: { id: 'A', kind: 'LIFELINE', name: 'A', participantKind: 'ANONYMOUS', alias: 'A' },
    B: { id: 'B', kind: 'LIFELINE', name: 'B', participantKind: 'ANONYMOUS', alias: 'B' },
  };
  m.interactionFragments = {
    fr1: { id: 'fr1', kind: 'FRAGMENT', name: 'alt', fragmentKind: 'ALT', coveredLifelineIds: ['A', 'B'],
           operands: [{ id: 'op1', guard: 'x>0', messageIds: ['m1'], fragmentIds: [] }] },
  };
  m.gates = {
    g1: { id: 'g1', kind: 'GATE', name: 'in', ownerFragmentId: 'fr1', side: 'LEFT', afterSequenceNumber: 0 },
  };
  m.messages = {
    m1: { id: 'm1', kind: 'MESSAGE', name: 'op', messageKind: 'SYNC', sourceLifelineId: 'A', targetLifelineId: 'B', sequenceNumber: 1, fragmentId: 'fr1' },
    mFound: { id: 'mFound', kind: 'MESSAGE', name: 'evt', messageKind: 'ASYNC', sourceLifelineId: '', targetLifelineId: 'B', sequenceNumber: 2, isFound: true },
    mGate: { id: 'mGate', kind: 'MESSAGE', name: 'cross', messageKind: 'ASYNC', sourceLifelineId: 'A', targetLifelineId: '', sequenceNumber: 3, targetGateId: 'g1' },
  };
  m.stateInvariants = {
    si1: { id: 'si1', kind: 'STATE_INVARIANT', name: 'ready', lifelineId: 'A', constraint: 'ready', afterSequenceNumber: 1 },
  };
  m.interactionUses = {
    u1: { id: 'u1', kind: 'INTERACTION_USE', name: 'Login', coveredLifelineIds: ['A', 'B'], referencedDiagramId: 'other-diag', referencedName: 'Login', afterSequenceNumber: 0 },
  };
  return m;
}

function seqView(diagramId: string): DiagramView {
  return {
    diagramId,
    nodes: [
      { id: 'vnA', elementId: 'A', x: 50, y: 0 },
      { id: 'vnB', elementId: 'B', x: 250, y: 0 },
    ],
    edges: [],
  };
}

const jt = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/**
 * Mirrors cloudSync.service serialization exactly, JSON round-tripping every
 * payload so it matches what an opaque backend stores and returns.
 */
function simulateCloudRoundTrip(project: LibreUMLProject, globalModel: SemanticModel): ProjectFullResponse {
  const vfsSnapshot = jt(buildVfsSnapshot(project));
  const modelData = jt(globalModel as unknown as Record<string, unknown>);

  const diagrams = Object.values(project.nodes)
    .filter((n): n is VFSFile => n.type === 'FILE')
    .map((file) => {
      const viewData = jt({
        ...(file.content ?? { nodes: [], edges: [] }),
        ...(file.standalone && file.localModel ? { _localModel: file.localModel } : {}),
      } as Record<string, unknown>);
      return {
        id: `cloud-${file.id}`, projectId: 'p1', name: file.name,
        diagramType: 'SEQUENCE' as const, path: file.id, viewData,
        version: 1, createdAt: '2026-05-24T00:00:00Z', updatedAt: '2026-05-24T00:00:00Z',
      };
    });

  return {
    project: {
      id: 'p1', name: project.projectName, projectVersion: project.version,
      visibility: 'PRIVATE', version: 1, vfsSnapshot, diagrams: [],
      createdAt: '2026-05-24T00:00:00Z', updatedAt: '2026-05-24T00:00:00Z',
    },
    model: { id: 'mdl', projectId: 'p1', data: modelData, version: 1, updatedAt: '2026-05-24T00:00:00Z' },
    diagrams,
  } as unknown as ProjectFullResponse;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sequence diagram — cloud sync round-trip', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
  });

  function makeProject(): LibreUMLProject {
    const now = 1;
    const globalFile: VFSFile = {
      id: 'fGlobal', name: 'Global.luml', type: 'FILE', parentId: null,
      diagramType: 'SEQUENCE_DIAGRAM', extension: '.luml', isExternal: false,
      content: seqView('fGlobal'), createdAt: now, updatedAt: now,
    };
    const standaloneFile: VFSFile = {
      id: 'fStand', name: 'Standalone.luml', type: 'FILE', parentId: null,
      diagramType: 'SEQUENCE_DIAGRAM', extension: '.luml', isExternal: false,
      standalone: true, localModel: seqModel(),
      content: seqView('fStand'), createdAt: now, updatedAt: now,
    };
    return {
      id: 'p1', projectName: 'P', version: '1.0.0', domainModelId: 'dm',
      nodes: { fGlobal: globalFile, fStand: standaloneFile },
      createdAt: now, updatedAt: now,
    };
  }

  it('preserves the standalone localModel sequence elements through the round-trip', () => {
    const project = makeProject();
    const full = simulateCloudRoundTrip(project, seqModel());

    const rebuilt = reconstructProject(full);
    expect(rebuilt).not.toBeNull();
    const standalone = rebuilt!.nodes['fStand'] as VFSFile;

    expect(standalone.standalone).toBe(true);
    const lm = standalone.localModel!;
    expect(Object.keys(lm.gates ?? {})).toEqual(['g1']);
    expect(Object.keys(lm.stateInvariants ?? {})).toEqual(['si1']);
    expect(Object.keys(lm.interactionUses ?? {})).toEqual(['u1']);
    // Message-level fields survive.
    expect(lm.messages!.mFound.isFound).toBe(true);
    expect(lm.messages!.mGate.targetGateId).toBe('g1');
    expect(lm.interactionUses!.u1.referencedDiagramId).toBe('other-diag');
  });

  it('preserves the non-standalone diagram content (DiagramView) and strips _localModel', () => {
    const project = makeProject();
    const full = simulateCloudRoundTrip(project, seqModel());

    const rebuilt = reconstructProject(full);
    const globalFile = rebuilt!.nodes['fGlobal'] as VFSFile;
    const content = globalFile.content as DiagramView;
    expect(content.nodes).toHaveLength(2);
    expect(globalFile.localModel).toBeUndefined();           // not standalone → no localModel
    expect((content as unknown as Record<string, unknown>)._localModel).toBeUndefined();
  });

  it('preserves the global model sequence elements through loadModel + normalize', () => {
    const project = makeProject();
    const full = simulateCloudRoundTrip(project, seqModel());

    useModelStore.getState().loadModel(full.model.data as unknown as SemanticModel);
    const m = useModelStore.getState().model!;

    expect(m.gates!.g1.ownerFragmentId).toBe('fr1');
    expect(m.stateInvariants!.si1.constraint).toBe('ready');
    expect(m.interactionUses!.u1.coveredLifelineIds).toEqual(['A', 'B']);
    expect(m.messages!.mFound.isFound).toBe(true);
    expect(m.messages!.mGate.targetGateId).toBe('g1');
    expect(m.interactionFragments!.fr1.operands[0].guard).toBe('x>0');
  });

  it('survives the local persist round-trip (libreuml-vfs-storage JSON of the project)', () => {
    // Mirror zustand-persist: partialize → { project }, JSON serialized to
    // localStorage, then rehydrated. The global model rides in project.semanticModel.
    const project = makeProject();
    project.semanticModel = seqModel();

    const persisted = JSON.stringify({ project });
    const rehydrated = JSON.parse(persisted).project as LibreUMLProject;

    // Standalone localModel survives inside the persisted node tree.
    const stand = rehydrated.nodes['fStand'] as VFSFile;
    expect(Object.keys(stand.localModel!.gates ?? {})).toEqual(['g1']);
    expect(stand.localModel!.messages!.mGate.targetGateId).toBe('g1');

    // Global model is restored through the same loadModel + normalize path.
    useModelStore.getState().loadModel(rehydrated.semanticModel!);
    const m = useModelStore.getState().model!;
    expect(Object.keys(m.stateInvariants!)).toEqual(['si1']);
    expect(m.messages!.mFound.isFound).toBe(true);
  });

  it('normalize() backfills the new collections for a pre-Fase-4 model lacking them', () => {
    const legacy = baseModel();
    delete (legacy as Partial<SemanticModel>).lifelines;
    // gates / stateInvariants / interactionUses never existed on this old model.
    useModelStore.getState().loadModel(legacy as SemanticModel);
    const m = useModelStore.getState().model!;
    expect(m.gates).toEqual({});
    expect(m.stateInvariants).toEqual({});
    expect(m.interactionUses).toEqual({});
    expect(m.lifelines).toEqual({});
  });
});
