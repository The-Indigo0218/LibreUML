import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Package Auto-Creation', () => {
  beforeEach(() => {
    // Reset store before each test
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  describe('createClass with nested package', () => {
    it('should auto-create intermediate packages when creating class with nested packageName', () => {
      const store = useModelStore.getState();
      
      // Create a class with nested package name
      const classId = store.createClass({
        name: 'TestClass',
        packageName: 'as2.as.test',
        attributeIds: [],
        operationIds: [],
      });

      const model = store.model;
      expect(model).toBeTruthy();
      expect(model!.classes[classId]).toBeTruthy();
      expect(model!.classes[classId].packageName).toBe('as2.as.test');
      
      // Verify all intermediate packages were created
      expect(model!.packageNames).toContain('as2');
      expect(model!.packageNames).toContain('as2.as');
      expect(model!.packageNames).toContain('as2.as.test');
    });

    it('should not duplicate packages if they already exist', () => {
      const store = useModelStore.getState();
      
      // Pre-create some packages
      store.addPackageName('as2');
      store.addPackageName('as2.as');
      
      const initialPackageCount = store.model!.packageNames!.length;
      
      // Create class with nested package
      store.createClass({
        name: 'TestClass',
        packageName: 'as2.as.test',
        attributeIds: [],
        operationIds: [],
      });

      const model = store.model;
      
      // Should only add the new leaf package
      expect(model!.packageNames!.length).toBe(initialPackageCount + 1);
      expect(model!.packageNames).toContain('as2.as.test');
    });
  });

  describe('createInterface with nested package', () => {
    it('should auto-create intermediate packages for interfaces', () => {
      const store = useModelStore.getState();
      
      store.createInterface({
        name: 'TestInterface',
        packageName: 'com.example.interfaces',
        operationIds: [],
      });

      const model = store.model;
      expect(model!.packageNames).toContain('com');
      expect(model!.packageNames).toContain('com.example');
      expect(model!.packageNames).toContain('com.example.interfaces');
    });
  });

  describe('createEnum with nested package', () => {
    it('should auto-create intermediate packages for enums', () => {
      const store = useModelStore.getState();
      
      store.createEnum({
        name: 'TestEnum',
        packageName: 'org.types.enums',
        literals: [],
      });

      const model = store.model;
      expect(model!.packageNames).toContain('org');
      expect(model!.packageNames).toContain('org.types');
      expect(model!.packageNames).toContain('org.types.enums');
    });
  });

  describe('setElementPackage with nested package', () => {
    it('should auto-create intermediate packages when moving element to nested package', () => {
      const store = useModelStore.getState();
      
      // Create a class without package
      const classId = store.createClass({
        name: 'TestClass',
        attributeIds: [],
        operationIds: [],
      });

      // Move to nested package
      store.setElementPackage(classId, 'new.nested.package');

      const model = store.model;
      expect(model!.classes[classId].packageName).toBe('new.nested.package');
      expect(model!.packageNames).toContain('new');
      expect(model!.packageNames).toContain('new.nested');
      expect(model!.packageNames).toContain('new.nested.package');
    });
  });
});
