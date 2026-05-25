import { describe, it, expect } from 'vitest';
import { DiagramSerializer, type DiagramPayload } from '../serialization/DiagramSerializer';
import { DiagramDeserializer } from '../serialization/DiagramDeserializer';
import { FormatDetector } from '../serialization/FormatDetector';

function makePayload(suffix = ''): DiagramPayload {
  return {
    _lumlVersion: '2.0',
    exportType: 'diagram',
    diagramId: `seq-diagram${suffix}`,
    diagramName: `SequenceDiagram${suffix}`,
    model: {
      id: `mdl${suffix}`,
      name: 'Sequence Snapshot',
      version: '1.0.0',
      packages: {},
      classes: {},
      interfaces: {},
      enums: {},
      dataTypes: {},
      attributes: {},
      operations: {},
      relations: {},
      actors: {},
      useCases: {},
      activityNodes: {},
      objectInstances: {},
      components: {},
      nodes: {},
      artifacts: {},
      lifelines: {
        A: { id: 'A', kind: 'LIFELINE', name: 'Client', participantKind: 'CLASS', alias: 'Client' },
        B: { id: 'B', kind: 'LIFELINE', name: 'Server', participantKind: 'CLASS', alias: 'Server' },
      },
      messages: {
        m1: {
          id: 'm1', kind: 'MESSAGE', name: 'request', messageKind: 'SYNC',
          sourceLifelineId: 'A', targetLifelineId: 'B', sequenceNumber: 1,
        },
        m2: {
          id: 'm2', kind: 'MESSAGE', name: 'reply', messageKind: 'REPLY',
          sourceLifelineId: 'B', targetLifelineId: 'A', sequenceNumber: 2, inReplyTo: 'm1',
        },
      },
      activations: {
        act1: { id: 'act1', kind: 'ACTIVATION', lifelineId: 'B', startMessageId: 'm1', endMessageId: 'm2' },
      },
      interactionFragments: {},
      gates: {},
      stateInvariants: {},
      interactionUses: {},
      createdAt: 1,
      updatedAt: 1,
    } as any,
    view: {
      diagramId: `seq-diagram${suffix}`,
      nodes: [
        { id: 'vnA', elementId: 'A', x: 50, y: 0 },
        { id: 'vnB', elementId: 'B', x: 250, y: 0 },
      ],
      edges: [],
    },
  };
}

describe('Sequence diagram — .luml file round-trip', () => {
  const serializer = new DiagramSerializer();
  const formatDetector = new FormatDetector();
  const deserializer = new DiagramDeserializer(formatDetector);

  it('serializes and deserializes a sequence diagram payload without data loss', async () => {
    const original = makePayload();
    const json = serializer.serialize(original);
    expect(typeof json).toBe('string');

    const blob = new Blob([json], { type: 'application/json' });
    const restored = await deserializer.deserialize(blob);

    expect(restored.diagramId).toBe(original.diagramId);
    expect(restored.diagramName).toBe(original.diagramName);
    expect(restored.view.nodes).toHaveLength(2);

    const model = restored.model as any;
    expect(model.lifelines.A.name).toBe('Client');
    expect(model.lifelines.B.name).toBe('Server');
    expect(model.messages.m1.messageKind).toBe('SYNC');
    expect(model.messages.m2.inReplyTo).toBe('m1');
    expect(model.activations.act1.lifelineId).toBe('B');
  });

  it('preserves found/lost message flags', async () => {
    const payload = makePayload('2');
    (payload.model as any).messages = {
      mFound: {
        id: 'mFound', kind: 'MESSAGE', name: 'event', messageKind: 'ASYNC',
        sourceLifelineId: '', targetLifelineId: 'A', sequenceNumber: 1, isFound: true,
      },
      mLost: {
        id: 'mLost', kind: 'MESSAGE', name: 'gone', messageKind: 'ASYNC',
        sourceLifelineId: 'A', targetLifelineId: '', sequenceNumber: 2, isLost: true,
      },
    };

    const json = serializer.serialize(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const restored = await deserializer.deserialize(blob);

    const msgs = (restored.model as any).messages;
    expect(msgs.mFound.isFound).toBe(true);
    expect(msgs.mLost.isLost).toBe(true);
  });

  it('preserves Fase 4 elements (gates, state invariants, interaction uses)', async () => {
    const payload = makePayload('3');
    const model = payload.model as any;
    model.gates = {
      g1: { id: 'g1', kind: 'GATE', name: 'in', ownerFragmentId: 'fr1', side: 'LEFT', afterSequenceNumber: 0 },
    };
    model.stateInvariants = {
      si1: { id: 'si1', kind: 'STATE_INVARIANT', name: 'ready', lifelineId: 'A', constraint: 'authenticated', afterSequenceNumber: 1 },
    };
    model.interactionUses = {
      u1: { id: 'u1', kind: 'INTERACTION_USE', name: 'Login', coveredLifelineIds: ['A', 'B'], referencedDiagramId: 'other', afterSequenceNumber: 0 },
    };

    const json = serializer.serialize(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const restored = await deserializer.deserialize(blob);

    const m = restored.model as any;
    expect(m.gates.g1.side).toBe('LEFT');
    expect(m.stateInvariants.si1.constraint).toBe('authenticated');
    expect(m.interactionUses.u1.referencedDiagramId).toBe('other');
  });

  it('preserves fragment operands with guards', async () => {
    const payload = makePayload('4');
    const model = payload.model as any;
    model.interactionFragments = {
      fr1: {
        id: 'fr1', kind: 'FRAGMENT', name: 'alt', fragmentKind: 'ALT',
        coveredLifelineIds: ['A', 'B'],
        operands: [
          { id: 'op1', guard: 'x > 0', messageIds: ['m1'], fragmentIds: [] },
          { id: 'op2', guard: 'else', messageIds: ['m2'], fragmentIds: [] },
        ],
      },
    };

    const json = serializer.serialize(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const restored = await deserializer.deserialize(blob);

    const fr1 = (restored.model as any).interactionFragments.fr1;
    expect(fr1.fragmentKind).toBe('ALT');
    expect(fr1.operands).toHaveLength(2);
    expect(fr1.operands[0].guard).toBe('x > 0');
    expect(fr1.operands[1].guard).toBe('else');
  });

  it('survives JSON.parse(JSON.stringify(...)) local persistence simulation', () => {
    const original = makePayload();
    const json = serializer.serialize(original);
    const parsed = JSON.parse(json) as DiagramPayload;

    expect(parsed.diagramId).toBe(original.diagramId);
    expect(parsed.view.nodes).toHaveLength(2);
    const model = parsed.model as any;
    expect(model.lifelines.A.alias).toBe('Client');
    expect(model.messages.m1.sourceLifelineId).toBe('A');
  });

  it('detects JSON format automatically for sequence diagram content', async () => {
    const payload = makePayload();
    const json = serializer.serialize(payload);
    const blob = new Blob([json], { type: 'application/json' });

    const format = await formatDetector.detectFormat(blob);
    expect(format).toBe('json');
  });

  it('rejects a payload with missing diagramId', () => {
    const bad = { ...makePayload(), diagramId: '' };
    expect(() => serializer.serialize(bad)).toThrow('Missing diagramId');
  });
});
