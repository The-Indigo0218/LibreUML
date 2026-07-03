import { describe, it, expect } from 'vitest';
import { DomainModelDiagramValidator } from '../domain-model.validator';
import type { DomainEntityNode } from '../../domain/models/nodes/domain-model.types';
import type { DomainAssociationEdge } from '../../domain/models/edges/domain-model.types';

describe('DomainModelDiagramValidator', () => {
  const validator = new DomainModelDiagramValidator();

  const makeEntity = (overrides?: Partial<DomainEntityNode>): DomainEntityNode => ({
    id: 'e1',
    type: 'DOMAIN_ENTITY',
    name: 'Customer',
    attributes: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  });

  const makeAssoc = (overrides?: Partial<DomainAssociationEdge>): DomainAssociationEdge => ({
    id: 'rel1',
    type: 'ASSOCIATION',
    sourceNodeId: 'e1',
    targetNodeId: 'e2',
    label: 'places',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  });

  // ── validateConnection ─────────────────────────────────────────────────────

  describe('validateConnection', () => {
    it('allows ASSOCIATION between two DOMAIN_ENTITY nodes', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2', name: 'Order' });
      expect(validator.validateConnection(src, tgt, 'ASSOCIATION').isValid).toBe(true);
    });

    it('allows self-association (same entity, different ends)', () => {
      const entity = makeEntity();
      expect(validator.validateConnection(entity, entity, 'ASSOCIATION').isValid).toBe(true);
    });

    it('allows NOTE_LINK regardless of node types', () => {
      const src = makeEntity();
      const tgt = makeEntity({ id: 'e2', type: 'DOMAIN_ENTITY' });
      expect(validator.validateConnection(src, tgt, 'NOTE_LINK').isValid).toBe(true);
    });

    it('rejects INHERITANCE', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      const result = validator.validateConnection(src, tgt, 'INHERITANCE');
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('INHERITANCE');
    });

    it('rejects INCLUDE', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      expect(validator.validateConnection(src, tgt, 'INCLUDE').isValid).toBe(false);
    });

    it('rejects DEPENDENCY', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      expect(validator.validateConnection(src, tgt, 'DEPENDENCY').isValid).toBe(false);
    });

    it('accepts AGGREGATION between two entities', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      expect(validator.validateConnection(src, tgt, 'AGGREGATION').isValid).toBe(true);
    });

    it('accepts COMPOSITION between two entities', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      expect(validator.validateConnection(src, tgt, 'COMPOSITION').isValid).toBe(true);
    });

    it('rejects REALIZATION', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      expect(validator.validateConnection(src, tgt, 'REALIZATION').isValid).toBe(false);
    });

    it('accepts GENERALIZATION between two entities', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      expect(validator.validateConnection(src, tgt, 'GENERALIZATION').isValid).toBe(true);
    });

    it('rejects GENERALIZATION from an entity to itself', () => {
      const e = makeEntity({ id: 'e1' });
      const result = validator.validateConnection(e, e, 'GENERALIZATION');
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('itself');
    });

    it('rejects EXTEND', () => {
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      expect(validator.validateConnection(src, tgt, 'EXTEND').isValid).toBe(false);
    });

    it('rejects ASSOCIATION when source is not DOMAIN_ENTITY', () => {
      const src = { id: 'a1', type: 'ACTOR', name: 'User', createdAt: 0, updatedAt: 0 } as any;
      const tgt = makeEntity();
      const result = validator.validateConnection(src, tgt, 'ASSOCIATION');
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('source');
    });

    it('rejects ASSOCIATION when target is not DOMAIN_ENTITY', () => {
      const src = makeEntity();
      const tgt = { id: 'uc1', type: 'USE_CASE', name: 'Login', createdAt: 0, updatedAt: 0 } as any;
      const result = validator.validateConnection(src, tgt, 'ASSOCIATION');
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('target');
    });
  });

  // ── validateNode ──────────────────────────────────────────────────────────

  describe('validateNode', () => {
    it('accepts a valid entity with attributes', () => {
      const entity = makeEntity({
        attributes: [
          { id: 'a1', name: 'name' },
          { id: 'a2', name: 'email' },
        ],
      });
      expect(validator.validateNode(entity).isValid).toBe(true);
    });

    it('rejects empty entity name', () => {
      const result = validator.validateNode(makeEntity({ name: '' }));
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Domain Entity name cannot be empty');
    });

    it('rejects whitespace-only entity name', () => {
      const result = validator.validateNode(makeEntity({ name: '   ' }));
      expect(result.isValid).toBe(false);
    });

    it('warns on duplicate entity name in diagram', () => {
      const entity = makeEntity({ id: 'e1', name: 'Customer' });
      const other = makeEntity({ id: 'e2', name: 'Customer' });
      const result = validator.validateNode(entity, [entity, other]);
      expect(result.isValid).toBe(true);
      expect(result.warnings?.some((w) => w.includes('Duplicate entity name'))).toBe(true);
    });

    it('duplicate name check is case-insensitive', () => {
      const entity = makeEntity({ id: 'e1', name: 'customer' });
      const other = makeEntity({ id: 'e2', name: 'Customer' });
      const result = validator.validateNode(entity, [entity, other]);
      expect(result.warnings?.some((w) => w.includes('Duplicate entity name'))).toBe(true);
    });

    it('rejects empty attribute name', () => {
      const entity = makeEntity({ attributes: [{ id: 'a1', name: '' }] });
      const result = validator.validateNode(entity);
      expect(result.isValid).toBe(false);
      expect(result.errors?.some((e) => e.includes('Attribute name cannot be empty'))).toBe(true);
    });

    it('rejects duplicate attribute name within same entity', () => {
      const entity = makeEntity({
        attributes: [
          { id: 'a1', name: 'email' },
          { id: 'a2', name: 'email' },
        ],
      });
      const result = validator.validateNode(entity);
      expect(result.isValid).toBe(false);
      expect(result.errors?.some((e) => e.includes('Duplicate attribute name'))).toBe(true);
    });

    it('duplicate attribute check is case-insensitive', () => {
      const entity = makeEntity({
        attributes: [
          { id: 'a1', name: 'Email' },
          { id: 'a2', name: 'email' },
        ],
      });
      expect(validator.validateNode(entity).isValid).toBe(false);
    });

    it('rejects unknown node type', () => {
      const node = { id: 'x', type: 'ACTOR', name: 'foo', createdAt: 0, updatedAt: 0 } as any;
      const result = validator.validateNode(node);
      expect(result.isValid).toBe(false);
    });
  });

  // ── validateEdge ──────────────────────────────────────────────────────────

  describe('validateEdge', () => {
    it('accepts association with verb label', () => {
      const edge = makeAssoc({ label: 'places' });
      const src = makeEntity({ id: 'e1' });
      const tgt = makeEntity({ id: 'e2' });
      expect(validator.validateEdge(edge, src, tgt).isValid).toBe(true);
    });

    it('allows association with empty label (verb is optional) but warns', () => {
      const edge = makeAssoc({ label: '' });
      const result = validator.validateEdge(edge, makeEntity(), makeEntity());
      expect(result.isValid).toBe(true);
      expect(result.warnings?.some((w) => w.includes('verb label'))).toBe(true);
    });

    it('allows association with whitespace-only label but warns', () => {
      const edge = makeAssoc({ label: '   ' });
      const result = validator.validateEdge(edge, makeEntity(), makeEntity());
      expect(result.isValid).toBe(true);
      expect(result.warnings?.some((w) => w.includes('verb label'))).toBe(true);
    });

    it('accepts standard multiplicity presets', () => {
      for (const preset of ['1', '*', '0..1', '1..*', '0..*']) {
        const edge = makeAssoc({ sourceMultiplicity: preset, targetMultiplicity: preset });
        const result = validator.validateEdge(edge, makeEntity(), makeEntity());
        expect(result.isValid).toBe(true);
        expect(result.warnings).toBeUndefined();
      }
    });

    it('accepts custom valid multiplicities (2..5, 1..3)', () => {
      const edge = makeAssoc({ sourceMultiplicity: '2..5', targetMultiplicity: '1..3' });
      const result = validator.validateEdge(edge, makeEntity(), makeEntity());
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('warns on malformed source multiplicity', () => {
      const edge = makeAssoc({ sourceMultiplicity: 'foo' });
      const result = validator.validateEdge(edge, makeEntity(), makeEntity());
      expect(result.isValid).toBe(true);
      expect(result.warnings?.some((w) => w.includes('Source multiplicity'))).toBe(true);
    });

    it('warns on malformed target multiplicity', () => {
      const edge = makeAssoc({ targetMultiplicity: '1.*' });
      const result = validator.validateEdge(edge, makeEntity(), makeEntity());
      expect(result.isValid).toBe(true);
      expect(result.warnings?.some((w) => w.includes('Target multiplicity'))).toBe(true);
    });

    it('passes through non-association edges unchanged', () => {
      const edge = { id: 'n1', type: 'NOTE_LINK', sourceNodeId: 'e1', targetNodeId: 'n2', label: '', createdAt: 0, updatedAt: 0 } as any;
      expect(validator.validateEdge(edge, makeEntity(), makeEntity()).isValid).toBe(true);
    });
  });
});
