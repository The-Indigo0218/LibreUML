/**
 * domainNodeAdapter — IR → DomainNode/DomainEdge conversion (A5, §16).
 *
 * This is the bridge that lets `getDiagramRegistry(type).validator` — built
 * for a DomainNode/DomainEdge world that predates the VFS SemanticModel —
 * run against the real IR. Each case checks the fields the corresponding
 * validator actually reads (verified against the validator source, not
 * guessed), so a regression here fails the RIGHT test, not just any test.
 */
import { describe, it, expect } from 'vitest';
import { resolvedElementToDomainNode, relationToDomainEdge } from '../domainNodeAdapter';
import { classDiagramValidator } from '../../../../core/validation/class-diagram.validator';
import { useCaseDiagramValidator } from '../../../../core/validation/use-case.validator';
import { domainModelDiagramValidator } from '../../../../core/validation/domain-model.validator';
import { activityDiagramValidator } from '../../../../core/validation/activity-diagram.validator';
import type {
  SemanticModel,
  IRClass,
  IRAttribute,
  IROperation,
  IRActor,
  IRUseCase,
  IRDomainEntity,
  IRDomainAttribute,
  IRActivityNode,
  IRActivityPartition,
  IRRelation,
} from '../../../../core/domain/vfs/vfs.types';

function baseModel(overrides: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {},
    activities: {}, activityNodes: {}, activityPartitions: {}, domainEntities: {}, domainAttributes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, relations: {},
    createdAt: 0, updatedAt: 0,
    ...overrides,
  } as SemanticModel;
}

describe('resolvedElementToDomainNode', () => {
  it('CLASS: carries real attributes/methods so validateClassNode can check them', () => {
    const attr: IRAttribute = { id: 'attr1', kind: 'ATTRIBUTE', name: '', type: 'string' };
    const cls: IRClass = { id: 'c1', kind: 'CLASS', name: 'Order', attributeIds: ['attr1'], operationIds: [] };
    const model = baseModel({ classes: { c1: cls }, attributes: { attr1: attr } });

    const node = resolvedElementToDomainNode({ element: cls, kind: 'CLASS' }, model);
    expect(node).toMatchObject({ type: 'CLASS', name: 'Order' });

    // An unnamed attribute is a real validator-level error — proves the
    // attribute actually reached the validator, not a stub/empty array.
    const result = classDiagramValidator.validateNode(node!);
    expect(result.errors).toContain('Attribute at index 0 has no name');
  });

  it('CLASS: isAbstract routes to ABSTRACT_CLASS, matching the CLASS/ABSTRACT_CLASS split in resolveSemanticElement', () => {
    const cls: IRClass = { id: 'c1', kind: 'CLASS', name: 'Shape', isAbstract: true, attributeIds: [], operationIds: [] };
    const model = baseModel({ classes: { c1: cls } });
    const node = resolvedElementToDomainNode({ element: cls, kind: 'ABSTRACT_CLASS' }, model);
    expect(node?.type).toBe('ABSTRACT_CLASS');
  });

  it('debe morir: dropping operationIds resolution silences the "method has no name" error', () => {
    const op: IROperation = { id: 'op1', kind: 'OPERATION', name: '', parameters: [] };
    const cls: IRClass = { id: 'c1', kind: 'CLASS', name: 'Order', attributeIds: [], operationIds: ['op1'] };
    const model = baseModel({ classes: { c1: cls }, operations: { op1: op } });
    const node = resolvedElementToDomainNode({ element: cls, kind: 'CLASS' }, model);
    const result = classDiagramValidator.validateNode(node!);
    expect(result.errors).toContain('Method at index 0 has no name');
  });

  it('ACTOR: maps briefDescription as documentation for the "no documentation" hint', () => {
    const actor: IRActor = { id: 'a1', kind: 'ACTOR', name: 'Customer' };
    const model = baseModel({ actors: { a1: actor } });
    const node = resolvedElementToDomainNode({ element: actor, kind: 'ACTOR' }, model);
    expect(node?.type).toBe('ACTOR');
    const result = useCaseDiagramValidator.validateNode(node!);
    expect(result.warnings).toContain('Actor has no documentation (consider adding a description)');
  });

  it('USECASE resolves as the "USE_CASE" domain type (SemanticKind spells it without the underscore)', () => {
    const uc: IRUseCase = { id: 'u1', kind: 'USECASE', name: 'checkout' };
    const model = baseModel({ useCases: { u1: uc } });
    const node = resolvedElementToDomainNode({ element: uc, kind: 'USECASE' }, model);
    expect(node?.type).toBe('USE_CASE');
    // lower-case first letter → the naming-convention warning proves `name` landed correctly.
    const result = useCaseDiagramValidator.validateNode(node!);
    expect(result.warnings).toContain('Use Case names typically start with a capital letter');
  });

  it('DOMAIN_ENTITY resolves its attributes via model.domainAttributes (not attributeIds directly)', () => {
    const attr: IRDomainAttribute = { id: 'da1', kind: 'DOMAIN_ATTRIBUTE', name: 'total' };
    const dup: IRDomainAttribute = { id: 'da2', kind: 'DOMAIN_ATTRIBUTE', name: 'total' };
    const entity: IRDomainEntity = { id: 'e1', kind: 'DOMAIN_ENTITY', name: 'Invoice', attributeIds: ['da1', 'da2'] };
    const model = baseModel({ domainEntities: { e1: entity }, domainAttributes: { da1: attr, da2: dup } });
    const node = resolvedElementToDomainNode({ element: entity, kind: 'DOMAIN_ENTITY' }, model);
    const result = domainModelDiagramValidator.validateNode(node!);
    expect(result.errors).toContain('Duplicate attribute name "total" in entity "Invoice"');
  });

  it('ACTIVITY_NODE: maps activityType through IR_TO_ACTIVITY_NODE_TYPE for a CALL_OPERATION missing its trace', () => {
    const n: IRActivityNode = { id: 'n1', kind: 'ACTIVITY_NODE', activityType: 'CALL_OPERATION', name: 'Charge', activityId: 'act1' };
    const model = baseModel({ activityNodes: { n1: n } });
    const node = resolvedElementToDomainNode({ element: n, kind: 'ACTIVITY_NODE' }, model);
    expect(node?.type).toBe('CALL_OPERATION');
    const result = activityDiagramValidator.validateNode(node!);
    expect(result.warnings).toContain('This call action does not reference an operation');
  });

  it('ACTIVITY_NODE: passes ownerRegionId through, same "campo nuevo, lista vieja" risk as ownerActionId', () => {
    const n: IRActivityNode = { id: 'ein1', kind: 'ACTIVITY_NODE', activityType: 'INPUT_EXPANSION_NODE', name: '', activityId: 'act1' };
    const model = baseModel({ activityNodes: { ein1: n } });
    const node = resolvedElementToDomainNode({ element: n, kind: 'ACTIVITY_NODE' }, model);
    expect(node?.type).toBe('INPUT_EXPANSION_NODE');
    // Proof the field actually landed on the DomainNode: the validator's
    // "no owning region" rule reads it, same shape as the ACTIVITY_PARTITION
    // "no name" proof above.
    expect(activityDiagramValidator.validateNode(node!).warnings?.[0]).toMatch(/no owning region/i);

    const owned: IRActivityNode = { ...n, ownerRegionId: 'r1' };
    const ownedNode = resolvedElementToDomainNode({ element: owned, kind: 'ACTIVITY_NODE' }, model);
    expect(activityDiagramValidator.validateNode(ownedNode!).warnings).toBeUndefined();
  });

  it('ACTIVITY_NODE: passes mode through for an expansion region', () => {
    const n: IRActivityNode = { id: 'r1', kind: 'ACTIVITY_NODE', activityType: 'EXPANSION_REGION', name: 'Per item', activityId: 'act1', mode: 'STREAM' };
    const model = baseModel({ activityNodes: { r1: n } });
    const node = resolvedElementToDomainNode({ element: n, kind: 'ACTIVITY_NODE' }, model);
    expect((node as unknown as { mode?: string })?.mode).toBe('STREAM');
  });

  it('ACTIVITY_PARTITION carries its name through for the "no name" check', () => {
    const p: IRActivityPartition = { id: 'p1', kind: 'ACTIVITY_PARTITION', name: '', activityId: 'act1', index: 0 };
    const model = baseModel({ activityPartitions: { p1: p } });
    const node = resolvedElementToDomainNode({ element: p, kind: 'ACTIVITY_PARTITION' }, model);
    const result = activityDiagramValidator.validateNode(node!);
    expect(result.warnings).toContain('This node has no name');
  });

  it('returns null for PACKAGE, NOTE and UNKNOWN — no validator treats them as a node', () => {
    const model = baseModel();
    expect(resolvedElementToDomainNode({ element: null, kind: 'NOTE' }, model)).toBeNull();
    expect(resolvedElementToDomainNode({ element: null, kind: 'UNKNOWN' }, model)).toBeNull();
  });

  it('returns null for SYSTEM_BOUNDARY (containment is view-level, not in the IR — §scope note)', () => {
    const model = baseModel();
    const sb = { id: 'sb1', kind: 'SYSTEM_BOUNDARY' as const, name: 'System' };
    expect(resolvedElementToDomainNode({ element: sb, kind: 'SYSTEM_BOUNDARY' }, model)).toBeNull();
  });
});

describe('relationToDomainEdge', () => {
  const rel = (kind: IRRelation['kind'], partial: Partial<IRRelation> = {}): IRRelation => ({
    id: 'r1', kind, sourceId: 'a', targetId: 'b', ...partial,
  });

  it('CLASS_DIAGRAM renames GENERALIZATION/REALIZATION to INHERITANCE/IMPLEMENTATION', () => {
    expect(relationToDomainEdge(rel('GENERALIZATION'), 'CLASS_DIAGRAM')?.type).toBe('INHERITANCE');
    expect(relationToDomainEdge(rel('REALIZATION'), 'CLASS_DIAGRAM')?.type).toBe('IMPLEMENTATION');
    expect(relationToDomainEdge(rel('ASSOCIATION'), 'CLASS_DIAGRAM')?.type).toBe('ASSOCIATION');
  });

  it('USE_CASE_DIAGRAM keeps GENERALIZATION as-is (no class-diagram-style rename)', () => {
    expect(relationToDomainEdge(rel('GENERALIZATION'), 'USE_CASE_DIAGRAM')?.type).toBe('GENERALIZATION');
    expect(relationToDomainEdge(rel('INCLUDE'), 'USE_CASE_DIAGRAM')?.type).toBe('INCLUDE');
  });

  it('ACTIVITY_DIAGRAM passes CONTROL_FLOW/OBJECT_FLOW through with guard/weight', () => {
    const edge = relationToDomainEdge(rel('CONTROL_FLOW', { guard: '[x>0]', weight: '2' }), 'ACTIVITY_DIAGRAM');
    expect(edge).toMatchObject({ type: 'CONTROL_FLOW', guard: '[x>0]', weight: '2' });
  });

  // v1.1 — interrupting edge flag + the new EXCEPTION_HANDLER relation kind.
  it('ACTIVITY_DIAGRAM passes isInterrupting through on a CONTROL_FLOW', () => {
    const edge = relationToDomainEdge(rel('CONTROL_FLOW', { isInterrupting: true }), 'ACTIVITY_DIAGRAM');
    expect(edge).toMatchObject({ type: 'CONTROL_FLOW', isInterrupting: true });
  });

  it('ACTIVITY_DIAGRAM passes EXCEPTION_HANDLER through', () => {
    const edge = relationToDomainEdge(rel('EXCEPTION_HANDLER'), 'ACTIVITY_DIAGRAM');
    expect(edge).toMatchObject({ type: 'EXCEPTION_HANDLER', sourceNodeId: 'a', targetNodeId: 'b' });
  });

  it('drops a relation kind the target diagram type has no opinion on', () => {
    // A control flow has no meaning on a Class Diagram.
    expect(relationToDomainEdge(rel('CONTROL_FLOW'), 'CLASS_DIAGRAM')).toBeNull();
    // DEPENDENCY has no Domain Model equivalent (deliberately excluded — Larman).
    expect(relationToDomainEdge(rel('DEPENDENCY'), 'DOMAIN_MODEL_DIAGRAM')).toBeNull();
  });
});
