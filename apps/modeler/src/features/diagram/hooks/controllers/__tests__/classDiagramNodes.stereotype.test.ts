import { describe, it, expect } from 'vitest';
import { buildClassDiagramNodes } from '../classDiagramNodes';
import type { NodeViewModel } from '../../../../../adapters/view-models/node.view-model';
import type {
  DiagramView,
  SemanticModel,
  ViewNode,
} from '../../../../../core/domain/vfs/vfs.types';

function makeModel(overrides: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'model-1', name: 'Test', version: '1',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, systemBoundaries: {},
    ucModules: {}, domainEntities: {}, domainAttributes: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
    createdAt: 0, updatedAt: 0,
    ...overrides,
  } as SemanticModel;
}

function buildOne(element: Record<string, unknown>, bucket: keyof SemanticModel): NodeViewModel {
  const viewNode: ViewNode = { id: 'vn-1', elementId: 'el-1', x: 0, y: 0 };
  const diagramView = { id: 'd-1', kind: 'CLASS', nodes: [viewNode], edges: [] } as unknown as DiagramView;
  const model = makeModel({ [bucket]: { 'el-1': element } } as Partial<SemanticModel>);
  const nodes = buildClassDiagramNodes({
    diagramView, model, isStandalone: false, activeTabId: null, handleNoteUpdate: () => {},
  });
  return nodes[0].data as NodeViewModel;
}

describe('buildClassDiagramNodes — user stereotypes on the node', () => {
  it('paints a user stereotype on a plain class', () => {
    const vm = buildOne(
      { id: 'el-1', name: 'Order', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [], stereotypes: ['entity'] },
      'classes',
    );
    expect(vm.stereotype).toBe('entity');
    expect(vm.style.showStereotype).toBe(true);
  });

  it('combines the per-kind keyword with user stereotypes (interface)', () => {
    const vm = buildOne(
      { id: 'el-1', name: 'Repo', kind: 'INTERFACE', operationIds: [], stereotypes: ['service'] },
      'interfaces',
    );
    expect(vm.stereotype).toBe('interface, service');
  });

  it('filters out legacy generic tokens so they are not shown as stereotypes', () => {
    const vm = buildOne(
      { id: 'el-1', name: 'Box', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [], stereotypes: ['<T>', 'entity'] },
      'classes',
    );
    expect(vm.stereotype).toBe('entity');
  });

  it('leaves a plain class with no stereotypes unmarked', () => {
    const vm = buildOne(
      { id: 'el-1', name: 'Plain', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [] },
      'classes',
    );
    expect(vm.stereotype).toBeUndefined();
    expect(vm.style.showStereotype).toBe(false);
  });
});

describe('buildClassDiagramNodes — generics on the node', () => {
  it('exposes the generic from the dedicated field as a sublabel', () => {
    const vm = buildOne(
      { id: 'el-1', name: 'Box', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [], generics: '<T>' },
      'classes',
    );
    expect(vm.sublabel).toBe('<T>');
  });

  it('falls back to a legacy generic token in stereotypes (backward-compat)', () => {
    const vm = buildOne(
      { id: 'el-1', name: 'Pair', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [], stereotypes: ['<K, V>'] },
      'classes',
    );
    expect(vm.sublabel).toBe('<K, V>');
  });

  it('does not assign a sublabel to enums', () => {
    const vm = buildOne(
      { id: 'el-1', name: 'Status', kind: 'ENUM', literals: [], generics: '<T>' },
      'enums',
    );
    expect(vm.sublabel).toBeUndefined();
  });
});
