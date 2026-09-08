import { describe, it, expect } from 'vitest';
import { buildActivityDiagramXmi } from '../activityDiagramXmiExporter';
import type {
  SemanticModel,
  IRActivity,
  IRActivityNode,
  IRActivityPartition,
  IRRelation,
  IRClass,
  IROperation,
  IRUseCase,
  DiagramView,
} from '../../core/domain/vfs/vfs.types';

function makeModel(overrides: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'model-1',
    name: 'Test',
    version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activities: {}, activityNodes: {}, activityPartitions: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, relations: {},
    createdAt: 0, updatedAt: 0,
    ...overrides,
  } as SemanticModel;
}

const activity = (id: string, partial: Partial<IRActivity> = {}): IRActivity => ({
  id, kind: 'ACTIVITY', name: id, ...partial,
});

const node = (id: string, activityType: IRActivityNode['activityType'], partial: Partial<IRActivityNode> = {}): IRActivityNode => ({
  id, kind: 'ACTIVITY_NODE', activityType, name: id, activityId: 'act1', ...partial,
});

const viewOf = (elementIds: string[]): DiagramView => ({
  diagramId: 'd1',
  nodes: elementIds.map((id) => ({ id: `vn_${id}`, elementId: id, x: 0, y: 0 })),
  edges: [],
});

describe('buildActivityDiagramXmi', () => {
  it('wraps everything in a uml:Activity packagedElement', () => {
    const model = makeModel({
      activities: { act1: activity('act1', { name: 'Checkout' }) },
      activityNodes: { a: node('a', 'ACTION') },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Checkout');
    expect(xmi).toContain('xmi:type="uml:Activity"');
    expect(xmi).toContain('name="Checkout"');
    const doc = new DOMParser().parseFromString(xmi, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
  });

  it('maps each node kind to its UML metaclass', () => {
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: {
        i: node('i', 'INITIAL'),
        a: node('a', 'ACTION'),
        d: node('d', 'DECISION'),
        m: node('m', 'MERGE'),
        f: node('f', 'FORK'),
        j: node('j', 'JOIN'),
        af: node('af', 'ACTIVITY_FINAL'),
        ff: node('ff', 'FLOW_FINAL'),
        on: node('on', 'OBJECT_NODE'),
        ip: node('ip', 'INPUT_PIN'),
        op: node('op', 'OUTPUT_PIN'),
      },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:InitialNode"');
    expect(xmi).toContain('xmi:type="uml:OpaqueAction"');
    expect(xmi).toContain('xmi:type="uml:DecisionNode"');
    expect(xmi).toContain('xmi:type="uml:MergeNode"');
    expect(xmi).toContain('xmi:type="uml:ForkNode"');
    expect(xmi).toContain('xmi:type="uml:JoinNode"');
    expect(xmi).toContain('xmi:type="uml:ActivityFinalNode"');
    expect(xmi).toContain('xmi:type="uml:FlowFinalNode"');
    expect(xmi).toContain('xmi:type="uml:ObjectNode"');
    expect(xmi).toContain('xmi:type="uml:InputPin"');
    expect(xmi).toContain('xmi:type="uml:OutputPin"');
  });

  it('emits a CallOperationAction with operation idref when it resolves', () => {
    const op: IROperation = { id: 'op1', kind: 'OPERATION', name: 'pay', parameters: [] };
    const cls: IRClass = { id: 'c1', kind: 'CLASS', name: 'Cart', attributeIds: [], operationIds: ['op1'] };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { a: node('a', 'CALL_OPERATION', { callsOperationId: 'op1' }) },
      classes: { c1: cls },
      operations: { op1: op },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:CallOperationAction"');
    expect(xmi).toContain(`operation="op1"`);
  });

  it('skip case: a dangling callsOperationId omits the operation attribute', () => {
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { a: node('a', 'CALL_OPERATION', { callsOperationId: 'ghost' }) },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:CallOperationAction"');
    expect(xmi).not.toContain('operation=');
  });

  it('emits control flow with guard as OpaqueExpression and weight as LiteralString', () => {
    const rel: IRRelation = {
      id: 'r1', kind: 'CONTROL_FLOW', sourceId: 'a', targetId: 'b',
      guard: '[balance > 0]', weight: '2',
    };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { a: node('a', 'ACTION'), b: node('b', 'ACTION') },
      relations: { r1: rel },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:ControlFlow"');
    expect(xmi).toContain('source="a" target="b"');
    expect(xmi).toContain('<body>[balance &gt; 0]</body>');
    expect(xmi).toContain('xmi:type="uml:LiteralString"');
    expect(xmi).toContain('value="2"');
  });

  it('emits object flow distinctly from control flow', () => {
    const rel: IRRelation = { id: 'r1', kind: 'OBJECT_FLOW', sourceId: 'a', targetId: 'b' };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { a: node('a', 'OBJECT_NODE'), b: node('b', 'ACTION') },
      relations: { r1: rel },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:ObjectFlow"');
  });

  // v1.1 — interruptible region, interrupting edge, exception handler.
  it('maps INTERRUPTIBLE_REGION to its UML metaclass', () => {
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { r: node('r', 'INTERRUPTIBLE_REGION', { name: 'Checkout region' }) },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:InterruptibleActivityRegion"');
    expect(xmi).toContain('name="Checkout region"');
  });

  it('emits an interrupting flow with an interrupts idref when its source sits inside a region', () => {
    const rel: IRRelation = { id: 'r1', kind: 'CONTROL_FLOW', sourceId: 'a', targetId: 'b', isInterrupting: true };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: {
        reg: node('reg', 'INTERRUPTIBLE_REGION'),
        a: node('a', 'ACTION', { containerId: 'reg' }),
        b: node('b', 'ACTION'),
      },
      relations: { r1: rel },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('interrupts="reg"');
  });

  it('skip case: an interrupting flow whose source is not inside a region omits the interrupts attribute', () => {
    const rel: IRRelation = { id: 'r1', kind: 'CONTROL_FLOW', sourceId: 'a', targetId: 'b', isInterrupting: true };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { a: node('a', 'ACTION'), b: node('b', 'ACTION') },
      relations: { r1: rel },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).not.toContain('interrupts=');
  });

  it('emits an exception handler as protectedNode/handlerBody idrefs', () => {
    const rel: IRRelation = { id: 'r1', kind: 'EXCEPTION_HANDLER', sourceId: 'a', targetId: 'h' };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { a: node('a', 'ACTION'), h: node('h', 'ACTION', { name: 'Handle failure' }) },
      relations: { r1: rel },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:ExceptionHandler"');
    expect(xmi).toContain('protectedNode="a"');
    expect(xmi).toContain('handlerBody="h"');
  });

  it('drops an exception handler whose endpoint falls outside the diagram view', () => {
    const rel: IRRelation = { id: 'r1', kind: 'EXCEPTION_HANDLER', sourceId: 'a', targetId: 'h' };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { a: node('a', 'ACTION'), h: node('h', 'ACTION') },
      relations: { r1: rel },
    });
    const xmi = buildActivityDiagramXmi(model, viewOf(['a']), 'Flow');
    expect(xmi).not.toContain('uml:ExceptionHandler');
  });

  it('emits a partition with represents when the trace resolves', () => {
    const cls: IRClass = { id: 'c1', kind: 'CLASS', name: 'Clerk', attributeIds: [], operationIds: [] };
    const partition: IRActivityPartition = {
      id: 'p1', kind: 'ACTIVITY_PARTITION', name: 'Clerk lane', activityId: 'act1', index: 0, representsId: 'c1',
    };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityPartitions: { p1: partition },
      classes: { c1: cls },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:ActivityPartition"');
    expect(xmi).toContain('name="Clerk lane"');
    expect(xmi).toContain('represents="c1"');
  });

  it('skip case: a dangling representsId omits the represents attribute', () => {
    const partition: IRActivityPartition = {
      id: 'p1', kind: 'ACTIVITY_PARTITION', name: 'Ghost lane', activityId: 'act1', index: 0, representsId: 'ghost',
    };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityPartitions: { p1: partition },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('name="Ghost lane"');
    expect(xmi).not.toContain('represents=');
  });

  it('emits a Realization to the use case when realizesUseCaseId resolves', () => {
    const uc: IRUseCase = { id: 'uc1', kind: 'USECASE', name: 'Checkout' };
    const model = makeModel({
      activities: { act1: activity('act1', { realizesUseCaseId: 'uc1' }) },
      activityNodes: { a: node('a', 'ACTION') },
      useCases: { uc1: uc },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).toContain('xmi:type="uml:Realization"');
    expect(xmi).toContain('client="act1"');
    expect(xmi).toContain('supplier="uc1"');
  });

  it('skip case: a dangling realizesUseCaseId omits the Realization entirely', () => {
    const model = makeModel({
      activities: { act1: activity('act1', { realizesUseCaseId: 'ghost' }) },
      activityNodes: { a: node('a', 'ACTION') },
    });
    const xmi = buildActivityDiagramXmi(model, null, 'Flow');
    expect(xmi).not.toContain('uml:Realization');
  });

  it('scopes export to the DiagramView when one is given', () => {
    const model = makeModel({
      activities: {
        act1: activity('act1'),
        act2: activity('act2'),
      },
      activityNodes: {
        a: node('a', 'ACTION', { activityId: 'act1' }),
        b: node('b', 'ACTION', { activityId: 'act2' }),
      },
    });
    const xmi = buildActivityDiagramXmi(model, viewOf(['a']), 'Flow');
    expect(xmi).toContain('xmi:id="a"');
    expect(xmi).not.toContain('xmi:id="b"');
  });

  it('drops a flow whose endpoint falls outside the diagram view', () => {
    const rel: IRRelation = { id: 'r1', kind: 'CONTROL_FLOW', sourceId: 'a', targetId: 'b' };
    const model = makeModel({
      activities: { act1: activity('act1') },
      activityNodes: { a: node('a', 'ACTION'), b: node('b', 'ACTION') },
      relations: { r1: rel },
    });
    const xmi = buildActivityDiagramXmi(model, viewOf(['a']), 'Flow');
    expect(xmi).not.toContain('uml:ControlFlow');
  });

  it('falls back to the diagram name when no Activity element exists yet', () => {
    const model = makeModel();
    const xmi = buildActivityDiagramXmi(model, null, 'Empty Flow');
    expect(xmi).toContain('xmi:type="uml:Activity"');
    expect(xmi).toContain('name="Empty Flow"');
  });
});
