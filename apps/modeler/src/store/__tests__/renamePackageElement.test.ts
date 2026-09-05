/**
 * renamePackageElement — rename a package that has already been promoted to
 * canvas (an IRPackage in `model.packages`), across BOTH store surfaces
 * (model.store / standaloneModelOps), mirroring the parameterisation used by
 * activityStoreOps.test.ts.
 *
 * Regression for project_package_rename_ghost_bug: renaming such a package
 * through the flat `packageNames` registry (remove old string, add new
 * string) is a no-op on the actual IRPackage — the string was already
 * removed when the package was promoted — so the UI ends up creating a new,
 * disconnected, empty package next to the untouched original. The fix is to
 * rename `IRPackage.name` in place instead once a package is canvas-backed;
 * these tests pin that behaviour directly at the store layer.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';
import { standaloneModelOps, getLocalModel, ensureLocalModel } from '../standaloneModelOps';
import { useVFSStore } from '../project-vfs.store';
import type { IRPackage, SemanticModel } from '../../core/domain/vfs/vfs.types';

const FILE_ID = 'standalone-package-file';
const PKG_ID = 'pkg-1';
const CLASS_ID = 'cls-1';

function irPackage(overrides: Partial<IRPackage> = {}): IRPackage {
  return {
    id: PKG_ID, name: 'acme', kind: 'PACKAGE',
    packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
    ...overrides,
  };
}

function freshStandaloneFile() {
  const now = Date.now();
  useVFSStore.getState().loadProject({
    id: 'proj-package', projectName: 'Test', version: '1.0.0', domainModelId: 'dm-1',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID, name: 'C.luml', type: 'FILE', parentId: null,
        diagramType: 'CLASS_DIAGRAM', extension: '.luml', isExternal: false, standalone: true,
        content: { diagramId: FILE_ID, nodes: [], edges: [] },
        createdAt: now, updatedAt: now,
      } as never,
    },
    createdAt: now, updatedAt: now,
  } as never);
  ensureLocalModel(FILE_ID);
}

interface Surface {
  name: string;
  reset: () => void;
  model: () => SemanticModel;
  seedPackage: (pkg: IRPackage) => void;
  rename: (id: string, name: string) => void;
}

const SURFACES: Surface[] = [
  {
    name: 'model.store (global)',
    reset: () => {
      useModelStore.getState().resetModel();
      useModelStore.getState().initModel('test-package-model');
    },
    model: () => useModelStore.getState().model as SemanticModel,
    seedPackage: (pkg) => {
      useModelStore.setState((state) => {
        state.model!.packages[pkg.id] = pkg;
      });
    },
    rename: (id, name) => useModelStore.getState().renamePackageElement(id, name),
  },
  {
    name: 'standaloneModelOps (localModel)',
    reset: freshStandaloneFile,
    model: () => getLocalModel(FILE_ID) as SemanticModel,
    seedPackage: (pkg) => {
      useVFSStore.getState().updateLocalModel(FILE_ID, (m) => {
        m.packages[pkg.id] = pkg;
      });
    },
    rename: (id, name) => standaloneModelOps(FILE_ID).renamePackageElement(id, name),
  },
];

describe.each(SURFACES)('renamePackageElement — $name', (surface) => {
  beforeEach(() => surface.reset());

  it('renames the IRPackage in place — no new package, no leftover old one', () => {
    surface.seedPackage(irPackage());

    surface.rename(PKG_ID, 'foobar');

    const packages = surface.model().packages;
    expect(Object.keys(packages)).toEqual([PKG_ID]);
    expect(packages[PKG_ID].name).toBe('foobar');
  });

  it('does NOT touch the flat packageNames registry (that is the whole bug)', () => {
    surface.seedPackage(irPackage());

    surface.rename(PKG_ID, 'foobar');

    expect(surface.model().packageNames ?? []).toEqual([]);
  });

  it('cascades the rename to direct member classes/interfaces/enums', () => {
    surface.seedPackage(irPackage({ classIds: [CLASS_ID] }));
    if (surface.name.startsWith('model.store')) {
      useModelStore.setState((state) => {
        state.model!.classes[CLASS_ID] = {
          id: CLASS_ID, name: 'User', kind: 'CLASS', attributeIds: [], operationIds: [],
          packageName: 'acme', packageId: PKG_ID,
        };
      });
    } else {
      useVFSStore.getState().updateLocalModel(FILE_ID, (m) => {
        m.classes[CLASS_ID] = {
          id: CLASS_ID, name: 'User', kind: 'CLASS', attributeIds: [], operationIds: [],
          packageName: 'acme', packageId: PKG_ID,
        } as never;
      });
    }

    surface.rename(PKG_ID, 'foobar');

    expect(surface.model().classes[CLASS_ID].packageName).toBe('foobar');
  });

  it('preserves a nested prefix when renaming a nested package (only the leaf changes)', () => {
    surface.seedPackage(irPackage({ classIds: [CLASS_ID] }));
    if (surface.name.startsWith('model.store')) {
      useModelStore.setState((state) => {
        state.model!.classes[CLASS_ID] = {
          id: CLASS_ID, name: 'User', kind: 'CLASS', attributeIds: [], operationIds: [],
          packageName: 'parent.acme', packageId: PKG_ID,
        };
      });
    } else {
      useVFSStore.getState().updateLocalModel(FILE_ID, (m) => {
        m.classes[CLASS_ID] = {
          id: CLASS_ID, name: 'User', kind: 'CLASS', attributeIds: [], operationIds: [],
          packageName: 'parent.acme', packageId: PKG_ID,
        } as never;
      });
    }

    surface.rename(PKG_ID, 'foobar');

    expect(surface.model().classes[CLASS_ID].packageName).toBe('parent.foobar');
  });

  it('is a no-op for an unknown package id', () => {
    surface.seedPackage(irPackage());

    surface.rename('does-not-exist', 'foobar');

    expect(surface.model().packages[PKG_ID].name).toBe('acme');
  });

  it('is a no-op for an empty or unchanged name', () => {
    surface.seedPackage(irPackage());

    surface.rename(PKG_ID, '   ');
    surface.rename(PKG_ID, 'acme');

    expect(surface.model().packages[PKG_ID].name).toBe('acme');
  });
});
