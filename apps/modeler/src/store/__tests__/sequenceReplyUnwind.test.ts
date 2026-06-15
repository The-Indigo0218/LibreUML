import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

/**
 * A REPLY must collapse the execution it returns from AND unwind the call stack:
 * still-open nested executions (self-calls, inner calls) on the same lifeline
 * that started later close at the same point. Otherwise an un-replied self-call
 * keeps its bar open down to the bottom and drags its parent with it.
 */
describe('Sequence Diagram — reply unwinds the call stack', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('unwind');
  });

  const s = () => useModelStore.getState();
  const startSeq = (startMessageId: string) =>
    s().model?.messages?.[startMessageId]?.sequenceNumber;

  it('closes a parent AND its un-replied nested self-call when the parent replies', () => {
    const cliente = s().createLifeline({ name: 'Cliente', participantKind: 'ACTOR', alias: 'Cliente' });
    const portal = s().createLifeline({ name: 'PortalPagos', participantKind: 'ANONYMOUS', alias: 'PortalPagos' });
    const servicio = s().createLifeline({ name: 'ServicioFacturas', participantKind: 'ANONYMOUS', alias: 'ServicioFacturas' });

    const m1 = s().createMessage({ name: 'ConsultaFactura', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 1 });
    s().createMessage({ name: 'ValidarDatos', messageKind: 'SYNC', sourceLifelineId: portal, targetLifelineId: portal, sequenceNumber: 2 });
    const m3 = s().createMessage({ name: 'ObtenerFactura', messageKind: 'SYNC', sourceLifelineId: portal, targetLifelineId: servicio, sequenceNumber: 3 });
    s().createMessage({ name: 'Factura', messageKind: 'REPLY', sourceLifelineId: servicio, targetLifelineId: portal, sequenceNumber: 4, inReplyTo: m3 });
    s().createMessage({ name: 'Factura', messageKind: 'REPLY', sourceLifelineId: portal, targetLifelineId: cliente, sequenceNumber: 5, inReplyTo: m1 });
    s().createMessage({ name: 'sync message', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 6 });

    const openOnPortal = Object.values(s().model?.activations ?? {})
      .filter((a) => !a.endMessageId && a.lifelineId === portal);

    // Only the fresh msg6 call stays open on PortalPagos; A + self-call B are closed.
    expect(openOnPortal).toHaveLength(1);
    expect(startSeq(openOnPortal[0].startMessageId)).toBe(6);
  });

  it('does not close an OUTER open call when an inner call returns', () => {
    const a = s().createLifeline({ name: 'A', participantKind: 'ANONYMOUS', alias: 'A' });
    const b = s().createLifeline({ name: 'B', participantKind: 'ANONYMOUS', alias: 'B' });

    const outer = s().createMessage({ name: 'outer', messageKind: 'SYNC', sourceLifelineId: a, targetLifelineId: b, sequenceNumber: 1 });
    const inner = s().createMessage({ name: 'inner', messageKind: 'SYNC', sourceLifelineId: b, targetLifelineId: b, sequenceNumber: 2 });
    s().createMessage({ name: 'innerRet', messageKind: 'REPLY', sourceLifelineId: b, targetLifelineId: b, sequenceNumber: 3, inReplyTo: inner });

    const acts = Object.values(s().model?.activations ?? {});
    const outerAct = acts.find((x) => x.startMessageId === outer)!;
    const innerAct = acts.find((x) => x.startMessageId === inner)!;
    expect(innerAct.endMessageId).toBeDefined();   // inner closed
    expect(outerAct.endMessageId).toBeUndefined();  // outer still open
  });
});
