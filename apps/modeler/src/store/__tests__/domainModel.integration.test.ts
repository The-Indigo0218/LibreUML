/**
 * Domain Model integration tests.
 *
 * Coverage (plan item #31):
 *   create entity → add attributes → connect with association →
 *   persist → "reopen" (re-read from store state) → validate
 *
 * Uses model.store.ts (global path) and standaloneModelOps.ts (standalone
 * path) directly — no React rendering required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';
import { standaloneModelOps, getLocalModel, ensureLocalModel } from '../standaloneModelOps';
import { useVFSStore } from '../project-vfs.store';
import { domainModelDiagramValidator } from '../../core/validation/domain-model.validator';
import type { IRDomainAttribute } from '../../core/domain/vfs/vfs.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshModelStore() {
  useModelStore.getState().resetModel();
  useModelStore.getState().initModel('test-domain-model');
  return useModelStore.getState();
}

function freshStandaloneFile() {
  const now = Date.now();
  const fileId = 'standalone-file-1';
  useVFSStore.getState().loadProject({
    id: 'proj-1',
    projectName: 'Test',
    version: '1.0.0',
    domainModelId: 'dm-1',
    nodes: {
      [fileId]: {
        id: fileId,
        name: 'Diagram.luml',
        type: 'FILE',
        parentId: null,
        diagramType: 'DOMAIN_MODEL_DIAGRAM',
        extension: '.luml',
        isExternal: false,
        standalone: true,
        content: { diagramId: fileId, nodes: [], edges: [] },
        createdAt: now,
        updatedAt: now,
      } as any,
    },
    createdAt: now,
    updatedAt: now,
  });
  ensureLocalModel(fileId);
  return fileId;
}

// ─── Global model.store path ───────────────────────────────────────────────────

describe('Domain Model — global model.store integration', () => {
  beforeEach(() => {
    freshModelStore();
  });

  it('creates a domain entity with the correct IR shape', () => {
    const ms = useModelStore.getState();
    const id = ms.createDomainEntity({ name: 'Customer', attributeIds: [] });

    const model = useModelStore.getState().model!;
    expect(model.domainEntities).toBeDefined();
    expect(model.domainEntities![id]).toMatchObject({
      id,
      kind: 'DOMAIN_ENTITY',
      name: 'Customer',
      attributeIds: [],
    });
  });

  it('updates entity name', () => {
    const ms = useModelStore.getState();
    const id = ms.createDomainEntity({ name: 'OldName', attributeIds: [] });
    ms.updateDomainEntity(id, { name: 'NewName' });

    const entity = useModelStore.getState().model!.domainEntities![id];
    expect(entity.name).toBe('NewName');
  });

  it('adds and retrieves attributes via setDomainEntityAttributes', () => {
    const ms = useModelStore.getState();
    const entityId = ms.createDomainEntity({ name: 'Order', attributeIds: [] });

    const attrs: IRDomainAttribute[] = [
      { id: 'attr-1', kind: 'DOMAIN_ATTRIBUTE', name: 'orderId' },
      { id: 'attr-2', kind: 'DOMAIN_ATTRIBUTE', name: 'total' },
    ];
    ms.setDomainEntityAttributes(entityId, attrs);

    const model = useModelStore.getState().model!;
    const entity = model.domainEntities![entityId];
    expect(entity.attributeIds).toEqual(['attr-1', 'attr-2']);
    expect(model.domainAttributes!['attr-1'].name).toBe('orderId');
    expect(model.domainAttributes!['attr-2'].name).toBe('total');
  });

  it('replaces attributes cleanly (no orphaned attribute records)', () => {
    const ms = useModelStore.getState();
    const entityId = ms.createDomainEntity({ name: 'Product', attributeIds: [] });

    const initial: IRDomainAttribute[] = [
      { id: 'a1', kind: 'DOMAIN_ATTRIBUTE', name: 'sku' },
      { id: 'a2', kind: 'DOMAIN_ATTRIBUTE', name: 'price' },
    ];
    ms.setDomainEntityAttributes(entityId, initial);

    const replacement: IRDomainAttribute[] = [
      { id: 'a3', kind: 'DOMAIN_ATTRIBUTE', name: 'name' },
    ];
    ms.setDomainEntityAttributes(entityId, replacement);

    const model = useModelStore.getState().model!;
    expect(model.domainAttributes!['a1']).toBeUndefined();
    expect(model.domainAttributes!['a2']).toBeUndefined();
    expect(model.domainAttributes!['a3'].name).toBe('name');
    expect(model.domainEntities![entityId].attributeIds).toEqual(['a3']);
  });

  it('creates an ASSOCIATION relation between two entities', () => {
    const ms = useModelStore.getState();
    const srcId = ms.createDomainEntity({ name: 'Customer', attributeIds: [] });
    const tgtId = ms.createDomainEntity({ name: 'Order', attributeIds: [] });

    const relId = ms.createRelation({
      kind: 'ASSOCIATION',
      sourceId: srcId,
      targetId: tgtId,
      name: 'places',
      sourceEnd: { elementId: srcId, multiplicity: '1' },
      targetEnd: { elementId: tgtId, multiplicity: '0..*' },
    });

    const model = useModelStore.getState().model!;
    const rel = model.relations[relId];
    expect(rel.kind).toBe('ASSOCIATION');
    expect(rel.name).toBe('places');
    expect(rel.sourceEnd?.multiplicity).toBe('1');
    expect(rel.targetEnd?.multiplicity).toBe('0..*');
  });

  it('full lifecycle: create → attributes → associate → re-read → validate', () => {
    const ms = useModelStore.getState();

    // Create two entities
    const customerId = ms.createDomainEntity({ name: 'Customer', attributeIds: [] });
    const orderId = ms.createDomainEntity({ name: 'Order', attributeIds: [] });

    // Add attributes to Customer
    ms.setDomainEntityAttributes(customerId, [
      { id: 'c-name', kind: 'DOMAIN_ATTRIBUTE', name: 'fullName' },
      { id: 'c-email', kind: 'DOMAIN_ATTRIBUTE', name: 'email' },
    ]);

    // Add attributes to Order
    ms.setDomainEntityAttributes(orderId, [
      { id: 'o-id', kind: 'DOMAIN_ATTRIBUTE', name: 'orderId' },
      { id: 'o-total', kind: 'DOMAIN_ATTRIBUTE', name: 'total' },
    ]);

    // Connect with association
    const relId = ms.createRelation({
      kind: 'ASSOCIATION',
      sourceId: customerId,
      targetId: orderId,
      name: 'places',
      sourceEnd: { elementId: customerId, multiplicity: '1' },
      targetEnd: { elementId: orderId, multiplicity: '0..*' },
    });

    // Re-read from store (simulates "reopen")
    const model = useModelStore.getState().model!;

    // --- Entity assertions ---
    expect(Object.keys(model.domainEntities!)).toHaveLength(2);
    const customerEntity = model.domainEntities![customerId];
    const orderEntity = model.domainEntities![orderId];
    expect(customerEntity.name).toBe('Customer');
    expect(orderEntity.name).toBe('Order');

    // --- Attribute assertions ---
    expect(customerEntity.attributeIds).toEqual(['c-name', 'c-email']);
    expect(model.domainAttributes!['c-name'].name).toBe('fullName');
    expect(model.domainAttributes!['c-email'].name).toBe('email');
    expect(orderEntity.attributeIds).toEqual(['o-id', 'o-total']);

    // --- Relation assertions ---
    const rel = model.relations[relId];
    expect(rel.kind).toBe('ASSOCIATION');
    expect(rel.name).toBe('places');
    expect(rel.sourceId).toBe(customerId);
    expect(rel.targetId).toBe(orderId);

    // --- Validator assertions ---
    const validator = domainModelDiagramValidator;

    // Entity validation passes
    expect(validator.validateNode(
      { id: customerId, type: 'DOMAIN_ENTITY', name: 'Customer', attributes: [], createdAt: 0, updatedAt: 0 },
    ).isValid).toBe(true);

    // Edge validation passes (verb present, valid multiplicity)
    expect(validator.validateEdge(
      { id: relId, type: 'ASSOCIATION', label: 'places', sourceNodeId: customerId, targetNodeId: orderId, sourceMultiplicity: '1', targetMultiplicity: '0..*', createdAt: 0, updatedAt: 0 } as any,
      { id: customerId, type: 'DOMAIN_ENTITY', name: 'Customer', attributes: [], createdAt: 0, updatedAt: 0 },
      { id: orderId, type: 'DOMAIN_ENTITY', name: 'Order', attributes: [], createdAt: 0, updatedAt: 0 },
    ).isValid).toBe(true);

    // Connection validation passes
    expect(validator.validateConnection(
      { id: customerId, type: 'DOMAIN_ENTITY', name: 'Customer', attributes: [], createdAt: 0, updatedAt: 0 },
      { id: orderId, type: 'DOMAIN_ENTITY', name: 'Order', attributes: [], createdAt: 0, updatedAt: 0 },
      'ASSOCIATION',
    ).isValid).toBe(true);
  });

  it('deleteDomainEntity cascades and removes relations', () => {
    const ms = useModelStore.getState();
    const e1 = ms.createDomainEntity({ name: 'A', attributeIds: [] });
    const e2 = ms.createDomainEntity({ name: 'B', attributeIds: [] });
    ms.setDomainEntityAttributes(e1, [{ id: 'attr-x', kind: 'DOMAIN_ATTRIBUTE', name: 'x' }]);
    const relId = ms.createRelation({ kind: 'ASSOCIATION', sourceId: e1, targetId: e2, name: 'links' });

    ms.deleteDomainEntity(e1);

    const model = useModelStore.getState().model!;
    expect(model.domainEntities![e1]).toBeUndefined();
    expect(model.domainAttributes!['attr-x']).toBeUndefined();
    expect(model.relations[relId]).toBeUndefined();
    expect(model.domainEntities![e2]).toBeDefined();
  });

  it('backward-compat: existing model without domainEntities loads without error', () => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('legacy-model');
    const model = useModelStore.getState().model!;
    // domainEntities is optional — must be undefined or empty, never throw
    expect(model.domainEntities ?? {}).toEqual({});
    expect(model.domainAttributes ?? {}).toEqual({});
  });
});

// ─── standaloneModelOps path ──────────────────────────────────────────────────

describe('Domain Model — standaloneModelOps integration', () => {
  let fileId: string;

  beforeEach(() => {
    fileId = freshStandaloneFile();
  });

  it('creates domain entity in isolated localModel', () => {
    const ops = standaloneModelOps(fileId);
    const id = ops.createDomainEntity({ name: 'Invoice', attributeIds: [] });

    const lm = getLocalModel(fileId)!;
    expect(lm.domainEntities![id]).toMatchObject({ name: 'Invoice', kind: 'DOMAIN_ENTITY' });
    // Global model store must NOT be touched
    expect(useModelStore.getState().model?.domainEntities).toBeUndefined();
  });

  it('setDomainEntityAttributes writes only to localModel', () => {
    const ops = standaloneModelOps(fileId);
    const id = ops.createDomainEntity({ name: 'LineItem', attributeIds: [] });
    ops.setDomainEntityAttributes(id, [
      { id: 'li-qty', kind: 'DOMAIN_ATTRIBUTE', name: 'quantity' },
    ]);

    const lm = getLocalModel(fileId)!;
    expect(lm.domainEntities![id].attributeIds).toEqual(['li-qty']);
    expect(lm.domainAttributes!['li-qty'].name).toBe('quantity');
    expect(useModelStore.getState().model?.domainAttributes?.['li-qty']).toBeUndefined();
  });

  it('deleteDomainEntity cascades in localModel', () => {
    const ops = standaloneModelOps(fileId);
    const e1 = ops.createDomainEntity({ name: 'X', attributeIds: [] });
    const e2 = ops.createDomainEntity({ name: 'Y', attributeIds: [] });
    ops.setDomainEntityAttributes(e1, [{ id: 'attr-sa', kind: 'DOMAIN_ATTRIBUTE', name: 'sa' }]);
    const relId = ops.createRelation({ kind: 'ASSOCIATION', sourceId: e1, targetId: e2, name: 'uses' });

    ops.deleteDomainEntity(e1);

    const lm = getLocalModel(fileId)!;
    expect(lm.domainEntities![e1]).toBeUndefined();
    expect(lm.domainAttributes!['attr-sa']).toBeUndefined();
    expect(lm.relations[relId]).toBeUndefined();
    expect(lm.domainEntities![e2]).toBeDefined();
  });

  it('full standalone lifecycle matches global path', () => {
    const ops = standaloneModelOps(fileId);
    const srcId = ops.createDomainEntity({ name: 'Supplier', attributeIds: [] });
    const tgtId = ops.createDomainEntity({ name: 'Product', attributeIds: [] });

    ops.setDomainEntityAttributes(srcId, [
      { id: 's1', kind: 'DOMAIN_ATTRIBUTE', name: 'supplierCode' },
    ]);
    ops.setDomainEntityAttributes(tgtId, [
      { id: 'p1', kind: 'DOMAIN_ATTRIBUTE', name: 'sku' },
      { id: 'p2', kind: 'DOMAIN_ATTRIBUTE', name: 'price' },
    ]);

    const relId = ops.createRelation({
      kind: 'ASSOCIATION',
      sourceId: srcId,
      targetId: tgtId,
      name: 'supplies',
      sourceEnd: { elementId: srcId, multiplicity: '1' },
      targetEnd: { elementId: tgtId, multiplicity: '1..*' },
    });

    // Re-read localModel (simulates re-open)
    const lm = getLocalModel(fileId)!;

    expect(lm.domainEntities![srcId].name).toBe('Supplier');
    expect(lm.domainEntities![tgtId].name).toBe('Product');
    expect(lm.domainAttributes!['s1'].name).toBe('supplierCode');
    expect(lm.domainAttributes!['p1'].name).toBe('sku');
    expect(lm.domainAttributes!['p2'].name).toBe('price');

    const rel = lm.relations[relId];
    expect(rel.name).toBe('supplies');
    expect(rel.sourceEnd?.multiplicity).toBe('1');
    expect(rel.targetEnd?.multiplicity).toBe('1..*');
  });
});
