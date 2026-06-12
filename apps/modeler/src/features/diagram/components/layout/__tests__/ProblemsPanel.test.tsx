/**
 * ProblemsPanel — integration coverage (F1-B4).
 *
 * Renders the panel against the REAL VFS + model stores: a project with a
 * standalone file (save warning + its localModel dup) → asserts the rendered
 * grouping, the quick-fix button, that clicking the fix folds it in (warning
 * disappears) and that clicking a row navigates via openTab.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import ProblemsPanel from '../ProblemsPanel';
import { useVFSStore } from '../../../../../store/project-vfs.store';
import { useModelStore } from '../../../../../store/model.store';
import { useWorkspaceStore } from '../../../../../store/workspace.store';
import type {
  SemanticModel,
  DiagramView,
  VFSFile,
  LibreUMLProject,
} from '../../../../../core/domain/vfs/vfs.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

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
    diagramId: 'd',
    nodes: [
      { id: 'vA', elementId: 'a', x: 0, y: 0 },
      { id: 'vB', elementId: 'b', x: 100, y: 0 },
    ],
    edges: [],
  } as DiagramView;
}

function standaloneProject(): LibreUMLProject {
  const file: VFSFile = {
    id: 'f1', type: 'FILE', name: 'Domain', parentId: null, extension: '.luml',
    diagramType: 'CLASS_DIAGRAM', isExternal: false,
    standalone: true, localModel: dupLocalModel(), content: dupView(),
    createdAt: 1, updatedAt: 1,
  } as VFSFile;
  return {
    id: 'p1', projectName: 'P', version: '1.0.0', domainModelId: 'global',
    semanticModel: emptyModel('global'),
    nodes: { [file.id]: file },
    createdAt: 1, updatedAt: 1,
  };
}

describe('ProblemsPanel', () => {
  beforeEach(() => {
    useModelStore.getState().loadModel(emptyModel('global'));
    useWorkspaceStore.setState({ openTabs: [], activeTabId: null });
    act(() => useVFSStore.getState().loadProject(standaloneProject()));
  });

  it('groups problems under their diagram and renders the quick-fix', () => {
    render(<ProblemsPanel />);

    // Grouped under the diagram name.
    expect(screen.getByText('Domain')).toBeTruthy();
    // The standalone save warning + its quick-fix button.
    expect(screen.getByRole('button', { name: /Add to Project/ })).toBeTruthy();
    // The duplicate-classifier model error message rendered too.
    expect(screen.getByText(/Duplicate element: User/)).toBeTruthy();
  });

  it('folds the standalone in when the quick-fix is clicked', () => {
    render(<ProblemsPanel />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Project/ }));
    });

    // The save warning + its fix are gone.
    expect(screen.queryByRole('button', { name: /Add to Project/ })).toBeNull();
    expect((useVFSStore.getState().project!.nodes['f1'] as VFSFile).standalone).toBe(false);
  });

  it('navigates to the diagram tab when a problem row is clicked', () => {
    render(<ProblemsPanel />);

    const dupRow = screen.getByText(/Duplicate element: User/).closest('li')!;
    act(() => {
      fireEvent.click(within(dupRow).getByText(/Duplicate element: User/));
    });

    expect(useWorkspaceStore.getState().openTabs).toContain('f1');
    expect(useWorkspaceStore.getState().activeTabId).toBe('f1');
  });

  it('shows the empty state when there are no problems', () => {
    act(() => useVFSStore.getState().loadProject({
      id: 'p2', projectName: 'P', version: '1.0.0', domainModelId: 'global',
      semanticModel: emptyModel('global'), nodes: {}, createdAt: 1, updatedAt: 1,
    }));
    render(<ProblemsPanel />);
    expect(screen.getByText('terminal.noProblems')).toBeTruthy();
  });
});
