/**
 * validateModel — unit coverage (F1-B2).
 *
 * The pure validator extracted from useModelValidation. Runs over any
 * SemanticModel (global or a standalone's localModel) with no React/store.
 */
import { describe, it, expect } from 'vitest';
import { validateModel } from '../validateModel';
import type { SemanticModel } from '../../../../core/domain/vfs/vfs.types';

function emptyModel(): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, interactionFragments: {}, gates: {}, relations: {},
    createdAt: 1, updatedAt: 1,
  } as SemanticModel;
}

describe('validateModel', () => {
  it('treats null/empty models as clean', () => {
    expect(validateModel(null)).toEqual({ errors: [], warnings: [] });
    expect(validateModel(emptyModel())).toEqual({ errors: [], warnings: [] });
  });

  it('flags duplicate classifiers sharing an FQN', () => {
    const m = emptyModel();
    m.classes = {
      a: { id: 'a', name: 'User', packageName: 'app', attributeIds: [], operationIds: [] } as never,
      b: { id: 'b', name: 'User', packageName: 'app', attributeIds: [], operationIds: [] } as never,
    };
    const { errors } = validateModel(m);
    expect(errors).toContain('Duplicate element: User in package app');
  });

  it('does not flag same-named classifiers in different packages', () => {
    const m = emptyModel();
    m.classes = {
      a: { id: 'a', name: 'User', packageName: 'app', attributeIds: [], operationIds: [] } as never,
      b: { id: 'b', name: 'User', packageName: 'core', attributeIds: [], operationIds: [] } as never,
    };
    expect(validateModel(m).errors).toEqual([]);
  });

  it('ignores external classifiers', () => {
    const m = emptyModel();
    m.classes = {
      a: { id: 'a', name: 'User', attributeIds: [], operationIds: [], isExternal: true } as never,
      b: { id: 'b', name: 'User', attributeIds: [], operationIds: [], isExternal: true } as never,
    };
    expect(validateModel(m).errors).toEqual([]);
  });

  it('flags duplicate attributes within a classifier', () => {
    const m = emptyModel();
    m.attributes = {
      x1: { id: 'x1', name: 'id' } as never,
      x2: { id: 'x2', name: 'id' } as never,
    };
    m.classes = {
      a: { id: 'a', name: 'User', attributeIds: ['x1', 'x2'], operationIds: [] } as never,
    };
    expect(validateModel(m).errors).toContain('Duplicate attribute: id in User');
  });

  it('flags duplicate operations with the same signature', () => {
    const m = emptyModel();
    m.operations = {
      o1: { id: 'o1', name: 'save', parameters: [], returnType: 'void' } as never,
      o2: { id: 'o2', name: 'save', parameters: [], returnType: 'void' } as never,
    };
    m.classes = {
      a: { id: 'a', name: 'User', attributeIds: [], operationIds: ['o1', 'o2'] } as never,
    };
    expect(validateModel(m).errors).toContain('Duplicate operation: save():void in User');
  });

  it('treats operations differing only by parameter types as distinct', () => {
    const m = emptyModel();
    m.operations = {
      o1: { id: 'o1', name: 'save', parameters: [{ name: 'x', type: 'int' }], returnType: 'void' } as never,
      o2: { id: 'o2', name: 'save', parameters: [{ name: 'x', type: 'string' }], returnType: 'void' } as never,
    };
    m.classes = {
      a: { id: 'a', name: 'User', attributeIds: [], operationIds: ['o1', 'o2'] } as never,
    };
    expect(validateModel(m).errors).toEqual([]);
  });
});
