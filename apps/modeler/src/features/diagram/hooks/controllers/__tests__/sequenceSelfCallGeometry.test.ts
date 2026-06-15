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

  it('does NOT re-extend a self-call bar when a later sync is added on the same lifeline', () => {
    const s = () => useModelStore.getState();
    s().resetModel();
    s().initModel('selfcall-no-reextend');

    const cliente = s().createLifeline({ name: 'Cliente', participantKind: 'ACTOR', alias: 'Cliente' });
    const portal = s().createLifeline({ name: 'Portal', participantKind: 'ANONYMOUS', alias: 'Portal' });

    // Open call on Portal, an un-replied self-call inside it, then ANOTHER sync
    // targeting Portal — the "sacar otro sync" the user reported. The self-call is
    // atomic, so the new sync must not nest inside it and its bar must stay short.
    s().createMessage({ name: 'consulta', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 1 });
    const m2 = s().createMessage({ name: 'validar', messageKind: 'SYNC', sourceLifelineId: portal, targetLifelineId: portal, sequenceNumber: 2 });
    s().createMessage({ name: 'otro sync', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 3 });

    // The self-call must not have been chosen as the new sync's nesting parent.
    const selfCallAct = Object.values(s().model?.activations ?? {}).find((a) => a.startMessageId === m2)!;
    const childrenOfSelfCall = Object.values(s().model?.activations ?? {}).filter(
      (a) => a.parentActivationId === selfCallAct.id,
    );
    expect(childrenOfSelfCall).toHaveLength(0);

    const model = s().model!;
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'v1', elementId: cliente, x: 50, y: 0 },
        { id: 'v2', elementId: portal, x: 300, y: 0 },
      ],
      edges: [],
    };
    const ctx: NodeBuilderContext = { diagramView: view, model, isStandalone: false, activeTabId: null, handleNoteUpdate: () => {} };

    const acts = buildSequenceDiagramNodes(ctx)
      .filter((n) => isActivationViewModel(n.data))
      .map((n) => ({ y: n.position.y, ...(n.data as { height: number; isOpen: boolean }), domainId: (n.data as { domainId: string }).domainId }));

    const selfCall = acts.find((a) => a.domainId === selfCallAct.id)!;
    // Bar stays a short stub — it does NOT stretch down to enclose the new sync.
    expect(selfCall.height).toBeLessThanOrEqual(MESSAGE_BAND_H + 1);
  });

  it('stacks self-messages into progressively deeper executions (call-stack depth)', () => {
    const s = () => useModelStore.getState();
    s().resetModel();
    s().initModel('selfcall-stack');

    const cliente = s().createLifeline({ name: 'Cliente', participantKind: 'ACTOR', alias: 'Cliente' });
    const portal = s().createLifeline({ name: 'Portal', participantKind: 'ANONYMOUS', alias: 'Portal' });

    // Incoming call opens E1; each self-message pushes a new, deeper frame onto
    // Portal's call stack: E2 nests in E1, E3 nests in the still-open E2.
    const m1 = s().createMessage({ name: 'consulta', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 1 });
    const m2 = s().createMessage({ name: 'self-a', messageKind: 'SYNC', sourceLifelineId: portal, targetLifelineId: portal, sequenceNumber: 2 });
    const m3 = s().createMessage({ name: 'self-b', messageKind: 'SYNC', sourceLifelineId: portal, targetLifelineId: portal, sequenceNumber: 3 });

    const acts = Object.values(s().model?.activations ?? {});
    const e1 = acts.find((a) => a.startMessageId === m1)!;
    const e2 = acts.find((a) => a.startMessageId === m2)!;
    const e3 = acts.find((a) => a.startMessageId === m3)!;

    // Each self-message nests one level deeper than the previous frame.
    expect(e2.parentActivationId).toBe(e1.id);
    expect(e3.parentActivationId).toBe(e2.id);

    const model = s().model!;
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'v1', elementId: cliente, x: 50, y: 0 },
        { id: 'v2', elementId: portal, x: 300, y: 0 },
      ],
      edges: [],
    };
    const ctx: NodeBuilderContext = { diagramView: view, model, isStandalone: false, activeTabId: null, handleNoteUpdate: () => {} };
    const built = buildSequenceDiagramNodes(ctx)
      .filter((n) => isActivationViewModel(n.data))
      .map((n) => ({ domainId: (n.data as { domainId: string }).domainId, depth: (n.data as { nestingDepth: number }).nestingDepth }));

    const d1 = built.find((a) => a.domainId === e1.id)!;
    const d2 = built.find((a) => a.domainId === e2.id)!;
    const d3 = built.find((a) => a.domainId === e3.id)!;

    // Visual depth increases by one per self-message. The horizontal offset is
    // applied in ActivationShape as nestingDepth * NESTING_OFFSET, so each deeper
    // frame steps further right than its parent.
    expect(d1.depth).toBe(0);
    expect(d2.depth).toBe(1);
    expect(d3.depth).toBe(2);
  });

  it('does not stretch a CLOSED execution down to an orphaned child (no runaway bar)', () => {
    const s = () => useModelStore.getState();
    s().resetModel();
    s().initModel('selfcall-orphan');

    const cliente = s().createLifeline({ name: 'Cliente', participantKind: 'ACTOR', alias: 'Cliente' });
    const portal = s().createLifeline({ name: 'Portal', participantKind: 'ANONYMOUS', alias: 'Portal' });

    // E1 opens on Portal; a self-message nests into it (open) → parent = E1.
    const m1 = s().createMessage({ name: 'sync', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 1 });
    const mSelf = s().createMessage({ name: 'self', messageKind: 'SYNC', sourceLifelineId: portal, targetLifelineId: portal, sequenceNumber: 2 });
    // Now INSERT a reply *before* the self-message (slot 2) — this is the "metí un
    // response antes del self-message" case. The reply closes E1 and the self-call
    // gets shifted below the return, orphaning it past E1's end.
    s().insertMessageAt({ name: 'reply', messageKind: 'REPLY', sourceLifelineId: portal, targetLifelineId: cliente, sequenceNumber: 2, inReplyTo: m1 });

    const acts = Object.values(s().model?.activations ?? {});
    const e1 = acts.find((a) => a.startMessageId === m1)!;
    expect(e1.endMessageId).toBeDefined(); // E1 is closed by the reply

    const model = s().model!;
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'v1', elementId: cliente, x: 50, y: 0 },
        { id: 'v2', elementId: portal, x: 300, y: 0 },
      ],
      edges: [],
    };
    const ctx: NodeBuilderContext = { diagramView: view, model, isStandalone: false, activeTabId: null, handleNoteUpdate: () => {} };
    const built = buildSequenceDiagramNodes(ctx).filter((n) => isActivationViewModel(n.data));
    const e1Node = built.find((n) => (n.data as { domainId: string }).domainId === e1.id)!;
    const selfAct = acts.find((a) => a.startMessageId === mSelf)!;
    const selfNode = built.find((n) => (n.data as { domainId: string }).domainId === selfAct.id)!;

    // E1's bar must not reach down past the orphaned self-call below the return.
    const e1Bottom = e1Node.position.y + (e1Node.data as { height: number }).height;
    expect(e1Bottom).toBeLessThan(selfNode.position.y);
  });

  it('renders a message as PRINCIPAL once its (stale) parent has closed before it', () => {
    // Repro of the user diagram: a second call is created while the first is still
    // open, so it is stamped with parentActivationId = first. A reply is then
    // inserted BEFORE it, closing the first call. The second call must now render
    // as a principal execution (depth 0) — not a stranded sub-activation offset to
    // the right of a parent that already returned.
    const s = () => useModelStore.getState();
    s().resetModel();
    s().initModel('stale-parent');

    const cliente = s().createLifeline({ name: 'Cliente', participantKind: 'ACTOR', alias: 'Cliente' });
    const portal = s().createLifeline({ name: 'Portal', participantKind: 'ANONYMOUS', alias: 'Portal' });

    const m1 = s().createMessage({ name: 'ConsultaFactura', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 1 });
    // Second call created while the first is still open → stamped parent = E1.
    const m2 = s().createMessage({ name: 'sync message', messageKind: 'SYNC', sourceLifelineId: cliente, targetLifelineId: portal, sequenceNumber: 2 });
    // Reply inserted BEFORE it (slot 2) closing E1; m2 shifts down to slot 3.
    s().insertMessageAt({ name: 'Factura', messageKind: 'REPLY', sourceLifelineId: portal, targetLifelineId: cliente, sequenceNumber: 2, inReplyTo: m1 });

    const acts = Object.values(s().model?.activations ?? {});
    const e1 = acts.find((a) => a.startMessageId === m1)!;
    const e2 = acts.find((a) => a.startMessageId === m2)!;
    expect(e1.endMessageId).toBeDefined();        // E1 closed by the inserted reply
    expect(e2.parentActivationId).toBe(e1.id);    // …yet m2 still carries the stale parent

    const model = s().model!;
    const view: DiagramView = {
      diagramId: 'd1',
      nodes: [
        { id: 'v1', elementId: cliente, x: 50, y: 0 },
        { id: 'v2', elementId: portal, x: 300, y: 0 },
      ],
      edges: [],
    };
    const ctx: NodeBuilderContext = { diagramView: view, model, isStandalone: false, activeTabId: null, handleNoteUpdate: () => {} };
    const built = buildSequenceDiagramNodes(ctx).filter((n) => isActivationViewModel(n.data));
    const e2Depth = (built.find((n) => (n.data as { domainId: string }).domainId === e2.id)!.data as { nestingDepth: number }).nestingDepth;

    // The closed parent no longer contains m2 → it renders as a principal bar.
    expect(e2Depth).toBe(0);
  });
});
