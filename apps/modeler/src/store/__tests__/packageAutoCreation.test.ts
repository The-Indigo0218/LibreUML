import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';

describe('Package Auto-Creation', () => {
  beforeEach(() => {
    useModelStore.getState().resetModel();
    useModelStore.getState().initModel('test-model');
  });

  describe('createClass with nested package', () => {
    it('should auto-create intermediate packages when creating class with nested packageName', () => {
      const classId = useModelStore.getState().createClass({
        name: 'TestClass',
        packageName: 'as2.as.test',
        attributeIds: [],
        operationIds: [],
      });

      const model = useModelStore.getState().model;
      expect(model).toBeTruthy();
      expect(model!.classes[classId]).toBeTruthy();
      expect(model!.classes[classId].packageName).toBe('as2.as.test');

      expect(model!.packageNames).toContain('as2');
      expect(model!.packageNames).toContain('as2.as');
      expect(model!.packageNames).toContain('as2.as.test');
    });

    it('should not duplicate packages if they already exist', () => {
      useModelStore.getState().addPackageName('as2');
      useModelStore.getState().addPackageName('as2.as');

      const initialPackageCount = useModelStore.getState().model!.packageNames!.length;

      useModelStore.getState().createClass({
        name: 'TestClass',
        packageName: 'as2.as.test',
        attributeIds: [],
        operationIds: [],
      });

      const model = useModelStore.getState().model;

      expect(model!.packageNames!.length).toBe(initialPackageCount + 1);
      expect(model!.packageNames).toContain('as2.as.test');
    });
  });

  describe('createInterface with nested package', () => {
    it('should auto-create intermediate packages for interfaces', () => {
      useModelStore.getState().createInterface({
        name: 'TestInterface',
        packageName: 'com.example.interfaces',
        operationIds: [],
      });

      const model = useModelStore.getState().model;
      expect(model!.packageNames).toContain('com');
      expect(model!.packageNames).toContain('com.example');
      expect(model!.packageNames).toContain('com.example.interfaces');
    });
  });

  describe('createEnum with nested package', () => {
    it('should auto-create intermediate packages for enums', () => {
      useModelStore.getState().createEnum({
        name: 'TestEnum',
        packageName: 'org.types.enums',
        literals: [],
      });

      const model = useModelStore.getState().model;
      expect(model!.packageNames).toContain('org');
      expect(model!.packageNames).toContain('org.types');
      expect(model!.packageNames).toContain('org.types.enums');
    });
  });

  describe('setElementPackage with nested package', () => {
    it('should auto-create intermediate packages when moving element to nested package', () => {
      const classId = useModelStore.getState().createClass({
        name: 'TestClass',
        attributeIds: [],
        operationIds: [],
      });

      useModelStore.getState().setElementPackage(classId, 'new.nested.package');

      const model = useModelStore.getState().model;
      expect(model!.classes[classId].packageName).toBe('new.nested.package');
      expect(model!.packageNames).toContain('new');
      expect(model!.packageNames).toContain('new.nested');
      expect(model!.packageNames).toContain('new.nested.package');
    });
  });
});
