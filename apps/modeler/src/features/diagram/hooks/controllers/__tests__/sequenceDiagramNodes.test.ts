import { describe, it, expect } from 'vitest';
import { buildSequenceDiagramNodes } from '../sequenceDiagramNodes';
import type {
  SemanticModel,
  DiagramView,
  IRLifeline,
  IRMessage,
  IRActivation,
  IRInteractionFragment,
} from '../../../../../core/domain/vfs/vfs.types';
import type { NodeBuilderContext } from '../sharedNodeBuilders';
import {
  isLifelineViewModel,
  isMessageViewModel,
  isActivationViewModel,
  isFragmentViewModel,
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
