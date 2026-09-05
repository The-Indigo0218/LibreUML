/**
 * resolveIRPackageByPath — pure lookup used by every PackageExplorer mutation
 * that targets a package by its displayed (effective) path: rename, delete,
 * move-into, add-to-canvas. See project_package_rename_ghost_bug: skipping
 * this resolution on rename is exactly what let a promoted package's string
 * path fall through to the flat-registry branch and spawn a ghost duplicate.
 */
import { describe, it, expect } from 'vitest';
import { resolveIRPackageByPath } from '../PackageExplorer';
import type { IRPackage } from '../../../../../core/domain/vfs/vfs.types';

function pkg(id: string, name: string): IRPackage {
  return { id, name, kind: 'PACKAGE', packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [] };
}

describe('resolveIRPackageByPath', () => {
  it('finds a root package by its own name when no effective path is recorded', () => {
    const packages = { p1: pkg('p1', 'acme') };
    expect(resolveIRPackageByPath(packages, new Map(), 'acme')?.id).toBe('p1');
  });

  it('finds a nested package by its effective (ancestor-qualified) path, not its bare name', () => {
    const packages = { p1: pkg('p1', 'parent'), p2: pkg('p2', 'child') };
    const effectivePaths = new Map([['p2', 'parent.child']]);
    expect(resolveIRPackageByPath(packages, effectivePaths, 'parent.child')?.id).toBe('p2');
    // The bare, unqualified name must NOT match once it has an effective path.
    expect(resolveIRPackageByPath(packages, effectivePaths, 'child')).toBeUndefined();
  });

  it('returns undefined for a path with no matching IRPackage (plain string-registry package)', () => {
    const packages = { p1: pkg('p1', 'acme') };
    expect(resolveIRPackageByPath(packages, new Map(), 'not-on-canvas')).toBeUndefined();
  });

  it('returns undefined when there are no packages at all', () => {
    expect(resolveIRPackageByPath(undefined, new Map(), 'acme')).toBeUndefined();
    expect(resolveIRPackageByPath({}, new Map(), 'acme')).toBeUndefined();
  });
});
