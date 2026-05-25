import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../../../../../store/model.store';
import { useVFSStore } from '../../../../../store/project-vfs.store';
import { buildSequenceDiagramNodes } from '../sequenceDiagramNodes';
import type {
  SemanticModel,
  LibreUMLProject,
  VFSFile,
  DiagramView,
} from '../../../../../core/domain/vfs/vfs.types';
import {
  isLifelineViewModel,
  isMessageViewModel,
  isActivationViewModel,
  isFragmentViewModel,
} from '../../../../../adapters/view-models/node.view-model';

function freshModel() {
  useModelStore.getState().resetModel();
  useModelStore.getState().initModel('seq-e2e');
}

function emptySemanticModel(id: string, name: string): SemanticModel {
  const now = Date.now();
  return {
    id,
    name,
    version: '1',
    packages: {},
    classes: {},
    interfaces: {},
    enums: {},
    dataTypes: {},
    attributes: {},
    operations: {},
    actors: {},
    useCases: {},
    activityNodes: {},
    objectInstances: {},
    components: {},
    nodes: {},
    artifacts: {},
    lifelines: {},
    messages: {},
    activations: {},
    interactionFragments: {},
    gates: {},
    stateInvariants: {},
    interactionUses: {},
    relations: {},
    createdAt: now,
    updatedAt: now,
  };
}

function diagramFile(
  id: string,
  standalone: boolean,
  lifelineEntries: [string, number][],
  msgEntries: any[],
  activationEntries: any[],
  fragmentEntries?: any[],
): VFSFile {
  const now = Date.now();
  const lifelines: Record<string, any> = {};
  const messages: Record<string, any> = {};
  const activations: Record<string, any> = {};
  const interactionFragments: Record<string, any> = {};

  for (const [llId, x] of lifelineEntries) {
    lifelines[llId] = { id: llId, kind: 'LIFELINE', name: llId, participantKind: 'CLASS', alias: llId };
  }
  for (const m of msgEntries) {
    messages[m[0]] = {
      id: m[0], kind: 'MESSAGE', name: `op${m[4] || m[0]}`,
      messageKind: m[3] || 'SYNC', sourceLifelineId: m[1], targetLifelineId: m[2],
      sequenceNumber: m[4] || 1, ...(m[5] || {}),
    };
  }
  for (const a of activationEntries) {
    activations[a[0]] = { id: a[0], kind: 'ACTIVATION', lifelineId: a[1], startMessageId: a[2], endMessageId: a[3] };
  }
  if (fragmentEntries) {
    for (const f of fragmentEntries) {
      interactionFragments[f[0]] = {
        id: f[0], kind: 'FRAGMENT', name: f[1], fragmentKind: f[1],
        coveredLifelineIds: f[2], operands: f[3],
      };
    }
  }

  const viewNodes = lifelineEntries.map(([llId, x]) => ({
    id: `vn-${llId}`, elementId: llId, x, y: 0,
  }));

  const content: DiagramView = { diagramId: id, nodes: viewNodes, edges: [] };

  const sem = standalone ? emptySemanticModel(`local-${id}`, `local-${id}`) : null;
  if (sem) {
    sem.lifelines = lifelines;
    sem.messages = messages;
    sem.activations = activations;
    if (Object.keys(interactionFragments).length) sem.interactionFragments = interactionFragments;
  }

  return {
    id, name: `${id}.luml`, type: 'FILE', parentId: null,
    diagramType: 'SEQUENCE_DIAGRAM' as const, extension: '.luml', isExternal: false,
    standalone, content, localModel: sem,
    createdAt: now, updatedAt: now,
  };
}

function loadProject(files: Record<string, VFSFile>, globalModel?: SemanticModel) {
  useVFSStore.getState().loadProject({
    id: 'proj-e2e',
    projectName: 'E2E',
    version: '1.0.0',
    domainModelId: 'dm-1',
    nodes: files,
    semanticModel: globalModel,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as LibreUMLProject);
}

function getFile(id: string): VFSFile {
  return useVFSStore.getState().project!.nodes[id] as VFSFile;
}

function getModel(id: string): SemanticModel {
  const f = getFile(id);
  if (f.standalone && f.localModel) return f.localModel;
  return useModelStore.getState().model!;
}

function getView(id: string): DiagramView {
  return getFile(id).content as DiagramView;
}

function jt<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Sequence Diagram E2E — store → builder → persist → reload', () => {
  beforeEach(() => {
    freshModel();
  });

  function runFlow(
    label: string,
    fileId: string,
    standalone: boolean,
    lifelineEntries: [string, number][],
    msgEntries: any[],
    activationEntries: any[],
    fragmentEntries?: any[],
  ) {
    it(`${label}: creates lifelines, messages, builds, persists, reloads`, () => {
      // ── 1. Create diagram file with all data ─────────────────────────────
      const file = diagramFile(fileId, standalone, lifelineEntries, msgEntries, activationEntries, fragmentEntries);

      if (standalone) {
        loadProject({ [fileId]: file });
      } else {
        const sm = emptySemanticModel('global-model', 'Global');
        for (const [llId] of lifelineEntries) {
          sm.lifelines![llId] = { id: llId, kind: 'LIFELINE', name: llId, participantKind: 'CLASS', alias: llId } as any;
        }
        for (const m of msgEntries) {
          sm.messages![m[0]] = {
            id: m[0], kind: 'MESSAGE', name: `op${m[4] || m[0]}`,
            messageKind: m[3] || 'SYNC', sourceLifelineId: m[1], targetLifelineId: m[2],
            sequenceNumber: m[4] || 1, ...(m[5] || {}),
          } as any;
        }
        for (const a of activationEntries) {
          sm.activations![a[0]] = { id: a[0], kind: 'ACTIVATION', lifelineId: a[1], startMessageId: a[2], endMessageId: a[3] } as any;
        }
        if (fragmentEntries) {
          for (const f of fragmentEntries) {
            sm.interactionFragments![f[0]] = {
              id: f[0], kind: 'FRAGMENT', name: f[1], fragmentKind: f[1],
              coveredLifelineIds: f[2], operands: f[3],
            } as any;
          }
        }
        loadProject({ [fileId]: file }, sm);
      }

      const model = getModel(fileId);
      const view = getView(fileId);

      // ── 2. Verify data was stored ────────────────────────────────────────
      expect(Object.keys(model.lifelines ?? {}).length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(model.messages ?? {}).length).toBeGreaterThanOrEqual(1);

      // ── 3. Build view models ─────────────────────────────────────────────
      const ctx = { diagramView: view, model: jt(model), isStandalone: standalone, activeTabId: null, handleNoteUpdate: () => {} };
      const viewModels = buildSequenceDiagramNodes(ctx);

      // ── 4. Assert builder output ─────────────────────────────────────────
      const lifelines = viewModels.filter((vm) => vm.type === 'umlLifeline');
      const messages = viewModels.filter((vm) => vm.type === 'umlMessage');
      const activations = viewModels.filter((vm) => vm.type === 'umlActivation');

      expect(lifelines.length).toBeGreaterThanOrEqual(2);
      expect(messages.length).toBeGreaterThanOrEqual(1);

      lifelines.forEach((l) => expect(isLifelineViewModel(l.data)).toBe(true));
      messages.forEach((m) => expect(isMessageViewModel(m.data)).toBe(true));
      activations.forEach((a) => expect(isActivationViewModel(a.data)).toBe(true));

      // Geometric consistency
      const xs = lifelines.map((l) => l.position.x);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i]).toBeGreaterThan(xs[i - 1]);
      }

      for (const msg of messages) {
        if (isMessageViewModel(msg.data) && !msg.data.isSelfMessage) {
          expect(Math.abs(msg.data.length)).toBeGreaterThan(0);
        }
      }

      // ── 5. JSON round-trip ───────────────────────────────────────────────
      const persisted = jt(useVFSStore.getState().project);
      const reloadedFile = persisted.nodes[fileId] as VFSFile;
      expect(reloadedFile).toBeDefined();

      if (standalone) {
        expect(reloadedFile.standalone).toBe(true);
        expect(reloadedFile.localModel).toBeDefined();
        expect(Object.keys(reloadedFile.localModel!.lifelines ?? {}).length).toBeGreaterThanOrEqual(2);
      } else {
        expect(reloadedFile.content).toBeDefined();
        const rv = reloadedFile.content as DiagramView;
        expect(rv.nodes).toHaveLength(view.nodes.length);
      }

      // ── 6. Semantic data survives ────────────────────────────────────────
      const finalModel = standalone ? reloadedFile.localModel! : persisted.semanticModel;
      expect(Object.keys(finalModel.lifelines ?? {}).length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(finalModel.messages ?? {}).length).toBeGreaterThanOrEqual(1);
    });
  }

  runFlow('global mode', 'fGlobal', false,
    [['llA', 50], ['llB', 250]],
    [['m1', 'llA', 'llB', 'SYNC', 1], ['m2', 'llB', 'llA', 'REPLY', 2]],
    [['act1', 'llB', 'm1', 'm2']],
  );

  runFlow('standalone mode', 'fStand', true,
    [['llA', 50], ['llB', 300], ['llC', 500]],
    [
      ['m1', 'llA', 'llB', 'SYNC', 1],
      ['m2', 'llB', 'llB', 'ASYNC', 2],
      ['m3', 'llB', 'llC', 'SYNC', 3],
      ['m4', 'llC', 'llB', 'REPLY', 4],
      ['m5', 'llB', 'llA', 'REPLY', 5],
    ],
    [['act1', 'llB', 'm1', 'm5'], ['act2', 'llC', 'm3', 'm4']],
  );

  runFlow('with fragments', 'fFrag', false,
    [['llA', 50], ['llB', 250]],
    [['m1', 'llA', 'llB', 'SYNC', 1], ['m2', 'llA', 'llB', 'ASYNC', 2]],
    [['act1', 'llB', 'm1', 'm2']],
    [['fr1', 'ALT', ['llA', 'llB'], [
      { id: 'op1', guard: 'x > 0', messageIds: ['m1'], fragmentIds: [] },
      { id: 'op2', guard: 'else', messageIds: ['m2'], fragmentIds: [] },
    ]]],
  );

  function testModel(overrides: Record<string, any>): any {
    return {
      id: 'test', name: 'test', version: '1',
      packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
      attributes: {}, operations: {}, actors: {}, useCases: {},
      activityNodes: {}, objectInstances: {}, components: {}, nodes: {}, artifacts: {},
      relations: {}, lifelines: {}, messages: {}, activations: {},
      interactionFragments: {}, gates: {}, stateInvariants: {}, interactionUses: {},
      createdAt: 0, updatedAt: 0,
      ...overrides,
    };
  }

  it('rejects orphan lifelines gracefully (builder skips missing IR)', () => {
    const model = testModel({ lifelines: {} });
    const view = { diagramId: 'fOrphan', nodes: [{ id: 'vn-orphan', elementId: 'no-such-ll', x: 50, y: 0 }], edges: [] };
    const ctx = { diagramView: view, model, isStandalone: false, activeTabId: null, handleNoteUpdate: () => {} };
    const vms = buildSequenceDiagramNodes(ctx);
    const lifelines = vms.filter((vm) => vm.type === 'umlLifeline');
    expect(lifelines).toHaveLength(0);
  });

  it('builds a diagram with found/lost messages', () => {
    const model = testModel({
      lifelines: {
        llA: { id: 'llA', kind: 'LIFELINE', name: 'A', participantKind: 'CLASS', alias: 'A' },
      },
      messages: {
        mFound: {
          id: 'mFound', kind: 'MESSAGE', name: 'event', messageKind: 'ASYNC',
          sourceLifelineId: '', targetLifelineId: 'llA', sequenceNumber: 1, isFound: true,
        },
        mLost: {
          id: 'mLost', kind: 'MESSAGE', name: 'gone', messageKind: 'ASYNC',
          sourceLifelineId: 'llA', targetLifelineId: '', sequenceNumber: 2, isLost: true,
        },
      },
    });
    const view = { diagramId: 'fFL', nodes: [{ id: 'vnA', elementId: 'llA', x: 100, y: 0 }], edges: [] };
    const ctx = { diagramView: view, model, isStandalone: false, activeTabId: null, handleNoteUpdate: () => {} };
    const vms = buildSequenceDiagramNodes(ctx);
    const msgs = vms.filter((vm) => vm.type === 'umlMessage');
    expect(msgs).toHaveLength(2);
    msgs.forEach((m) => {
      if (isMessageViewModel(m.data)) {
        expect(m.data.isSelfMessage).toBe(false);
      }
    });
  });
});
