/**
 * Covers the store routing in sequenceInserts: every insert helper writes
 * through the `ops` resolved by resolveActiveSequence, which must reach the
 * global model store for a project file and the file-local model for a
 * standalone one. Also pins the precondition guards (translated toasts, no
 * mutation) and the self-message active-execution gate.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../../../../store/model.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useToastStore } from '../../../../store/toast.store';
import { useUiStore } from '../../../../store/uiStore';
import {
  insertFragmentIntoActiveDiagram,
  insertInteractionUseIntoActiveDiagram,
  insertContinuationIntoActiveDiagram,
  insertCoregionIntoActiveDiagram,
  insertEndpointMessageIntoActiveDiagram,
  insertGeneralOrderingIntoActiveDiagram,
  insertTimeConstraintIntoActiveDiagram,
  insertSelfMessageIntoActiveDiagram,
  reverseMessageInActiveDiagram,
  deleteMessageInActiveDiagram,
} from '../sequenceInserts';
import type {
  SemanticModel,
  LibreUMLProject,
  VFSFile,
  DiagramView,
} from '../../../../core/domain/vfs/vfs.types';

const TAB = 'seq-tab';

function emptySemanticModel(id: string): SemanticModel {
  const now = Date.now();
  return {
    id, name: id, version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, activations: {}, interactionFragments: {},
    gates: {}, stateInvariants: {}, interactionUses: {}, relations: {},
    createdAt: now, updatedAt: now,
  } as SemanticModel;
}

/** Seeds lifelines + messages into a model and returns the matching view nodes. */
function seed(model: SemanticModel, lifelineIds: string[], messageCount: number) {
  lifelineIds.forEach((id) => {
    model.lifelines![id] = {
      id, kind: 'LIFELINE', name: id, alias: id, participantKind: 'CLASS',
    } as any;
  });
  for (let i = 1; i <= messageCount; i++) {
    model.messages![`m${i}`] = {
      id: `m${i}`, kind: 'MESSAGE', name: `op${i}`, messageKind: 'SYNC',
      sourceLifelineId: lifelineIds[0], targetLifelineId: lifelineIds[1] ?? lifelineIds[0],
      sequenceNumber: i,
    } as any;
  }
  return lifelineIds.map((id, i) => ({ id: `vn-${id}`, elementId: id, x: i * 200, y: 0 }));
}

/**
 * Loads a one-file project whose diagram is either project-backed (model lives
 * in the global store) or standalone (model lives on the file).
 */
function setup(opts: {
  standalone: boolean;
  lifelines?: string[];
  messages?: number;
  /** Seeds an execution on this lifeline, opened by m1 and never replied to. */
  openExecutionOn?: string;
}) {
  const { standalone, lifelines = ['ll-a', 'll-b'], messages = 0, openExecutionOn } = opts;

  useModelStore.getState().resetModel();
  useModelStore.getState().initModel('dm-1');

  // Seed a plain (non-frozen) model and let the stores take ownership of it via
  // loadProject — a model already inside the immer-backed store is frozen and
  // cannot be seeded in place.
  const seeded = emptySemanticModel(standalone ? `local-${TAB}` : 'dm-1');
  const viewNodes = seed(seeded, lifelines, messages);
  if (openExecutionOn) {
    seeded.activations!['act-1'] = {
      id: 'act-1', kind: 'ACTIVATION', lifelineId: openExecutionOn, startMessageId: 'm1',
    } as any;
  }
  const localModel = standalone ? seeded : null;

  const content: DiagramView = { diagramId: TAB, nodes: viewNodes, edges: [] };
  const file: VFSFile = {
    id: TAB, name: 'seq.luml', type: 'FILE', parentId: null,
    diagramType: 'SEQUENCE_DIAGRAM' as const, extension: '.luml', isExternal: false,
    standalone, content, localModel,
    createdAt: Date.now(), updatedAt: Date.now(),
  } as VFSFile;

  useVFSStore.getState().loadProject({
    id: 'proj', projectName: 'P', version: '1.0.0', domainModelId: 'dm-1',
    nodes: { [TAB]: file },
    semanticModel: standalone ? undefined : seeded,
    createdAt: Date.now(), updatedAt: Date.now(),
  } as LibreUMLProject);

  useWorkspaceStore.setState({ activeTabId: TAB });
}

/** The model the active diagram actually writes to. */
function activeModel(standalone: boolean): SemanticModel {
  if (!standalone) return useModelStore.getState().model!;
  return (useVFSStore.getState().project!.nodes[TAB] as VFSFile).localModel!;
}

function toastMessages(): string[] {
  return useToastStore.getState().toasts.map((t) => t.message);
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  useWorkspaceStore.setState({ activeTabId: null });
});

// ─── Store routing (project vs standalone) ───────────────────────────────────

describe.each([
  ['project-backed', false],
  ['standalone', true],
] as const)('sequenceInserts — %s diagram writes to the right model', (_label, standalone) => {
  it('creates a fragment covering every lifeline on the canvas', () => {
    setup({ standalone, messages: 2 });
    insertFragmentIntoActiveDiagram('ALT');

    const frags = Object.values(activeModel(standalone).interactionFragments ?? {});
    expect(frags).toHaveLength(1);
    expect(frags[0].fragmentKind).toBe('ALT');
    expect(frags[0].coveredLifelineIds).toEqual(['ll-a', 'll-b']);
    // ALT seeds two operands, the second guarded with `else`.
    expect(frags[0].operands).toHaveLength(2);
    expect(frags[0].operands[1].guard).toBe('else');
  });

  it('creates a ref anchored after the last message', () => {
    setup({ standalone, messages: 3 });
    insertInteractionUseIntoActiveDiagram();

    const uses = Object.values(activeModel(standalone).interactionUses ?? {});
    expect(uses).toHaveLength(1);
    expect(uses[0].coveredLifelineIds).toEqual(['ll-a', 'll-b']);
    expect(uses[0].afterSequenceNumber).toBe(3);
  });

  it('creates a continuation covering every lifeline', () => {
    setup({ standalone, messages: 1 });
    insertContinuationIntoActiveDiagram();

    const conts = Object.values(activeModel(standalone).continuations ?? {});
    expect(conts).toHaveLength(1);
    expect(conts[0].coveredLifelineIds).toEqual(['ll-a', 'll-b']);
  });

  it('creates a coregion spanning the full message range of one lifeline', () => {
    setup({ standalone, messages: 4 });
    insertCoregionIntoActiveDiagram('ll-b');

    const crs = Object.values(activeModel(standalone).coregions ?? {});
    expect(crs).toHaveLength(1);
    expect(crs[0].lifelineId).toBe('ll-b');
    expect(crs[0].fromSequence).toBe(0);
    expect(crs[0].toSequence).toBe(4);
  });

  it('appends a found message after the highest sequence number', () => {
    setup({ standalone, messages: 2 });
    insertEndpointMessageIntoActiveDiagram('found', 'll-b');

    const created = Object.values(activeModel(standalone).messages ?? {}).find(
      (m) => (m as any).isFound,
    )!;
    expect(created).toBeDefined();
    expect(created.targetLifelineId).toBe('ll-b');
    expect(created.sourceLifelineId).toBe('');
    expect(created.sequenceNumber).toBe(3);
  });

  it('creates a general ordering between the two earliest messages', () => {
    setup({ standalone, messages: 3 });
    insertGeneralOrderingIntoActiveDiagram();

    const gos = Object.values(activeModel(standalone).generalOrderings ?? {});
    expect(gos).toHaveLength(1);
    expect(gos[0].beforeMessageId).toBe('m1');
    expect(gos[0].afterMessageId).toBe('m2');
  });

  it('creates a DURATION constraint across the first two messages', () => {
    setup({ standalone, messages: 2 });
    insertTimeConstraintIntoActiveDiagram('duration');

    const tcs = Object.values(activeModel(standalone).timeConstraints ?? {});
    expect(tcs).toHaveLength(1);
    expect(tcs[0].constraintKind).toBe('DURATION');
    expect(tcs[0].fromMessageId).toBe('m1');
    expect(tcs[0].toMessageId).toBe('m2');
  });

  it('reverses a message in place', () => {
    setup({ standalone, messages: 1 });
    reverseMessageInActiveDiagram('m1');

    const msg = activeModel(standalone).messages!['m1'];
    expect(msg.sourceLifelineId).toBe('ll-b');
    expect(msg.targetLifelineId).toBe('ll-a');
  });

  it('deletes a message', () => {
    setup({ standalone, messages: 2 });
    deleteMessageInActiveDiagram('m1');

    expect(activeModel(standalone).messages!['m1']).toBeUndefined();
    expect(activeModel(standalone).messages!['m2']).toBeDefined();
  });
});

// ─── Precondition guards ─────────────────────────────────────────────────────

describe('sequenceInserts — precondition guards', () => {
  it('warns instead of creating a fragment when there is no lifeline', () => {
    setup({ standalone: false, lifelines: [] });
    insertFragmentIntoActiveDiagram('LOOP');

    expect(Object.keys(activeModel(false).interactionFragments ?? {})).toHaveLength(0);
    expect(toastMessages()).toHaveLength(1);
  });

  it('warns instead of creating a ref when there is no lifeline', () => {
    setup({ standalone: false, lifelines: [] });
    insertInteractionUseIntoActiveDiagram();

    expect(Object.keys(activeModel(false).interactionUses ?? {})).toHaveLength(0);
    expect(toastMessages()).toHaveLength(1);
  });

  it('warns instead of creating a general ordering with fewer than two messages', () => {
    setup({ standalone: false, messages: 1 });
    insertGeneralOrderingIntoActiveDiagram();

    expect(Object.keys(activeModel(false).generalOrderings ?? {})).toHaveLength(0);
    expect(toastMessages()).toHaveLength(1);
  });

  it('warns instead of creating a TIME mark with no messages', () => {
    setup({ standalone: false, messages: 0 });
    insertTimeConstraintIntoActiveDiagram('time');

    expect(Object.keys(activeModel(false).timeConstraints ?? {})).toHaveLength(0);
    expect(toastMessages()).toHaveLength(1);
  });

  it('emits translated copy, not a raw i18n key', () => {
    setup({ standalone: false, lifelines: [] });
    insertContinuationIntoActiveDiagram();

    const [msg] = toastMessages();
    expect(msg).toMatch(/^⚠️ /);
    expect(msg).not.toContain('sequenceInserts.');
  });

  it('does nothing at all when the active tab is not a sequence diagram', () => {
    setup({ standalone: false, messages: 2 });
    useWorkspaceStore.setState({ activeTabId: null });

    insertFragmentIntoActiveDiagram('OPT');

    expect(Object.keys(activeModel(false).interactionFragments ?? {})).toHaveLength(0);
    expect(toastMessages()).toHaveLength(0);
  });
});

// ─── Self-message active-execution gate ──────────────────────────────────────

describe('sequenceInserts — self-message execution gate', () => {
  it('opens the warning modal instead of creating a stray top-level frame', () => {
    setup({ standalone: false, messages: 2 });
    const before = Object.keys(activeModel(false).messages ?? {}).length;

    insertSelfMessageIntoActiveDiagram('ll-a');

    expect(useUiStore.getState().activeModal).toBe('self-message-warning');
    expect(Object.keys(activeModel(false).messages ?? {})).toHaveLength(before);
  });

  it('creates the self-message when forced past the warning', () => {
    setup({ standalone: false, messages: 2 });

    insertSelfMessageIntoActiveDiagram('ll-a', undefined, true);

    const selfMsgs = Object.values(activeModel(false).messages ?? {}).filter(
      (m) => m.sourceLifelineId === 'll-a' && m.targetLifelineId === 'll-a',
    );
    expect(selfMsgs).toHaveLength(1);
  });

  it('creates it without warning when an execution is open across the drop slot', () => {
    // m1 opened an execution on ll-a that never replied → still active at slot 3.
    setup({ standalone: false, messages: 2, openExecutionOn: 'll-a' });
    useUiStore.setState({ activeModal: null });

    insertSelfMessageIntoActiveDiagram('ll-a');

    expect(useUiStore.getState().activeModal).not.toBe('self-message-warning');
    const selfMsgs = Object.values(activeModel(false).messages ?? {}).filter(
      (m) => m.sourceLifelineId === 'll-a' && m.targetLifelineId === 'll-a',
    );
    expect(selfMsgs).toHaveLength(1);
  });
});
