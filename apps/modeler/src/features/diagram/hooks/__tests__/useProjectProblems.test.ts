/**
 * useProjectProblems — integration coverage (F1-B3).
 *
 * Drives the hook against the REAL VFS + model stores: a project with one
 * standalone file that ALSO carries a duplicate-classifier validation error.
 * Asserts the aggregated counts and that applying the standalone's "Add to
 * Project" quick-fix drops the save warning on re-render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectProblems } from '../useProjectProblems';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { useModelStore } from '../../../../store/model.store';
import type {
  SemanticModel,
  DiagramView,
  VFSFile,
  LibreUMLProject,
} from '../../../../core/domain/vfs/vfs.types';

function emptyModel(id = 'global'): SemanticModel {
  return {
    id, name: 'M', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {},
    lifelines: {}, messages: {}, interactionFragments: {}, gates: {}, relations: {},
    createdAt: 1, updatedAt: 1,
  } as SemanticModel;
}

/** Standalone localModel with TWO same-FQN classes → one duplicate error. */
function dupLocalModel(): SemanticModel {
  const m = emptyModel('local');
  m.classes = {
    a: { id: 'a', name: 'User', packageName: 'app', attributeIds: [], operationIds: [] } as never,
    b: { id: 'b', name: 'User', packageName: 'app', attributeIds: [], operationIds: [] } as never,
  };
  return m;
}

function dupView(): DiagramView {
  return {
    diagramId: 'd', nodes: [
      { id: 'vA', elementId: 'a', x: 0, y: 0 },
      { id: 'vB', elementId: 'b', x: 100, y: 0 },
    ], edges: [],
  } as DiagramView;
}

function projectWith(file: VFSFile): LibreUMLProject {
  return {
    id: 'p1', projectName: 'P', version: '1.0.0', domainModelId: 'global',
    semanticModel: emptyModel('global'),
    nodes: { [file.id]: file },
    createdAt: 1, updatedAt: 1,
  };
}

describe('useProjectProblems', () => {
  beforeEach(() => {
    useModelStore.getState().loadModel(emptyModel('global'));
  });

  it('aggregates a standalone save warning + its localModel validation error', () => {
    const file: VFSFile = {
      id: 'f1', type: 'FILE', name: 'Domain', parentId: null, extension: '.luml',
      diagramType: 'CLASS_DIAGRAM', isExternal: false,
      standalone: true, localModel: dupLocalModel(), content: dupView(),
      createdAt: 1, updatedAt: 1,
    } as VFSFile;
    act(() => useVFSStore.getState().loadProject(projectWith(file)));

    const { result } = renderHook(() => useProjectProblems());

    // 1 model error (duplicate User) + 1 save warning (standalone excluded).
    expect(result.current.errorCount).toBe(1);
    expect(result.current.warningCount).toBe(1);
    expect(result.current.problems.some((p) => p.category === 'model' && p.diagramId === 'f1')).toBe(true);

    const save = result.current.problems.find((p) => p.category === 'save');
    expect(save?.fix?.label).toBe('Add to Project');
  });

  it('drops the save warning after applying the Add-to-Project quick-fix', () => {
    const file: VFSFile = {
      id: 'f1', type: 'FILE', name: 'Domain', parentId: null, extension: '.luml',
      diagramType: 'CLASS_DIAGRAM', isExternal: false,
      standalone: true, localModel: dupLocalModel(), content: dupView(),
      createdAt: 1, updatedAt: 1,
    } as VFSFile;
    act(() => useVFSStore.getState().loadProject(projectWith(file)));

    const { result, rerender } = renderHook(() => useProjectProblems());

    const save = result.current.problems.find((p) => p.category === 'save');
    expect(save).toBeTruthy();

    const before = result.current.problems.length;
    act(() => save!.fix!.run());
    rerender();

    // No standalone left → save warning gone. The merge also _1-dedups the clashing
    // classifier names, so the model error clears too: total problems drop.
    expect(result.current.problems.some((p) => p.category === 'save')).toBe(false);
    expect((useVFSStore.getState().project!.nodes['f1'] as VFSFile).standalone).toBe(false);
    expect(result.current.problems.length).toBeLessThan(before);
  });

  it('surfaces a registry-validator warning for a known Activity Diagram violation (§16)', () => {
    const model = emptyModel('global');
    model.activities = { act1: { id: 'act1', kind: 'ACTIVITY', name: 'Flow' } as never };
    model.activityNodes = {
      d1: { id: 'd1', kind: 'ACTIVITY_NODE', activityType: 'DECISION', name: 'Paid?', activityId: 'act1' } as never,
    };
    const file: VFSFile = {
      id: 'f1', type: 'FILE', name: 'Flow', parentId: null, extension: '.luml',
      diagramType: 'ACTIVITY_DIAGRAM', isExternal: false, standalone: false,
      content: { diagramId: 'f1', nodes: [{ id: 'v1', elementId: 'd1', x: 0, y: 0 }], edges: [] },
      createdAt: 1, updatedAt: 1,
    } as VFSFile;
    act(() => useVFSStore.getState().loadProject({
      id: 'p1', projectName: 'P', version: '1.0.0', domainModelId: 'global',
      semanticModel: model, nodes: { [file.id]: file }, createdAt: 1, updatedAt: 1,
    }));

    const { result } = renderHook(() => useProjectProblems());

    // A decision with zero outgoing flows: both the per-node rule (validateNode
    // has nothing to say about DECISION — it's unnamed-type-agnostic here) and
    // the structural rule (validateActivityStructure) should fire.
    expect(result.current.problems).toContainEqual(
      expect.objectContaining({
        category: 'validation',
        severity: 'warning',
        diagramId: 'f1',
        message: 'Decision "Paid?" has only one outgoing flow — nothing to branch on',
      }),
    );
  });

  it('surfaces a registry-validator error for a known Class Diagram violation (§16)', () => {
    const model = emptyModel('global');
    model.classes = {
      c1: { id: 'c1', kind: 'CLASS', name: '', attributeIds: [], operationIds: [] } as never,
    };
    const file: VFSFile = {
      id: 'f1', type: 'FILE', name: 'Model', parentId: null, extension: '.luml',
      diagramType: 'CLASS_DIAGRAM', isExternal: false, standalone: false,
      content: { diagramId: 'f1', nodes: [{ id: 'v1', elementId: 'c1', x: 0, y: 0 }], edges: [] },
      createdAt: 1, updatedAt: 1,
    } as VFSFile;
    act(() => useVFSStore.getState().loadProject({
      id: 'p1', projectName: 'P', version: '1.0.0', domainModelId: 'global',
      semanticModel: model, nodes: { [file.id]: file }, createdAt: 1, updatedAt: 1,
    }));

    const { result } = renderHook(() => useProjectProblems());

    expect(result.current.problems).toContainEqual(
      expect.objectContaining({ category: 'validation', severity: 'error', diagramId: 'f1' }),
    );
  });

  it('returns empty for a project with no diagram files', () => {
    act(() => useVFSStore.getState().loadProject({
      id: 'p2', projectName: 'P', version: '1.0.0', domainModelId: 'global',
      semanticModel: emptyModel('global'), nodes: {}, createdAt: 1, updatedAt: 1,
    }));
    const { result } = renderHook(() => useProjectProblems());
    expect(result.current).toEqual({ problems: [], errorCount: 0, warningCount: 0, infoCount: 0 });
  });
});
