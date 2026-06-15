import { describe, it, expect } from 'vitest';
import { buildSequenceDiagramNodes, MESSAGE_BAND_H } from '../sequenceDiagramNodes';
import { isActivationViewModel } from '../../../../../adapters/view-models/node.view-model';
import { useModelStore } from '../../../../../store/model.store';
import type { DiagramView } from '../../../../../core/domain/vfs/vfs.types';
import type { NodeBuilderContext } from '../sharedNodeBuilders';

/**
 * A self-message is an atomic call+return with no reply of its own, so its
 * execution must render as a SHORT, self-contained nested bar (≈ one slot) that
 * stays inside its caller — never a tall bar stretching down to where the caller
 * returns. Mirrors the PortalPagos diagram reported by the user.
 */
describe('Sequence Diagram — self-call execution geometry', () => {
  it('renders the self-call as a short nested bar contained by its caller', () => {
    const s = () => useModelStore.getState();
    s().resetModel();
    s().initModel('selfcall-geom');

    const cliente = s().createLifeline({ name: 'Cliente', participantKind: 'ACTOR', alias: 'Cliente' });
    const portal = s().createLifeline({ name: 'PortalPagos', participantKind: 'ANONYMOUS', alias: 'PortalPagos' });
    const servicio = s().createLifeline({ name: 'ServicioFacturas', participantKind: 'ANONYMOUS', alias: 'ServicioFacturas' });

    const m1 = s().createMessage({ name: 'ConsultaFactura', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 1 });
    const m2 = s().createMessage({ name: 'ValidarDatos', messageKind: 'SYNC', sourceLifelineId: portal, targetLifelineId: portal, sequenceNumber: 2 });
    const m3 = s().createMessage({ name: 'ObtenerFactura', messageKind: 'SYNC', sourceLifelineId: portal, targetLifelineId: servicio, sequenceNumber: 3 });
    s().createMessage({ name: 'Factura', messageKind: 'REPLY', sourceLifelineId: servicio, targetLifelineId: portal, sequenceNumber: 4, inReplyTo: m3 });
    s().createMessage({ name: 'Factura', messageKind: 'REPLY', sourceLifelineId: portal, targetLifelineId: cliente, sequenceNumber: 5, inReplyTo: m1 });
    s().createMessage({ name: 'sync message', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 6 });

    const model = s().model!;
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'v1', elementId: cliente, x: 50, y: 0 },
        { id: 'v2', elementId: portal, x: 300, y: 0 },
        { id: 'v3', elementId: servicio, x: 550, y: 0 },
      ],
      edges: [],
    };
    const ctx: NodeBuilderContext = { diagramView: view, model, isStandalone: false, activeTabId: null, handleNoteUpdate: () => {} };

    const acts = buildSequenceDiagramNodes(ctx)
      .filter((n) => isActivationViewModel(n.data))
      .map((n) => ({ y: n.position.y, ...(n.data as { height: number; isOpen: boolean; nestingDepth: number }), domainId: (n.data as { domainId: string }).domainId }));

    const byStart = (msgId: string) =>
      acts.find((a) => Object.values(model.activations ?? {}).find((x) => x.id === a.domainId)?.startMessageId === msgId)!;

    const caller = byStart(m1);       // ConsultaFactura execution
    const selfCall = byStart(m2);     // ValidarDatos self-call execution

    // Self-call is short (≈ one band), solid, and nested one level in.
    expect(selfCall.height).toBeLessThanOrEqual(MESSAGE_BAND_H + 1);
    expect(selfCall.isOpen).toBe(false);
    expect(selfCall.nestingDepth).toBe(1);

    // …and fully contained within the caller's vertical span.
    expect(selfCall.y).toBeGreaterThanOrEqual(caller.y);
    expect(selfCall.y + selfCall.height).toBeLessThanOrEqual(caller.y + caller.height);
  });
});
