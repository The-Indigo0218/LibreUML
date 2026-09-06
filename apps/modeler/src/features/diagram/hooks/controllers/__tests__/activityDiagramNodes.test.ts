import { describe, it, expect, vi } from 'vitest';
import { buildActivityDiagramNodes } from '../activityDiagramNodes';
import type { SemanticModel, DiagramView } from '../../../../../core/domain/vfs/vfs.types';
import type {
  ActivityActionViewModel,
  ActivityControlNodeViewModel,
  ActivityDecisionViewModel,
  ActivityForkJoinViewModel,
  ActivityObjectNodeViewModel,
} from '../../../../../adapters/view-models/node.view-model';

function model(over: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activities: { a1: { id: 'a1', kind: 'ACTIVITY', name: 'Checkout' } },
    activityNodes: {}, activityPartitions: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    relations: {}, createdAt: 1, updatedAt: 1,
    ...over,
  } as SemanticModel;
}

const irNode = (id: string, activityType: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'ACTIVITY_NODE', name: id, activityType, activityId: 'a1', ...over,
});

function view(nodes: { id: string; elementId: string; x?: number; y?: number }[]): DiagramView {
  return {
    diagramId: 'd1',
    nodes: nodes.map((n) => ({ id: n.id, elementId: n.elementId, x: n.x ?? 0, y: n.y ?? 0 })),
    edges: [],
  } as DiagramView;
}

const ctx = (m: SemanticModel, v: DiagramView) => ({
  diagramView: v,
  model: m,
  isStandalone: false,
  activeTabId: null,
  handleNoteUpdate: vi.fn(),
});

describe('buildActivityDiagramNodes', () => {
  it('builds an action node carrying its activity and label', () => {
    const m = model({ activityNodes: { n1: irNode('n1', 'ACTION', { name: 'Validate cart' }) } as never });
    const [built] = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn1', elementId: 'n1' }])));

    const vm = built.data as ActivityActionViewModel;
    expect(vm.__brand).toBe('activityAction');
    expect(vm.label).toBe('Validate cart');
    expect((built as { domainId?: string }).domainId).toBe('n1');
  });

  it('positions a node where its view node says', () => {
    const m = model({ activityNodes: { n1: irNode('n1', 'ACTION') } as never });
    const [built] = buildActivityDiagramNodes(
      ctx(m, view([{ id: 'vn1', elementId: 'n1', x: 140, y: 260 }])),
    );

    expect(built.position).toEqual({ x: 140, y: 260 });
  });

  it('maps the three control types to their glyphs', () => {
    const m = model({
      activityNodes: {
        i: irNode('i', 'INITIAL'),
        f: irNode('f', 'ACTIVITY_FINAL'),
        ff: irNode('ff', 'FLOW_FINAL'),
      } as never,
    });

    const built = buildActivityDiagramNodes(
      ctx(m, view([
        { id: 'v-i', elementId: 'i' },
        { id: 'v-f', elementId: 'f' },
        { id: 'v-ff', elementId: 'ff' },
      ])),
    );

    const kinds = built.map((b) => (b.data as ActivityControlNodeViewModel).controlKind);
    expect(kinds).toEqual(['INITIAL', 'ACTIVITY_FINAL', 'FLOW_FINAL']);
  });

  it('shows the operation a call action is traced to, as Class::op() (ADR-0010)', () => {
    const m = model({
      classes: { c1: { id: 'c1', kind: 'CLASS', name: 'PaymentService', attributeIds: [], operationIds: ['op1'] } } as never,
      operations: { op1: { id: 'op1', kind: 'OPERATION', name: 'charge', parameters: [] } } as never,
      activityNodes: {
        n1: irNode('n1', 'CALL_OPERATION', { name: 'Charge card', callsOperationId: 'op1' }),
      } as never,
    });

    const [built] = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn1', elementId: 'n1' }])));

    expect((built.data as ActivityActionViewModel).callsOperationName).toBe('PaymentService::charge()');
  });

  it('falls back to a bare op() label when no class/interface owns the operation', () => {
    const m = model({
      operations: { op1: { id: 'op1', kind: 'OPERATION', name: 'charge', parameters: [] } } as never,
      activityNodes: {
        n1: irNode('n1', 'CALL_OPERATION', { name: 'Charge card', callsOperationId: 'op1' }),
      } as never,
    });

    const [built] = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn1', elementId: 'n1' }])));

    expect((built.data as ActivityActionViewModel).callsOperationName).toBe('charge()');
  });

  it('leaves the subtitle empty when the traced operation is gone', () => {
    const m = model({
      activityNodes: {
        n1: irNode('n1', 'CALL_OPERATION', { name: 'Charge card', callsOperationId: 'deleted' }),
      } as never,
    });

    const [built] = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn1', elementId: 'n1' }])));

    expect((built.data as ActivityActionViewModel).callsOperationName).toBeUndefined();
  });

  /**
   * A dangling reference means the element was deleted while the view kept its
   * node. Drawing a placeholder would invite the user to interact with
   * something that no longer exists.
   */
  it('omits a view node whose element is not in the model', () => {
    const m = model({ activityNodes: { n1: irNode('n1', 'ACTION') } as never });
    const built = buildActivityDiagramNodes(
      ctx(m, view([{ id: 'vn1', elementId: 'n1' }, { id: 'vn2', elementId: 'ghost' }])),
    );

    expect(built).toHaveLength(1);
    expect((built[0] as { domainId?: string }).domainId).toBe('n1');
  });

  it('builds an object node carrying its label (A6/v1.1)', () => {
    const m = model({ activityNodes: { n1: irNode('n1', 'OBJECT_NODE', { name: 'Order' }) } as never });
    const [built] = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn1', elementId: 'n1' }])));

    const vm = built.data as ActivityObjectNodeViewModel;
    expect(vm.__brand).toBe('activityObjectNode');
    expect(vm.label).toBe('Order');
    expect((built as { domainId?: string }).domainId).toBe('n1');
  });

  it('shows the classifier an object node is traced to (ADR-0010)', () => {
    const m = model({
      classes: { c1: { id: 'c1', kind: 'CLASS', name: 'Order', attributeIds: [], operationIds: [] } } as never,
      activityNodes: {
        n1: irNode('n1', 'OBJECT_NODE', { name: 'order', classifierId: 'c1' }),
      } as never,
    });

    const [built] = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn1', elementId: 'n1' }])));

    expect((built.data as ActivityObjectNodeViewModel).classifierName).toBe('Order');
  });

  it('leaves the classifier subtitle empty when the traced classifier is gone', () => {
    const m = model({
      activityNodes: {
        n1: irNode('n1', 'OBJECT_NODE', { name: 'order', classifierId: 'deleted' }),
      } as never,
    });

    const [built] = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn1', elementId: 'n1' }])));

    expect((built.data as ActivityObjectNodeViewModel).classifierName).toBeUndefined();
  });

  it('maps decision and merge to the same rhombus glyph (A2)', () => {
    const m = model({
      activityNodes: {
        d: irNode('d', 'DECISION'),
        mg: irNode('mg', 'MERGE'),
      } as never,
    });

    const built = buildActivityDiagramNodes(
      ctx(m, view([{ id: 'v-d', elementId: 'd' }, { id: 'v-mg', elementId: 'mg' }])),
    );

    const vms = built.map((b) => b.data as ActivityDecisionViewModel);
    expect(vms.map((vm) => vm.__brand)).toEqual(['activityDecision', 'activityDecision']);
    expect(vms.map((vm) => vm.decisionKind)).toEqual(['DECISION', 'MERGE']);
  });

  it('maps fork and join to the same bar glyph, honoring bar orientation (A2)', () => {
    const m = model({
      activityNodes: {
        fk: irNode('fk', 'FORK'),
        jn: irNode('jn', 'JOIN', { barOrientation: 'VERTICAL' }),
      } as never,
    });

    const built = buildActivityDiagramNodes(
      ctx(m, view([{ id: 'v-fk', elementId: 'fk' }, { id: 'v-jn', elementId: 'jn' }])),
    );

    const vms = built.map((b) => b.data as ActivityForkJoinViewModel);
    expect(vms.map((vm) => vm.__brand)).toEqual(['activityForkJoin', 'activityForkJoin']);
    expect(vms.map((vm) => vm.forkJoinKind)).toEqual(['FORK', 'JOIN']);
    // Undeclared orientation defaults to HORIZONTAL, matching the registry factory.
    expect(vms.map((vm) => vm.barOrientation)).toEqual(['HORIZONTAL', 'VERTICAL']);
  });

  it('still renders notes, which belong to every diagram type', () => {
    const m = model({ activityNodes: {} });
    const built = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn-note', elementId: '' }])));

    expect(built).toHaveLength(1);
  });

  it('renames through the global store surface when the file is not standalone', () => {
    const m = model({ activityNodes: { n1: irNode('n1', 'ACTION') } as never });
    const [built] = buildActivityDiagramNodes(ctx(m, view([{ id: 'vn1', elementId: 'n1' }])));

    // The builder wires a rename; A0's inline editor calls it.
    expect((built.data as ActivityActionViewModel).onRename).toBeTypeOf('function');
  });
});
