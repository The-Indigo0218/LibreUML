import { describe, it, expect } from 'vitest';
import { getPackageHierarchy, ensurePackageHierarchy } from '../packageHelpers';

describe('packageHelpers', () => {
  describe('getPackageHierarchy', () => {
    it('should return hierarchy for nested package', () => {
      const result = getPackageHierarchy('as2.as.test');
      expect(result).toEqual(['as2', 'as2.as', 'as2.as.test']);
    });

    it('should return hierarchy for two-level package', () => {
      const result = getPackageHierarchy('com.example');
      expect(result).toEqual(['com', 'com.example']);
    });

    it('should return single element for non-nested package', () => {
      const result = getPackageHierarchy('single');
      expect(result).toEqual(['single']);
    });

    it('should return empty array for empty string', () => {
      expect(getPackageHierarchy('')).toEqual([]);
      expect(getPackageHierarchy('   ')).toEqual([]);
    });

    it('should handle deeply nested packages', () => {
      const result = getPackageHierarchy('com.company.project.module.submodule');
      expect(result).toEqual([
        'com',
        'com.company',
        'com.company.project',
        'com.company.project.module',
        'com.company.project.module.submodule'
      ]);
    });
  });

  describe('ensurePackageHierarchy', () => {
    it('should add all intermediate packages', () => {
      const existing = ['com'];
      const result = ensurePackageHierarchy(existing, 'com.example.test');
      expect(result).toContain('com');
      expect(result).toContain('com.example');
      expect(result).toContain('com.example.test');
    });

    it('should not duplicate existing packages', () => {
      const existing = ['as2', 'as2.as'];
      const result = ensurePackageHierarchy(existing, 'as2.as.test');
      expect(result.filter(p => p === 'as2')).toHaveLength(1);
      expect(result.filter(p => p === 'as2.as')).toHaveLength(1);
      expect(result).toContain('as2.as.test');
    });

    it('should work with empty existing packages', () => {
      const result = ensurePackageHierarchy([], 'com.example');
      expect(result).toEqual(['com', 'com.example']);
    });

    it('should preserve unrelated packages', () => {
      const existing = ['org.other', 'net.something'];
      const result = ensurePackageHierarchy(existing, 'com.example');
      expect(result).toContain('org.other');
      expect(result).toContain('net.something');
      expect(result).toContain('com');
      expect(result).toContain('com.example');
    });
  });
});
