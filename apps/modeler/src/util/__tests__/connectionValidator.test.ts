import { describe, it, expect } from 'vitest';
import { validateConnection } from '../connectionValidator';

describe('validateConnection — package relations', () => {
  it('allows generic dependency between packages', () => {
    expect(validateConnection('package', 'package', 'dependency')).toBe(true);
  });

  it('allows package_import between packages', () => {
    expect(validateConnection('package', 'package', 'package_import')).toBe(true);
  });

  it('allows package_access between packages', () => {
    expect(validateConnection('package', 'package', 'package_access')).toBe(true);
  });

  it('allows package_merge between packages', () => {
    expect(validateConnection('package', 'package', 'package_merge')).toBe(true);
  });

  it('rejects association between packages', () => {
    expect(validateConnection('package', 'package', 'association')).toBe(false);
  });

  it('rejects inheritance between packages', () => {
    expect(validateConnection('package', 'package', 'inheritance')).toBe(false);
  });

  it('rejects aggregation between packages', () => {
    expect(validateConnection('package', 'package', 'aggregation')).toBe(false);
  });

  it('rejects package_import from class to package', () => {
    expect(validateConnection('class', 'package', 'package_import')).toBe(false);
  });

  it('rejects package_import from package to class', () => {
    expect(validateConnection('package', 'class', 'package_import')).toBe(false);
  });

  it('rejects package_access from class to class', () => {
    expect(validateConnection('class', 'class', 'package_access')).toBe(false);
  });

  it('rejects package_merge from interface to package', () => {
    expect(validateConnection('interface', 'package', 'package_merge')).toBe(false);
  });
});

describe('validateConnection — note bypass', () => {
  it('allows any relation to/from note', () => {
    expect(validateConnection('note', 'class', 'association')).toBe(true);
    expect(validateConnection('class', 'note', 'inheritance')).toBe(true);
    expect(validateConnection('note', 'package', 'package_import')).toBe(true);
  });
});

describe('validateConnection — class relations', () => {
  it('allows class→class inheritance', () => {
    expect(validateConnection('class', 'class', 'inheritance')).toBe(true);
  });

  it('rejects class→interface inheritance', () => {
    expect(validateConnection('class', 'interface', 'inheritance')).toBe(false);
  });

  it('allows class→interface implementation', () => {
    expect(validateConnection('class', 'interface', 'implementation')).toBe(true);
  });

  it('rejects interface→class implementation', () => {
    expect(validateConnection('interface', 'class', 'implementation')).toBe(false);
  });

  it('allows class→class dependency', () => {
    expect(validateConnection('class', 'class', 'dependency')).toBe(true);
  });

  it('allows class→package dependency', () => {
    expect(validateConnection('class', 'package', 'dependency')).toBe(true);
  });
});
