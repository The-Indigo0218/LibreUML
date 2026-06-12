/**
 * SaveProjectWarningModal — coverage (F1-C).
 *
 * The export-time warning now offers a per-file "Add to Project" CTA (folds the
 * standalone into the shared model via the B1 action) and a "Why?" explainer.
 * Drives the real VFS + model stores so the CTA actually mutates state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SaveProjectWarningModal from '../SaveProjectWarningModal';
import { useVFSStore } from '../../../../../store/project-vfs.store';
import { useModelStore } from '../../../../../store/model.store';
import type {
  SemanticModel,
  DiagramView,
  VFSFile,
  LibreUMLProject,
} from '../../../../../core/domain/vfs/vfs.types';

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

function localModel(): SemanticModel {
  const m = emptyModel('local');
  m.classes = { a: { id: 'a', name: 'Order', attributeIds: [], operationIds: [] } as never };
  return m;
}

function view(): DiagramView {
  return { diagramId: 'd', nodes: [{ id: 'vA', elementId: 'a', x: 0, y: 0 }], edges: [] } as DiagramView;
}

function projectWithStandalone(): LibreUMLProject {
  const file: VFSFile = {
    id: 'f1', type: 'FILE', name: 'Orders', parentId: null, extension: '.luml',
    diagramType: 'CLASS_DIAGRAM', isExternal: false,
    standalone: true, localModel: localModel(), content: view(),
    createdAt: 1, updatedAt: 1,
  } as VFSFile;
  return {
    id: 'p1', projectName: 'P', version: '1.0.0', domainModelId: 'global',
    semanticModel: emptyModel('global'), nodes: { [file.id]: file },
    createdAt: 1, updatedAt: 1,
  };
}

describe('SaveProjectWarningModal', () => {
  beforeEach(() => {
    useModelStore.getState().loadModel(emptyModel('global'));
    act(() => useVFSStore.getState().loadProject(projectWithStandalone()));
  });

  it('lists each standalone with an Add-to-Project CTA and a Why explainer', () => {
    render(
      <SaveProjectWarningModal
        isOpen
        standaloneFiles={[{ id: 'f1', name: 'Orders' }]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add to Project/ })).toBeTruthy();

    // Why explainer is collapsed until toggled.
    expect(screen.queryByText(/isolated from the shared project model/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /What is a standalone file/ }));
    expect(screen.getByText(/isolated from the shared project model/)).toBeTruthy();
  });

  it('folds the standalone into the project when the CTA is clicked', () => {
    render(
      <SaveProjectWarningModal
        isOpen
        standaloneFiles={[{ id: 'f1', name: 'Orders' }]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: /Add to Project/ })));

    const file = useVFSStore.getState().project!.nodes['f1'] as VFSFile;
    expect(file.standalone).toBe(false);
    expect(file.localModel).toBeNull();
    // The merged class is now in the global model.
    expect(Object.values(useModelStore.getState().model!.classes).some((c) => c.name === 'Order')).toBe(true);
  });

  it('shows the all-clear state when no standalone files remain', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <SaveProjectWarningModal
        isOpen
        standaloneFiles={[]}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText('Ready to Save')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save Project' });
    fireEvent.click(save);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <SaveProjectWarningModal isOpen={false} standaloneFiles={[]} onClose={() => {}} onConfirm={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
