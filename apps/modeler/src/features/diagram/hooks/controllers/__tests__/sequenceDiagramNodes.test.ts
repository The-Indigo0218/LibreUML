import { describe, it, expect } from 'vitest';
import {
  buildSequenceDiagramNodes,
  computeHierarchicalNumbers,
  stateInvariantSlotY,
  estimateStateInvariantWidth,
  messageYForIndex,
} from '../sequenceDiagramNodes';
import type {
  SemanticModel,
  DiagramView,
  IRLifeline,
  IRMessage,
  IRActivation,
  IRInteractionFragment,
  IRStateInvariant,
  IRInteractionUse,
  IRGate,
  IRGeneralOrdering,
} from '../../../../../core/domain/vfs/vfs.types';
import type { NodeBuilderContext } from '../sharedNodeBuilders';
import {
  isLifelineViewModel,
  isMessageViewModel,
  isActivationViewModel,
  isFragmentViewModel,
  isStateInvariantViewModel,
  isInteractionUseViewModel,
  isGateViewModel,
  isGeneralOrderingViewModel,
} from '../../../../../adapters/view-models/node.view-model';

function makeModel(overrides: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'model-1',
    name: 'Test',
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
    relations: {},
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as SemanticModel;
}

function makeLifeline(id: string, partial: Partial<IRLifeline> = {}): IRLifeline {
  return {
    id,
    kind: 'LIFELINE',
    name: id,
    participantKind: 'ANONYMOUS',
    alias: id,
    ...partial,
  };
}

function makeMessage(id: string, src: string, tgt: string, seq: number): IRMessage {
  return {
    id,
    kind: 'MESSAGE',
    name: `msg-${id}`,
    messageKind: 'SYNC',
    sourceLifelineId: src,
    targetLifelineId: tgt,
    sequenceNumber: seq,
  };
}

function makeCtx(model: SemanticModel, diagramView: DiagramView): NodeBuilderContext {
  return {
    diagramView,
    model,
    isStandalone: false,
    activeTabId: null,
    handleNoteUpdate: () => {},
  };
}

describe('buildSequenceDiagramNodes', () => {
  it('returns empty array for empty diagram', () => {
    const model = makeModel();
    const view: DiagramView = { diagramId: 'd1', nodes: [], edges: [] };
    expect(buildSequenceDiagramNodes(makeCtx(model, view))).toEqual([]);
  });

  it('emits one Lifeline view model per lifeline view node', () => {
    const ll1 = makeLifeline('ll1');
    const model = makeModel({ lifelines: { ll1 } });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('umlLifeline');
    expect(isLifelineViewModel(result[0].data)).toBe(true);
  });

  it('emits a Message view model for a message between two visible lifelines', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const msg = makeMessage('m1', 'll1', 'll2', 1);
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: { m1: msg },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const messageNode = result.find((n) => n.type === 'umlMessage');
    expect(messageNode).toBeDefined();
    expect(messageNode && isMessageViewModel(messageNode.data)).toBe(true);
    if (messageNode && isMessageViewModel(messageNode.data)) {
      // length = (ll2.x + headW/2) - (ll1.x + headW/2) = 200
      expect(messageNode.data.length).toBe(200);
      expect(messageNode.data.isSelfMessage).toBe(false);
    }
  });

  it('marks a message with same source and target as self-message', () => {
    const ll1 = makeLifeline('ll1');
    const msg = makeMessage('m1', 'll1', 'll1', 1);
    const model = makeModel({
      lifelines: { ll1 },
      messages: { m1: msg },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 100, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const messageNode = result.find((n) => n.type === 'umlMessage');
    expect(messageNode).toBeDefined();
    if (messageNode && isMessageViewModel(messageNode.data)) {
      expect(messageNode.data.isSelfMessage).toBe(true);
      expect(messageNode.data.length).toBe(0);
    }
  });

  it('positions a message on its computed slot when no manual override (B2)', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      messages: { m1: makeMessage('m1', 'll1', 'll2', 1) },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const node = buildSequenceDiagramNodes(makeCtx(model, view)).find((n) => n.type === 'umlMessage');
    expect(node!.position.y).toBe(messageYForIndex(1));
    expect(isMessageViewModel(node!.data) && node!.data.isManualY).toBeFalsy();
  });

  it('honors a manual-Y override over the computed slot (B2)', () => {
    const msg: IRMessage = { ...makeMessage('m1', 'll1', 'll2', 1), manualY: 333 };
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      messages: { m1: msg },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const node = buildSequenceDiagramNodes(makeCtx(model, view)).find((n) => n.type === 'umlMessage');
    expect(node!.position.y).toBe(333); // manualY wins over the derived slot Y
    expect(isMessageViewModel(node!.data) && node!.data.isManualY).toBe(true);
  });

  it('skips messages whose endpoints are not present in the diagram', () => {
    const ll1 = makeLifeline('ll1');
    const msgOrphan = makeMessage('m1', 'll1', 'll99', 1); // ll99 not in diagram
    const model = makeModel({
      lifelines: { ll1 },
      messages: { m1: msgOrphan },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result.find((n) => n.type === 'umlMessage')).toBeUndefined();
  });

  it('emits an Activation view model when the IR contains one', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const msg = makeMessage('m1', 'll1', 'll2', 1);
    const activation: IRActivation = {
      id: 'act1',
      kind: 'ACTIVATION',
      name: '',
      lifelineId: 'll2',
      startMessageId: 'm1',
    };
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: { m1: msg },
      activations: { act1: activation },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const activationNode = result.find((n) => n.type === 'umlActivation');
    expect(activationNode).toBeDefined();
    if (activationNode && isActivationViewModel(activationNode.data)) {
      expect(activationNode.data.isOpen).toBe(true);
      expect(activationNode.data.nestingDepth).toBe(0);
      // Top of activation should align with the message's Y band.
      const messageNode = result.find((n) => n.type === 'umlMessage');
      expect(activationNode.position.y).toBeCloseTo(messageNode!.position.y, 0);
    }
  });

  it('honours a manual activation override (P3 hybrid layout)', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const msg = makeMessage('m1', 'll1', 'll2', 1);
    const activation: IRActivation = {
      id: 'act1',
      kind: 'ACTIVATION',
      name: '',
      lifelineId: 'll2',
      startMessageId: 'm1',
      manualTopY: 333,
      manualHeight: 88,
    };
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: { m1: msg },
      activations: { act1: activation },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const node = result.find((n) => n.type === 'umlActivation');
    expect(node).toBeDefined();
    if (node && isActivationViewModel(node.data)) {
      expect(node.position.y).toBe(333);   // manualTopY wins over derived Y
      expect(node.data.height).toBe(88);   // manualHeight wins over derived height
      expect(node.data.isManual).toBe(true);
    }
  });

  it('skips activations whose lifeline is not present in the diagram', () => {
    const ll1 = makeLifeline('ll1');
    const orphanAct: IRActivation = {
      id: 'act1',
      kind: 'ACTIVATION',
      name: '',
      lifelineId: 'll99',
      startMessageId: 'm1',
    };
    const model = makeModel({
      lifelines: { ll1 },
      activations: { act1: orphanAct },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result.find((n) => n.type === 'umlActivation')).toBeUndefined();
  });

  it('emits a Fragment view model with width spanning covered lifelines', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const msg = makeMessage('m1', 'll1', 'll2', 1);
    const frag: IRInteractionFragment = {
      id: 'f1',
      kind: 'FRAGMENT',
      name: 'alt-1',
      fragmentKind: 'ALT',
      coveredLifelineIds: ['ll1', 'll2'],
      operands: [
        { id: 'op1', guard: 'x>0', messageIds: ['m1'], fragmentIds: [] },
        { id: 'op2', guard: 'else', messageIds: [], fragmentIds: [] },
      ],
    };
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: { m1: msg },
      interactionFragments: { f1: frag },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const fragNode = result.find((n) => n.type === 'umlFragment');
    expect(fragNode).toBeDefined();
    if (fragNode && isFragmentViewModel(fragNode.data)) {
      expect(fragNode.data.fragmentKind).toBe('ALT');
      expect(fragNode.data.operands).toHaveLength(2);
      // Width should span at least from ll1 center to ll2 center.
      const ll1CenterX = 50 + 70; // headWidth/2 = 70
      const ll2CenterX = 250 + 70;
      expect(fragNode.data.width).toBeGreaterThanOrEqual(ll2CenterX - ll1CenterX);
    }
  });

  it('skips fragments whose covered lifelines are all absent from the diagram', () => {
    const ll1 = makeLifeline('ll1');
    const frag: IRInteractionFragment = {
      id: 'f1',
      kind: 'FRAGMENT',
      name: 'orphan',
      fragmentKind: 'OPT',
      coveredLifelineIds: ['ll99'],
      operands: [{ id: 'op1', messageIds: [], fragmentIds: [] }],
    };
    const model = makeModel({
      lifelines: { ll1 },
      interactionFragments: { f1: frag },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result.find((n) => n.type === 'umlFragment')).toBeUndefined();
  });

  it('renders fragments BEFORE lifelines/messages so they sit visually behind', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const frag: IRInteractionFragment = {
      id: 'f1',
      kind: 'FRAGMENT',
      name: 'alt',
      fragmentKind: 'ALT',
      coveredLifelineIds: ['ll1', 'll2'],
      operands: [{ id: 'op1', messageIds: [], fragmentIds: [] }],
    };
    const model = makeModel({
      lifelines: { ll1, ll2 },
      interactionFragments: { f1: frag },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const fragIdx = result.findIndex((n) => n.type === 'umlFragment');
    const lifelineIdx = result.findIndex((n) => n.type === 'umlLifeline');
    expect(fragIdx).toBeGreaterThanOrEqual(0);
    expect(lifelineIdx).toBeGreaterThanOrEqual(0);
    expect(fragIdx).toBeLessThan(lifelineIdx);
  });

  it('populates displayNumber on message view models', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: {
        m1: makeMessage('m1', 'll1', 'll2', 1),
        m2: makeMessage('m2', 'll2', 'll1', 2),
      },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const messages = result.filter((n) => n.type === 'umlMessage');
    expect(messages).toHaveLength(2);
    const m1Node = messages.find((n) => n.data.domainId === 'm1');
    const m2Node = messages.find((n) => n.data.domainId === 'm2');
    expect(isMessageViewModel(m1Node!.data) && m1Node!.data.displayNumber).toBe('1');
    expect(isMessageViewModel(m2Node!.data) && m2Node!.data.displayNumber).toBe('2');
  });

  it('orders messages by sequenceNumber', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: {
        m2: makeMessage('m2', 'll1', 'll2', 2),
        m1: makeMessage('m1', 'll1', 'll2', 1),
      },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const messages = result.filter((n) => n.type === 'umlMessage');
    expect(messages).toHaveLength(2);
    // The first message (by Y) should be the one with sequenceNumber=1
    const sortedByY = [...messages].sort((a, b) => a.position.y - b.position.y);
    expect(sortedByY[0].data.domainId).toBe('m1');
    expect(sortedByY[1].data.domainId).toBe('m2');
  });
});

// ─── State invariants ─────────────────────────────────────────────────────────

function makeStateInvariant(
  id: string,
  lifelineId: string,
  constraint: string,
  afterSequenceNumber: number,
): IRStateInvariant {
  return { id, kind: 'STATE_INVARIANT', name: constraint, lifelineId, constraint, afterSequenceNumber };
}

describe('buildSequenceDiagramNodes — state invariants', () => {
  it('emits a state-invariant view model centred on its lifeline', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const si = makeStateInvariant('si1', 'll1', 'x>0', 1);
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: { m1: makeMessage('m1', 'll1', 'll2', 1) },
      stateInvariants: { si1: si },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const siNode = result.find((n) => n.type === 'umlStateInvariant');
    expect(siNode).toBeDefined();
    expect(siNode && isStateInvariantViewModel(siNode.data)).toBe(true);
    if (siNode && isStateInvariantViewModel(siNode.data)) {
      const width = estimateStateInvariantWidth('x>0');
      const ll1CenterX = 50 + 70; // headWidth/2 = 70
      // Box is centred on the lifeline at the boundary below message slot 1.
      expect(siNode.position.x).toBeCloseTo(ll1CenterX - width / 2, 0);
      expect(siNode.position.y).toBeCloseTo(stateInvariantSlotY(1) - siNode.data.height / 2, 0);
      expect(siNode.data.width).toBe(width);
      expect(siNode.data.constraint).toBe('x>0');
    }
  });

  it('clamps afterSequenceNumber within [0, messageCount]', () => {
    const ll1 = makeLifeline('ll1');
    const si = makeStateInvariant('si1', 'll1', 'init', 99);
    const model = makeModel({ lifelines: { ll1 }, stateInvariants: { si1: si } });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const siNode = result.find((n) => n.type === 'umlStateInvariant');
    expect(siNode).toBeDefined();
    expect(siNode && isStateInvariantViewModel(siNode.data)).toBe(true);
    if (siNode && isStateInvariantViewModel(siNode.data)) {
      // No messages → clamps to slot 0 (top of timeline).
      expect(siNode.position.y).toBeCloseTo(stateInvariantSlotY(0) - siNode.data.height / 2, 0);
    }
  });

  it('skips state invariants whose lifeline is absent from the diagram', () => {
    const ll1 = makeLifeline('ll1');
    const si = makeStateInvariant('si1', 'll99', 'orphan', 0);
    const model = makeModel({ lifelines: { ll1 }, stateInvariants: { si1: si } });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result.find((n) => n.type === 'umlStateInvariant')).toBeUndefined();
  });
});

// ─── Interaction Use (`ref`) ──────────────────────────────────────────────────

function makeInteractionUse(
  id: string,
  coveredLifelineIds: string[],
  afterSequenceNumber: number,
  referencedName?: string,
): IRInteractionUse {
  return { id, kind: 'INTERACTION_USE', name: referencedName ?? '', coveredLifelineIds, afterSequenceNumber, referencedName };
}

describe('buildSequenceDiagramNodes — interaction use', () => {
  it('emits a ref box spanning the covered lifelines', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      interactionUses: { u1: makeInteractionUse('u1', ['ll1', 'll2'], 0, 'Login') },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const useNode = result.find((n) => n.type === 'umlInteractionUse');
    expect(useNode && isInteractionUseViewModel(useNode.data)).toBe(true);
    if (useNode && isInteractionUseViewModel(useNode.data)) {
      expect(useNode.data.label).toBe('Login');
      const ll1CenterX = 50 + 70;
      const ll2CenterX = 250 + 70;
      expect(useNode.data.width).toBeGreaterThanOrEqual(ll2CenterX - ll1CenterX);
    }
  });

  it('renders the ref BEHIND lifelines', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      interactionUses: { u1: makeInteractionUse('u1', ['ll1', 'll2'], 0) },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const useIdx = result.findIndex((n) => n.type === 'umlInteractionUse');
    const lifelineIdx = result.findIndex((n) => n.type === 'umlLifeline');
    expect(useIdx).toBeGreaterThanOrEqual(0);
    expect(useIdx).toBeLessThan(lifelineIdx);
  });

  it('skips a ref whose covered lifelines are all absent', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1') },
      interactionUses: { u1: makeInteractionUse('u1', ['ll99'], 0) },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result.find((n) => n.type === 'umlInteractionUse')).toBeUndefined();
  });
});

// ─── Create / Destroy events ──────────────────────────────────────────────────

function makeKindMessage(
  id: string,
  src: string,
  tgt: string,
  seq: number,
  messageKind: IRMessage['messageKind'],
): IRMessage {
  return { id, kind: 'MESSAGE', name: `msg-${id}`, messageKind, sourceLifelineId: src, targetLifelineId: tgt, sequenceNumber: seq };
}

const twoLifelineView: DiagramView = {
  diagramId: 'd1',
  nodes: [
    { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
    { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
  ],
  edges: [],
};

describe('buildSequenceDiagramNodes — create/destroy events', () => {
  it('drops the head of a lifeline created by a CREATE message', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      messages: { m1: makeKindMessage('m1', 'll1', 'll2', 1, 'CREATE') },
    });
    const result = buildSequenceDiagramNodes(makeCtx(model, twoLifelineView));

    const ll2Node = result.find((n) => n.id === 'vn2');
    const ll1Node = result.find((n) => n.id === 'vn1');
    const createMsg = result.find((n) => n.type === 'umlMessage');
    expect(ll2Node && isLifelineViewModel(ll2Node.data)).toBe(true);
    if (
      ll2Node && isLifelineViewModel(ll2Node.data) &&
      ll1Node && isLifelineViewModel(ll1Node.data) && createMsg
    ) {
      // The created lifeline head centres on the CREATE message's Y.
      expect(ll2Node.data.headTopOffset).toBeGreaterThan(0);
      expect(ll2Node.data.headTopOffset!).toBeCloseTo(
        createMsg.position.y - ll2Node.data.headHeight / 2,
        0,
      );
      // The caller lifeline is unaffected.
      expect(ll1Node.data.headTopOffset ?? 0).toBe(0);
      expect(ll2Node.data.isDestroyed).toBe(false);
    }
  });

  it('shortens a CREATE arrow so it lands on the target head edge', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      messages: { m1: makeKindMessage('m1', 'll1', 'll2', 1, 'CREATE') },
    });
    const result = buildSequenceDiagramNodes(makeCtx(model, twoLifelineView));
    const createMsg = result.find((n) => n.type === 'umlMessage');
    expect(createMsg && isMessageViewModel(createMsg.data)).toBe(true);
    if (createMsg && isMessageViewModel(createMsg.data)) {
      // centres: ll1=120, ll2=320, full=200; minus headWidth/2 (70) = 130.
      expect(createMsg.data.length).toBe(130);
    }
  });

  it('terminates a lifeline destroyed by a DESTROY message with an ✕ marker', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      messages: {
        m1: makeKindMessage('m1', 'll1', 'll2', 1, 'SYNC'),
        m2: makeKindMessage('m2', 'll1', 'll2', 2, 'DESTROY'),
      },
    });
    const result = buildSequenceDiagramNodes(makeCtx(model, twoLifelineView));
    const ll2Node = result.find((n) => n.id === 'vn2');
    const destroyMsg = result.find(
      (n) => n.type === 'umlMessage' && n.data.domainId === 'm2',
    );
    expect(ll2Node && isLifelineViewModel(ll2Node.data)).toBe(true);
    if (ll2Node && isLifelineViewModel(ll2Node.data) && destroyMsg) {
      expect(ll2Node.data.isDestroyed).toBe(true);
      // Timeline ends exactly at the destroy message's Y.
      const bottom = (ll2Node.data.headTopOffset ?? 0) + ll2Node.data.headHeight + ll2Node.data.timelineLength;
      expect(bottom).toBeCloseTo(destroyMsg.position.y, 0);
    }
  });

  it('leaves a non-targeted lifeline undamaged', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      messages: { m1: makeKindMessage('m1', 'll1', 'll2', 1, 'DESTROY') },
    });
    const result = buildSequenceDiagramNodes(makeCtx(model, twoLifelineView));
    const ll1Node = result.find((n) => n.id === 'vn1');
    if (ll1Node && isLifelineViewModel(ll1Node.data)) {
      expect(ll1Node.data.isDestroyed).toBe(false);
      expect(ll1Node.data.headTopOffset ?? 0).toBe(0);
    }
  });
});

// ─── Gates ────────────────────────────────────────────────────────────────────

function makeAltFrag(id: string, coveredLifelineIds: string[]): IRInteractionFragment {
  return {
    id, kind: 'FRAGMENT', name: id, fragmentKind: 'ALT',
    coveredLifelineIds,
    operands: [{ id: `${id}-op`, messageIds: [], fragmentIds: [] }],
  };
}

function makeGate(id: string, ownerFragmentId: string, side: 'LEFT' | 'RIGHT', name = id): IRGate {
  return { id, kind: 'GATE', name, ownerFragmentId, side, afterSequenceNumber: 0 };
}

describe('buildSequenceDiagramNodes — gates', () => {
  const twoLLView: DiagramView = {
    diagramId: 'd1',
    nodes: [
      { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
      { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
    ],
    edges: [],
  };

  it('emits a gate marker on the owner fragment right edge', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      interactionFragments: { f1: makeAltFrag('f1', ['ll1', 'll2']) },
      gates: { g1: makeGate('g1', 'f1', 'RIGHT', 'out') },
    });
    const result = buildSequenceDiagramNodes(makeCtx(model, twoLLView));
    const gateNode = result.find((n) => n.type === 'umlGate');
    expect(gateNode && isGateViewModel(gateNode.data)).toBe(true);
    if (gateNode && isGateViewModel(gateNode.data)) {
      expect(gateNode.data.name).toBe('out');
      expect(gateNode.data.side).toBe('RIGHT');
      // ll centres 120/320 → bounds.right = max(100+120, 340) = 340; minus size/2 (5).
      expect(gateNode.position.x).toBe(340 - 5);
    }
  });

  it('routes a message target end to its gate boundary X', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1'), ll2: makeLifeline('ll2') },
      interactionFragments: { f1: makeAltFrag('f1', ['ll1', 'll2']) },
      gates: { g1: makeGate('g1', 'f1', 'RIGHT') },
      messages: {
        m1: {
          id: 'm1', kind: 'MESSAGE', name: 'cross', messageKind: 'ASYNC',
          sourceLifelineId: 'll1', targetLifelineId: '', sequenceNumber: 1, targetGateId: 'g1',
        },
      },
    });
    const result = buildSequenceDiagramNodes(makeCtx(model, twoLLView));
    const msg = result.find((n) => n.type === 'umlMessage');
    expect(msg && isMessageViewModel(msg.data)).toBe(true);
    if (msg && isMessageViewModel(msg.data)) {
      expect(msg.data.isSelfMessage).toBe(false);
      // source centre 120 → gate edge 340; length 220.
      expect(msg.position.x).toBe(120);
      expect(msg.data.length).toBe(220);
    }
  });

  it('skips a gate whose owner fragment covers no present lifeline', () => {
    const model = makeModel({
      lifelines: { ll1: makeLifeline('ll1') },
      interactionFragments: { f1: makeAltFrag('f1', ['ll99']) },
      gates: { g1: makeGate('g1', 'f1', 'LEFT') },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result.find((n) => n.type === 'umlGate')).toBeUndefined();
  });
});

// ─── Found / Lost messages ────────────────────────────────────────────────────

describe('buildSequenceDiagramNodes — found/lost messages', () => {
  it('places a found message dot to the LEFT of the target and points inward', () => {
    const found: IRMessage = {
      id: 'f1', kind: 'MESSAGE', name: 'event', messageKind: 'ASYNC',
      sourceLifelineId: '', targetLifelineId: 'll1', sequenceNumber: 1, isFound: true,
    };
    const model = makeModel({ lifelines: { ll1: makeLifeline('ll1') }, messages: { f1: found } });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const msg = result.find((n) => n.type === 'umlMessage');
    expect(msg && isMessageViewModel(msg.data)).toBe(true);
    if (msg && isMessageViewModel(msg.data)) {
      expect(msg.data.isFound).toBe(true);
      expect(msg.data.isSelfMessage).toBe(false);
      // target centre = 50 + 70 = 120; dot 70px to the left → 50; arrow length 70.
      expect(msg.position.x).toBe(50);
      expect(msg.data.length).toBe(70);
    }
  });

  it('places a lost message dot to the RIGHT of the source', () => {
    const lost: IRMessage = {
      id: 'l1', kind: 'MESSAGE', name: 'fire', messageKind: 'ASYNC',
      sourceLifelineId: 'll1', targetLifelineId: '', sequenceNumber: 1, isLost: true,
    };
    const model = makeModel({ lifelines: { ll1: makeLifeline('ll1') }, messages: { l1: lost } });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const msg = result.find((n) => n.type === 'umlMessage');
    if (msg && isMessageViewModel(msg.data)) {
      expect(msg.data.isLost).toBe(true);
      expect(msg.data.isSelfMessage).toBe(false);
      // source centre = 120; arrow runs right for 70.
      expect(msg.position.x).toBe(120);
      expect(msg.data.length).toBe(70);
    }
  });

  it('shows a found message even though its source lifeline is absent', () => {
    const found: IRMessage = {
      id: 'f1', kind: 'MESSAGE', name: '', messageKind: 'ASYNC',
      sourceLifelineId: '', targetLifelineId: 'll1', sequenceNumber: 1, isFound: true,
    };
    const model = makeModel({ lifelines: { ll1: makeLifeline('ll1') }, messages: { f1: found } });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [{ id: 'vn1', elementId: 'll1', x: 50, y: 0 }],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result.filter((n) => n.type === 'umlMessage')).toHaveLength(1);
  });
});

// ─── computeHierarchicalNumbers ───────────────────────────────────────────────

function makeMsg(id: string, seq: number): IRMessage {
  return {
    id,
    kind: 'MESSAGE',
    name: id,
    messageKind: 'SYNC',
    sourceLifelineId: 'src',
    targetLifelineId: 'tgt',
    sequenceNumber: seq,
  };
}

function makeFrag(
  id: string,
  operandMsgIds: string[][],
  parentFragmentId?: string,
): IRInteractionFragment {
  return {
    id,
    kind: 'FRAGMENT',
    name: id,
    fragmentKind: 'ALT',
    coveredLifelineIds: ['src', 'tgt'],
    parentFragmentId,
    operands: operandMsgIds.map((msgIds, i) => ({
      id: `${id}-op${i}`,
      messageIds: msgIds,
      fragmentIds: [],
    })),
  };
}

describe('computeHierarchicalNumbers', () => {
  it('returns empty map for no messages', () => {
    const result = computeHierarchicalNumbers([], []);
    expect(result.size).toBe(0);
  });

  it('numbers root messages sequentially: 1, 2, 3', () => {
    const messages = [makeMsg('a', 1), makeMsg('b', 2), makeMsg('c', 3)];
    const result = computeHierarchicalNumbers(messages, []);
    expect(result.get('a')).toBe('1');
    expect(result.get('b')).toBe('2');
    expect(result.get('c')).toBe('3');
  });

  it('numbers messages inside a root fragment as N.1, N.2', () => {
    // root: m1(seq=1), m4(seq=4)
    // frag F1 contains m2(seq=2), m3(seq=3)
    const messages = [
      makeMsg('m1', 1),
      makeMsg('m2', 2),
      makeMsg('m3', 3),
      makeMsg('m4', 4),
    ];
    const frag = makeFrag('f1', [['m2', 'm3']]);
    const result = computeHierarchicalNumbers(messages, [frag]);
    // root messages before f1: 1 (m1) → prefix "1"
    expect(result.get('m1')).toBe('1');
    expect(result.get('m2')).toBe('1.1');
    expect(result.get('m3')).toBe('1.2');
    expect(result.get('m4')).toBe('2');
  });

  it('numbers messages in a fragment at the very start as .1, .2 (no preceding root)', () => {
    const messages = [makeMsg('m1', 1), makeMsg('m2', 2)];
    const frag = makeFrag('f1', [['m1', 'm2']]);
    const result = computeHierarchicalNumbers(messages, [frag]);
    // no root messages before f1 → prefix is empty → display just "1", "2"
    expect(result.get('m1')).toBe('1');
    expect(result.get('m2')).toBe('2');
  });

  it('uses the correct root index when multiple root messages precede the fragment', () => {
    const messages = [
      makeMsg('r1', 1),
      makeMsg('r2', 2),
      makeMsg('m1', 3),
      makeMsg('m2', 4),
      makeMsg('r3', 5),
    ];
    const frag = makeFrag('f1', [['m1', 'm2']]);
    const result = computeHierarchicalNumbers(messages, [frag]);
    expect(result.get('r1')).toBe('1');
    expect(result.get('r2')).toBe('2');
    expect(result.get('m1')).toBe('2.1');
    expect(result.get('m2')).toBe('2.2');
    expect(result.get('r3')).toBe('3');
  });

  it('handles two sibling fragments each with their own messages', () => {
    const messages = [
      makeMsg('r1', 1),
      makeMsg('a1', 2),
      makeMsg('a2', 3),
      makeMsg('r2', 4),
      makeMsg('b1', 5),
      makeMsg('b2', 6),
    ];
    const fragA = makeFrag('fA', [['a1', 'a2']]);
    const fragB = makeFrag('fB', [['b1', 'b2']]);
    const result = computeHierarchicalNumbers(messages, [fragA, fragB]);
    expect(result.get('r1')).toBe('1');
    expect(result.get('a1')).toBe('1.1');
    expect(result.get('a2')).toBe('1.2');
    expect(result.get('r2')).toBe('2');
    expect(result.get('b1')).toBe('2.1');
    expect(result.get('b2')).toBe('2.2');
  });

  it('numbers messages in a nested sub-fragment with three-level notation', () => {
    // Layout: r1 | [F1: m1 | [F2: n1, n2] | m2] | r2
    const messages = [
      makeMsg('r1', 1),
      makeMsg('m1', 2),
      makeMsg('n1', 3),
      makeMsg('n2', 4),
      makeMsg('m2', 5),
      makeMsg('r2', 6),
    ];
    // F1 directly contains m1, m2 (n1,n2 are in sub-fragment F2)
    const f1 = makeFrag('f1', [['m1', 'm2']]);
    // F2 is nested inside F1 and directly contains n1, n2
    const f2 = makeFrag('f2', [['n1', 'n2']], 'f1');
    const result = computeHierarchicalNumbers(messages, [f1, f2]);
    // m1 = 1.1 (first direct in F1)
    // F2 occupies slot 2 in F1 (after m1), so n1 = 1.2.1, n2 = 1.2.2
    // m2 = 1.3 (after m1 and the F2 sub-fragment)
    expect(result.get('r1')).toBe('1');
    expect(result.get('m1')).toBe('1.1');
    expect(result.get('n1')).toBe('1.2.1');
    expect(result.get('n2')).toBe('1.2.2');
    expect(result.get('m2')).toBe('1.3');
    expect(result.get('r2')).toBe('2');
  });

  it('is stable regardless of input order', () => {
    const messages = [makeMsg('c', 3), makeMsg('a', 1), makeMsg('b', 2)];
    const result = computeHierarchicalNumbers(messages, []);
    expect(result.get('a')).toBe('1');
    expect(result.get('b')).toBe('2');
    expect(result.get('c')).toBe('3');
  });
});

function makeGeneralOrdering(
  id: string,
  beforeMessageId: string,
  afterMessageId: string,
  partial: Partial<IRGeneralOrdering> = {},
): IRGeneralOrdering {
  return {
    id,
    kind: 'GENERAL_ORDERING',
    name: '',
    beforeMessageId,
    beforeEnd: 'RECEIVE',
    afterMessageId,
    afterEnd: 'SEND',
    ...partial,
  };
}

describe('buildSequenceDiagramNodes — general orderings', () => {
  it('emits a general-ordering node anchored to its two message occurrences', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: {
        m1: makeMessage('m1', 'll1', 'll2', 1),
        m2: makeMessage('m2', 'll2', 'll1', 2),
      },
      generalOrderings: { go1: makeGeneralOrdering('go1', 'm1', 'm2') },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    const goNode = result.find((n) => n.type === 'umlGeneralOrdering');
    expect(goNode).toBeDefined();
    expect(goNode && isGeneralOrderingViewModel(goNode.data)).toBe(true);
    if (goNode && isGeneralOrderingViewModel(goNode.data)) {
      const ll1CenterX = 50 + 70; // headWidth/2 = 70
      const ll2CenterX = 250 + 70;
      // before = RECEIVE end of m1 (target ll2, slot 1); after = SEND end of m2 (source ll2, slot 2).
      const y1 = messageYForIndex(1);
      const y2 = messageYForIndex(2);
      // Both occurrences are on ll2 here → node anchored at that X, spanning the two Ys.
      expect(goNode.position.x).toBeCloseTo(ll2CenterX, 0);
      expect(goNode.position.y).toBeCloseTo(Math.min(y1, y2), 0);
      expect(goNode.data.height).toBeCloseTo(Math.abs(y2 - y1), 0);
      void ll1CenterX;
    }
  });

  it('omits a general ordering whose message is missing', () => {
    const ll1 = makeLifeline('ll1');
    const ll2 = makeLifeline('ll2');
    const model = makeModel({
      lifelines: { ll1, ll2 },
      messages: { m1: makeMessage('m1', 'll1', 'll2', 1) },
      generalOrderings: { go1: makeGeneralOrdering('go1', 'm1', 'ghost') },
    });
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'vn1', elementId: 'll1', x: 50, y: 0 },
        { id: 'vn2', elementId: 'll2', x: 250, y: 0 },
      ],
      edges: [],
    };
    const result = buildSequenceDiagramNodes(makeCtx(model, view));
    expect(result.find((n) => n.type === 'umlGeneralOrdering')).toBeUndefined();
  });
});
